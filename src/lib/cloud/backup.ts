/**
 * Cloud backup service — abstracts iCloud / Google Drive / local file.
 *
 * Phones get lost, dropped, rained on. Field data must be backed up
 * automatically to a cloud location the surveyor controls.
 *
 * Architecture:
 *   1. Local SQLite backup (handled by integrity.ts)
 *   2. Cloud backup (this module) — encrypts + uploads to:
 *      - iOS: iCloud Drive (via UIDocumentPicker)
 *      - Android: Google Drive (via SAF / Storage Access Framework)
 *      - Fallback: any WebDAV-compatible server
 *
 * The backup is encrypted with a key derived from the surveyor's API key
 * (so losing the phone doesn't expose data, but restoring only requires
 * signing in with the same credentials).
 *
 * v0.6: Cloud backup is opt-in and requires user to grant cloud access.
 *       The app does NOT auto-upload to a server the surveyor doesn't control.
 */

import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import {
  encrypt as aesEncrypt,
  decrypt as aesDecrypt,
  type EncryptedPayload,
  bytesToBase64,
  base64ToBytes,
} from '@/lib/crypto/aes';

const BACKUP_DIR = FileSystem.documentDirectory + 'backups/';
const BACKUP_INDEX = BACKUP_DIR + 'index.json';

export type CloudProvider = 'icloud' | 'gdrive' | 'webdav' | 'local-only';

export interface BackupConfig {
  provider: CloudProvider;
  remotePath?: string;        // for WebDAV
  remoteUrl?: string;         // for WebDAV
  encryptionEnabled: boolean;
  autoBackup: boolean;        // auto-backup on data change
  backupIntervalHours: number; // min hours between auto-backups
  lastBackupAt?: string;
}

export interface BackupEntry {
  id: string;
  createdAt: string;
  fileSizeBytes: number;
  checksum: string;           // SHA-256 of original DB
  encrypted: boolean;
  provider: CloudProvider;
  uploadedToCloud: boolean;
  localPath: string;
  surveyorEmail: string;
  projectCount: number;
  pointCount: number;
}

interface BackupIndex {
  entries: BackupEntry[];
  config: BackupConfig;
}

let cachedIndex: BackupIndex | null = null;

const DEFAULT_CONFIG: BackupConfig = {
  provider: Platform.OS === 'ios' ? 'icloud' : 'gdrive',
  encryptionEnabled: true,
  autoBackup: true,
  backupIntervalHours: 6,
};

// ============================================================================
// Index management
// ============================================================================
async function loadIndex(): Promise<BackupIndex> {
  if (cachedIndex) return cachedIndex;
  await FileSystem.makeDirectoryAsync(BACKUP_DIR, { intermediates: true });
  const info = await FileSystem.getInfoAsync(BACKUP_INDEX);
  if (!info.exists) {
    cachedIndex = { entries: [], config: DEFAULT_CONFIG };
    await saveIndex(cachedIndex);
    return cachedIndex;
  }
  const raw = await FileSystem.readAsStringAsync(BACKUP_INDEX);
  try {
    cachedIndex = JSON.parse(raw);
  } catch {
    cachedIndex = { entries: [], config: DEFAULT_CONFIG };
  }
  return cachedIndex;
}

async function saveIndex(index: BackupIndex): Promise<void> {
  await FileSystem.makeDirectoryAsync(BACKUP_DIR, { intermediates: true });
  await FileSystem.writeAsStringAsync(BACKUP_INDEX, JSON.stringify(index, null, 2));
  cachedIndex = index;
}

export async function getConfig(): Promise<BackupConfig> {
  const index = await loadIndex();
  return index.config;
}

export async function updateConfig(updates: Partial<BackupConfig>): Promise<void> {
  const index = await loadIndex();
  index.config = { ...index.config, ...updates };
  await saveIndex(index);
}

// ============================================================================
// Encryption — real AES-256-GCM via @noble/ciphers (audited pure-TS)
//
// Replaces the v0.6 XOR placeholder. AES-256-GCM provides:
//   - Confidentiality (AES-256 — no known practical attacks)
//   - Authenticity (GCM auth tag — tampering detected on decrypt)
//   - Key derivation via PBKDF2-HMAC-SHA256 (100k iterations, per-backup salt)
//
// Encrypted file is JSON: { version, salt, iv, ciphertext }
// ciphertext includes the 16-byte auth tag appended (noble's convention)
// ============================================================================
async function encryptData(plaintext: string, password: string): Promise<string> {
  const payload: EncryptedPayload = aesEncrypt(plaintext, password);
  return JSON.stringify(payload);
}

async function decryptData(encryptedJson: string, password: string): Promise<string> {
  const payload: EncryptedPayload = JSON.parse(encryptedJson);
  return aesDecrypt(payload, password);
}

// ============================================================================
// Backup creation
// ============================================================================
export async function createBackup(input: {
  surveyorEmail: string;
  surveyorApiKey: string;
  projectCount: number;
  pointCount: number;
}): Promise<BackupEntry> {
  const config = await getConfig();
  const sqliteDir = FileSystem.documentDirectory + 'SQLite/';
  const dbPath = sqliteDir + 'metardu-access.db';

  const dbInfo = await FileSystem.getInfoAsync(dbPath);
  if (!dbInfo.exists) {
    throw new Error('Database file not found');
  }

  // Read DB file
  const dbData = await FileSystem.readAsStringAsync(dbPath, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // Compute checksum
  const checksum = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    dbData,
    Crypto.CryptoEncoding.HEX
  );

  // Encrypt if enabled
  let finalData = dbData;
  if (config.encryptionEnabled) {
    finalData = await encryptData(dbData, input.surveyorApiKey);
  }

  // Write backup file
  const id = `backup-${Date.now()}`;
  const backupPath = BACKUP_DIR + id + (config.encryptionEnabled ? '.enc' : '.db');
  await FileSystem.makeDirectoryAsync(BACKUP_DIR, { intermediates: true });
  await FileSystem.writeAsStringAsync(backupPath, finalData, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const entry: BackupEntry = {
    id,
    createdAt: new Date().toISOString(),
    fileSizeBytes: dbInfo.size ?? 0,
    checksum,
    encrypted: config.encryptionEnabled,
    provider: config.provider,
    uploadedToCloud: false,
    localPath: backupPath,
    surveyorEmail: input.surveyorEmail,
    projectCount: input.projectCount,
    pointCount: input.pointCount,
  };

  const index = await loadIndex();
  index.entries.unshift(entry);
  // Keep only last 20 backups
  index.entries = index.entries.slice(0, 20);
  index.config.lastBackupAt = entry.createdAt;
  await saveIndex(index);

  // Try cloud upload
  await uploadToCloud(entry).catch((err) => {
    console.warn('[backup] Cloud upload failed:', err);
  });

  return entry;
}

// ============================================================================
// Cloud upload (provider-specific)
// ============================================================================
async function uploadToCloud(entry: BackupEntry): Promise<void> {
  const config = await getConfig();

  switch (config.provider) {
    case 'icloud':
      await uploadToICloud(entry);
      break;
    case 'gdrive':
      await uploadToGDrive(entry);
      break;
    case 'webdav':
      if (config.remoteUrl) {
        await uploadToWebDAV(entry, config.remoteUrl, config.remotePath ?? '/');
      }
      break;
    case 'local-only':
      // No cloud upload
      return;
  }

  // Mark as uploaded
  const index = await loadIndex();
  const updated = index.entries.find((e) => e.id === entry.id);
  if (updated) {
    updated.uploadedToCloud = true;
    await saveIndex(index);
  }
}

async function uploadToICloud(entry: BackupEntry): Promise<void> {
  // iOS: use UIDocumentPicker to save to iCloud Drive
  // Requires user to pick destination once; subsequent saves go to same folder
  // For v0.6: scaffold — would need a native module like expo-icloud
  console.log('[backup] iCloud upload would happen here for', entry.id);
  // Mark as not uploaded (since we can't actually upload without native module)
  throw new Error('iCloud upload requires native module (planned for v0.7)');
}

async function uploadToGDrive(entry: BackupEntry): Promise<void> {
  // Android: use SAF / Storage Access Framework
  // For v0.6: scaffold — would need expo-google-drive-api or similar
  console.log('[backup] Google Drive upload would happen here for', entry.id);
  throw new Error('Google Drive upload requires native module (planned for v0.7)');
}

async function uploadToWebDAV(entry: BackupEntry, url: string, path: string): Promise<void> {
  // WebDAV: HTTP PUT to a server
  // This actually works without native modules — fetch is enough
  const data = await FileSystem.readAsStringAsync(entry.localPath, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const filename = entry.id + (entry.encrypted ? '.enc' : '.db');
  const response = await fetch(`${url}${path}${filename}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': data.length.toString(),
    },
    body: data,
  });
  if (!response.ok) {
    throw new Error(`WebDAV upload failed: HTTP ${response.status}`);
  }
}

// ============================================================================
// Restore from backup
// ============================================================================
export async function restoreFromBackup(
  entryId: string,
  surveyorApiKey: string
): Promise<void> {
  const index = await loadIndex();
  const entry = index.entries.find((e) => e.id === entryId);
  if (!entry) throw new Error('Backup not found');

  let dbData = await FileSystem.readAsStringAsync(entry.localPath, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // Decrypt if needed
  if (entry.encrypted) {
    dbData = await decryptData(dbData, surveyorApiKey);
  }

  // Verify checksum
  const checksum = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    dbData,
    Crypto.CryptoEncoding.HEX
  );
  if (checksum !== entry.checksum) {
    throw new Error('Backup checksum mismatch — file may be corrupted or tampered with');
  }

  // Replace current DB
  const dbPath = FileSystem.documentDirectory + 'SQLite/metardu-access.db';
  await FileSystem.writeAsStringAsync(dbPath, dbData, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

// ============================================================================
// List + delete backups
// ============================================================================
export async function listBackups(): Promise<BackupEntry[]> {
  const index = await loadIndex();
  return index.entries;
}

export async function deleteBackup(entryId: string): Promise<void> {
  const index = await loadIndex();
  const entry = index.entries.find((e) => e.id === entryId);
  if (entry) {
    await FileSystem.deleteAsync(entry.localPath, { idempotent: true });
  }
  index.entries = index.entries.filter((e) => e.id !== entryId);
  await saveIndex(index);
}

// ============================================================================
// Auto-backup check
// ============================================================================
export async function maybeAutoBackup(input: {
  surveyorEmail: string;
  surveyorApiKey: string;
  projectCount: number;
  pointCount: number;
}): Promise<BackupEntry | null> {
  const config = await getConfig();
  if (!config.autoBackup) return null;

  if (config.lastBackupAt) {
    const lastTime = new Date(config.lastBackupAt).getTime();
    const elapsed = (Date.now() - lastTime) / (1000 * 60 * 60); // hours
    if (elapsed < config.backupIntervalHours) return null;
  }

  return await createBackup(input);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
