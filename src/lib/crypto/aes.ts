/**
 * Cloud backup encryption — real AES-256-GCM.
 *
 * v0.6 used a XOR placeholder (insecure). v0.7 uses @noble/ciphers
 * (audited pure-TS implementation) for real AES-256-GCM.
 *
 * Why AES-256-GCM:
 *   - AES-256: NIST-approved symmetric cipher (no known practical attacks)
 *   - GCM mode: provides both confidentiality AND authenticity
 *     (auth tag detects tampering — XOR can't do this)
 *   - Used by TLS, VPNs, disk encryption, military comms
 *
 * Key derivation:
 *   - PBKDF2-HMAC-SHA256 with 100,000 iterations (OWASP minimum)
 *   - Salt: per-backup random 16 bytes (prevents rainbow tables)
 *   - Password: surveyor's API key + app-specific pepper
 *
 * File format (versioned for forward compatibility):
 *   [version:1][salt:16][iv:12][ciphertext:N][authTag:16]
 *
 * Total overhead: 45 bytes. Negligible for MB-scale DB backups.
 */

import { gcm } from '@noble/ciphers/aes.js';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { randomBytes } from '@noble/hashes/utils.js';

const ENCRYPTION_VERSION = 1;
const KEY_LENGTH = 32;          // AES-256
const IV_LENGTH = 12;           // GCM standard
const SALT_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;     // GCM standard
const PBKDF2_ITERATIONS = 100_000;
const PEPPER = 'metardu-access-v0.7'; // app-specific, prevents off-the-shelf attacks

export interface EncryptedPayload {
  version: number;
  salt: string;      // base64
  iv: string;        // base64
  ciphertext: string; // base64 (includes auth tag appended)
}

/**
 * Derive a 256-bit key from the surveyor's API key using PBKDF2.
 * Salt is per-backup (random) — same password produces different keys.
 */
export function deriveKey(password: string, salt: Uint8Array): Uint8Array {
  const combinedPassword = `${password}:${PEPPER}`;
  return pbkdf2(sha256, combinedPassword, salt, {
    c: PBKDF2_ITERATIONS,
    dkLen: KEY_LENGTH,
  });
}

/**
 * Encrypt data with AES-256-GCM.
 *
 * @param plaintext - UTF-8 string to encrypt
 * @param password - surveyor's API key (or any strong secret)
 * @returns EncryptedPayload with salt, IV, and ciphertext (auth tag appended)
 */
export function encrypt(plaintext: string, password: string): EncryptedPayload {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = deriveKey(password, salt);
  const plaintextBytes = new TextEncoder().encode(plaintext);

  // noble's gcm() returns ciphertext with auth tag appended (last 16 bytes)
  const cipher = gcm(key, iv);
  const encrypted = cipher.encrypt(plaintextBytes);

  return {
    version: ENCRYPTION_VERSION,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(encrypted),
  };
}

/**
 * Decrypt data encrypted with encrypt().
 * Throws if auth tag verification fails (tampering detected).
 */
export function decrypt(payload: EncryptedPayload, password: string): string {
  if (payload.version !== ENCRYPTION_VERSION) {
    throw new Error(
      `Unsupported encryption version: ${payload.version}. ` +
      `This app supports version ${ENCRYPTION_VERSION}. ` +
      `Update the app or use a backup from a compatible version.`
    );
  }

  const salt = base64ToBytes(payload.salt);
  const iv = base64ToBytes(payload.iv);
  const ciphertextWithTag = base64ToBytes(payload.ciphertext);
  const key = deriveKey(password, salt);

  const cipher = gcm(key, iv);
  // decrypt() verifies the auth tag — throws on tampering
  const plaintext = cipher.decrypt(ciphertextWithTag);

  return new TextDecoder().decode(plaintext);
}

/**
 * Verify that a payload can be decrypted with the given password
 * without actually returning the plaintext. Used for key verification.
 */
export function verifyKey(payload: EncryptedPayload, password: string): boolean {
  try {
    decrypt(payload, payload.ciphertext.length > 0 ? password : '');
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Helpers — base64 ↔ bytes (works in RN, Node, and browsers)
// ============================================================================
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Generate a random encryption key (for cases where we want a fresh key
 * rather than deriving from a password).
 */
export function generateRandomKey(): string {
  return bytesToBase64(randomBytes(KEY_LENGTH));
}
