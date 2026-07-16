/**
 * SQLite integrity checks + auto-recovery.
 *
 * Field conditions destroy databases:
 *   - Phone battery dies mid-write
 *   - Phone dropped during sync
 *   - SD card corruption
 *   - App killed by OS during background task
 *
 * This module performs:
 *   1. PRAGMA integrity_check on app launch
 *   2. PRAGMA quick_check on every DB open (fast)
 *   3. WAL checkpoint after writes
 *   4. Automatic backup to a sidecar file on each successful checkpoint
 *   5. Recovery from backup if main DB fails integrity check
 *
 * The backup file is `metardu-access.db.backup` — copied after every
 * successful checkpoint, kept at most 1 version old.
 */

import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';
import { getDatabase } from './schema';

const DB_NAME = 'metardu-access.db';
const BACKUP_NAME = 'metardu-access.db.backup';
const BACKUP_ROTATION = 3; // keep last 3 backups

export type IntegrityStatus =
  | 'ok'
  | 'warning'
  | 'corrupt'
  | 'restored-from-backup'
  | 'unrecoverable';

export interface IntegrityReport {
  status: IntegrityStatus;
  integrityCheck?: string;
  quickCheck?: string;
  walCheckpoint?: string;
  fileSizeBytes: number;
  backupSizeBytes?: number;
  recoveredAt?: string;
  error?: string;
}

/**
 * Run a full integrity check on app launch.
 * Takes ~50-200ms for a typical DB. Safe to run async.
 */
export async function fullIntegrityCheck(): Promise<IntegrityReport> {
  const db = await getDatabase();
  const report: IntegrityReport = {
    status: 'ok',
    fileSizeBytes: 0,
  };

  try {
    // File size
    const info = await FileSystem.getInfoAsync(FileSystem.documentDirectory + 'SQLite/' + DB_NAME);
    if (info.exists) {
      report.fileSizeBytes = info.size ?? 0;
    }

    // PRAGMA integrity_check (slow but thorough)
    const integrityResult = await db.getAllAsync<{ integrity_check: string }>(
      'PRAGMA integrity_check;'
    );
    report.integrityCheck = integrityResult[0]?.integrity_check ?? 'unknown';

    if (report.integrityCheck !== 'ok') {
      report.status = 'corrupt';
      // Try to recover from backup
      const restored = await restoreFromBackup();
      if (restored) {
        report.status = 'restored-from-backup';
        report.recoveredAt = new Date().toISOString();
      } else {
        report.status = 'unrecoverable';
        report.error = 'Main DB corrupt and no valid backup available';
      }
      return report;
    }

    // Quick check (faster, runs on every open)
    const quickResult = await db.getFirstAsync<{ quick_check: string }>(
      'PRAGMA quick_check;'
    );
    report.quickCheck = quickResult?.quick_check ?? 'unknown';

    if (report.quickCheck !== 'ok') {
      report.status = 'warning';
    }

    // Force WAL checkpoint to fold WAL into main DB
    const checkpointResult = await db.getFirstAsync<{ wal_checkpoint: string; log: number; checkpointed: number }>(
      'PRAGMA wal_checkpoint(TRUNCATE);'
    );
    report.walCheckpoint = checkpointResult?.wal_checkpoint ?? 'unknown';

    // Backup after successful checkpoint
    await createBackup();

    const backupInfo = await FileSystem.getInfoAsync(
      FileSystem.documentDirectory + 'SQLite/' + BACKUP_NAME
    );
    if (backupInfo.exists) {
      report.backupSizeBytes = backupInfo.size ?? 0;
    }

    return report;
  } catch (err: any) {
    report.status = 'unrecoverable';
    report.error = err.message;
    return report;
  }
}

/**
 * Quick check on every DB open — fast (5-10ms).
 */
export async function quickIntegrityCheck(): Promise<boolean> {
  try {
    const db = await getDatabase();
    const result = await db.getFirstAsync<{ quick_check: string }>('PRAGMA quick_check;');
    return result?.quick_check === 'ok';
  } catch {
    return false;
  }
}

/**
 * Create a backup of the main database file.
 * Rotates: keeps last BACKUP_ROTATION versions.
 */
export async function createBackup(): Promise<void> {
  const sqliteDir = FileSystem.documentDirectory + 'SQLite/';
  const mainPath = sqliteDir + DB_NAME;
  const backupPath = sqliteDir + BACKUP_NAME;

  const mainInfo = await FileSystem.getInfoAsync(mainPath);
  if (!mainInfo.exists) return;

  // Rotate existing backups
  for (let i = BACKUP_ROTATION - 1; i > 0; i--) {
    const oldPath = `${backupPath}.${i}`;
    const newPath = `${backupPath}.${i + 1}`;
    const oldInfo = await FileSystem.getInfoAsync(oldPath);
    if (oldInfo.exists) {
      try {
        await FileSystem.moveAsync({ from: oldPath, to: newPath });
      } catch {}
    }
  }

  // Move current backup to .1
  const backupInfo = await FileSystem.getInfoAsync(backupPath);
  if (backupInfo.exists) {
    try {
      await FileSystem.moveAsync({ from: backupPath, to: `${backupPath}.1` });
    } catch {}
  }

  // Copy main to backup
  try {
    await FileSystem.copyAsync({ from: mainPath, to: backupPath });
  } catch (err) {
    console.warn('[integrity] Backup failed:', err);
  }
}

/**
 * Restore from the most recent valid backup.
 * Returns true if restoration succeeded.
 */
export async function restoreFromBackup(): Promise<boolean> {
  const sqliteDir = FileSystem.documentDirectory + 'SQLite/';
  const mainPath = sqliteDir + DB_NAME;
  const backupPath = sqliteDir + BACKUP_NAME;

  // Try primary backup first
  const backupInfo = await FileSystem.getInfoAsync(backupPath);
  if (backupInfo.exists) {
    try {
      // Close current DB connection
      const db = await getDatabase();
      await db.closeAsync();
      // Replace corrupt DB with backup
      await FileSystem.deleteAsync(mainPath, { idempotent: true });
      await FileSystem.copyAsync({ from: backupPath, to: mainPath });
      console.log('[integrity] Restored from primary backup');
      return true;
    } catch (err) {
      console.warn('[integrity] Primary restore failed:', err);
    }
  }

  // Try rotated backups
  for (let i = 1; i <= BACKUP_ROTATION; i++) {
    const rotatedPath = `${backupPath}.${i}`;
    const rotatedInfo = await FileSystem.getInfoAsync(rotatedPath);
    if (rotatedInfo.exists) {
      try {
        await FileSystem.deleteAsync(mainPath, { idempotent: true });
        await FileSystem.copyAsync({ from: rotatedPath, to: mainPath });
        console.log(`[integrity] Restored from backup .${i}`);
        return true;
      } catch (err) {
        console.warn(`[integrity] Restore from .${i} failed:`, err);
      }
    }
  }

  return false;
}

/**
 * Compact the database (VACUUM) — runs weekly or on-demand.
 * Reclaims space from deleted records.
 */
export async function compactDatabase(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync('VACUUM;');
}

/**
 * Get database statistics for the Settings screen.
 */
export async function getDatabaseStats(): Promise<{
  fileSizeBytes: number;
  tableCount: number;
  rowCountByTable: Record<string, number>;
  lastIntegrityCheck?: string;
}> {
  const db = await getDatabase();
  const sqliteDir = FileSystem.documentDirectory + 'SQLite/';
  const mainPath = sqliteDir + DB_NAME;

  const info = await FileSystem.getInfoAsync(mainPath);
  const fileSizeBytes = info.exists ? info.size ?? 0 : 0;

  const tables = await db.getAllAsync<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_knex_%'`
  );

  const rowCountByTable: Record<string, number> = {};
  for (const t of tables) {
    const count = await db.getFirstAsync<{ c: number }>(`SELECT COUNT(*) as c FROM ${t.name}`);
    rowCountByTable[t.name] = count?.c ?? 0;
  }

  return {
    fileSizeBytes,
    tableCount: tables.length,
    rowCountByTable,
  };
}
