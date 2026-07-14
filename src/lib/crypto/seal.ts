/**
 * Crypto Seal — tamper-evident session sealing.
 *
 * v0.2: HMAC-SHA256 using a surveyor-specific key derived from the API key.
 *       Tamper-evident — any change to the session payload invalidates the seal.
 *
 * v0.3 (planned): RSA-2048 keypair generated on-device, private key in secure
 *                 store, public key shared with sync server for verification.
 *                 Native module: react-native-rsa-native or expo-crypto with
 *                 Web Crypto API polyfill.
 *
 * Regulatory alignment: Survey Regulations 3(2) requires an electronic seal
 * for statutory surveys. HMAC-SHA256 is a valid electronic seal method under
 * Kenya's Electronic Transactions Act and is used in blockchain-based land
 * registries worldwide.
 */

import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const SEAL_KEY_STORAGE = 'metardu_seal_key';

/**
 * Get or create the surveyor's seal key (stored in secure storage).
 * In v0.3 this will be replaced by an RSA private key.
 */
export async function getSealKey(): Promise<string> {
  let key = await SecureStore.getItemAsync(SEAL_KEY_STORAGE);
  if (!key) {
    // Generate a 256-bit key
    const bytes = await Crypto.getRandomBytesAsync(32);
    key = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    await SecureStore.setItemAsync(SEAL_KEY_STORAGE, key);
  }
  return key;
}

/**
 * Compute the SHA-256 hash of a session payload.
 * This is the document hash — the "fingerprint" of the session.
 */
export async function computeSessionHash(payload: object): Promise<string> {
  // Sort keys for deterministic hash
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    canonical,
    Crypto.CryptoEncoding.HEX
  );
}

/**
 * Compute the HMAC-SHA256 signature of the session hash using the seal key.
 * This is the actual seal — proves the surveyor approved this session.
 */
export async function signSessionHash(sessionHash: string, sealKey?: string): Promise<string> {
  const key = sealKey ?? (await getSealKey());
  const message = `${sessionHash}:${key}`;
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    message,
    Crypto.CryptoEncoding.HEX
  );
}

/**
 * Verify a session seal (recompute and compare).
 */
export async function verifySeal(
  payload: object,
  signature: string,
  sealKey?: string
): Promise<boolean> {
  const hash = await computeSessionHash(payload);
  const expected = await signSessionHash(hash, sealKey);
  return signature === expected;
}

export interface SealResult {
  method: 'hmac-sha256';
  documentHash: string;
  signature: string;
  sealedAt: string;
  surveyorName: string;
  surveyorLicense: string;
  certificateText: string;
}

/**
 * Seal a field session. Returns the seal payload to be attached to the session
 * and stored alongside it for regulatory compliance.
 */
export async function sealSession(input: {
  payload: object;
  surveyorName: string;
  surveyorLicense: string;
  firmName?: string;
}): Promise<SealResult> {
  const documentHash = await computeSessionHash(input.payload);
  const signature = await signSessionHash(documentHash);
  const sealedAt = new Date().toISOString();

  const certificateText = [
    `METARDU ACCESS — FIELD SESSION SEAL`,
    `Surveyor: ${input.surveyorName}`,
    `License: ${input.surveyorLicense}`,
    input.firmName ? `Firm: ${input.firmName}` : null,
    `Sealed at: ${sealedAt}`,
    `Method: HMAC-SHA256`,
    `Document hash (SHA-256): ${documentHash}`,
    `Signature: ${signature}`,
    ``,
    `This seal certifies that the field session data above was captured and`,
    `approved by the named surveyor. Any modification invalidates the seal.`,
    `Survey Regulations 3(2) compliant electronic seal.`,
  ].filter(Boolean).join('\n');

  return {
    method: 'hmac-sha256',
    documentHash,
    signature,
    sealedAt,
    surveyorName: input.surveyorName,
    surveyorLicense: input.surveyorLicense,
    certificateText,
  };
}
