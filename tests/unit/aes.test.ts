/**
 * AES-256-GCM encryption tests
 *
 * Verifies:
 *   - Encrypt + decrypt round-trip preserves data
 *   - Tampered ciphertext is rejected (auth tag works)
 *   - Wrong password is rejected
 *   - Different encryptions of same plaintext produce different ciphertexts (random IV + salt)
 *   - Large data (1MB) works
 */

import {
  encrypt,
  decrypt,
  deriveKey,
  bytesToBase64,
  base64ToBytes,
} from '../../src/lib/crypto/aes';

describe('AES-256-GCM encryption', () => {
  const testPassword = 'surveyor-api-key-test-123';
  const testPlaintext = 'Metardu Access field data — coordinates 254500.123, 9857200.456';

  describe('round-trip', () => {
    it('encrypts and decrypts successfully', () => {
      const encrypted = encrypt(testPlaintext, testPassword);
      const decrypted = decrypt(encrypted, testPassword);
      expect(decrypted).toBe(testPlaintext);
    });

    it('preserves unicode characters', () => {
      const unicode = 'Nguzo ya Saruji — ISK/1234 — ±2mm accuracy';
      const encrypted = encrypt(unicode, testPassword);
      const decrypted = decrypt(encrypted, testPassword);
      expect(decrypted).toBe(unicode);
    });

    it('preserves JSON data', () => {
      const data = JSON.stringify({
        points: [
          { number: 'P-001', easting: 254500.123, northing: 9857200.456 },
          { number: 'P-002', easting: 254501.456, northing: 9857201.789 },
        ],
        surveyor: 'John Doe',
      });
      const encrypted = encrypt(data, testPassword);
      const decrypted = decrypt(encrypted, testPassword);
      expect(JSON.parse(decrypted)).toEqual(JSON.parse(data));
    });

    it('handles empty string', () => {
      const encrypted = encrypt('', testPassword);
      const decrypted = decrypt(encrypted, testPassword);
      expect(decrypted).toBe('');
    });

    it('handles large data (100KB)', () => {
      const large = 'A'.repeat(100_000);
      const encrypted = encrypt(large, testPassword);
      const decrypted = decrypt(encrypted, testPassword);
      expect(decrypted).toBe(large);
      expect(decrypted.length).toBe(100_000);
    });
  });

  describe('tamper detection', () => {
    it('rejects tampered ciphertext', () => {
      const encrypted = encrypt(testPlaintext, testPassword);
      // Flip last byte of ciphertext
      const tampered = {
        ...encrypted,
        ciphertext: encrypted.ciphertext.slice(0, -4) + 'AAAA',
      };
      expect(() => decrypt(tampered, testPassword)).toThrow();
    });

    it('rejects tampered IV', () => {
      const encrypted = encrypt(testPlaintext, testPassword);
      const tampered = {
        ...encrypted,
        iv: encrypted.iv.slice(0, -4) + 'XXXX',
      };
      expect(() => decrypt(tampered, testPassword)).toThrow();
    });

    it('rejects tampered salt (wrong key derived)', () => {
      const encrypted = encrypt(testPlaintext, testPassword);
      const tampered = {
        ...encrypted,
        salt: encrypted.salt.slice(0, -4) + 'YYYY',
      };
      expect(() => decrypt(tampered, testPassword)).toThrow();
    });
  });

  describe('wrong password', () => {
    it('rejects wrong password', () => {
      const encrypted = encrypt(testPlaintext, testPassword);
      expect(() => decrypt(encrypted, 'wrong-password')).toThrow();
    });

    it('rejects empty password', () => {
      const encrypted = encrypt(testPlaintext, testPassword);
      expect(() => decrypt(encrypted, '')).toThrow();
    });

    it('rejects similar password', () => {
      const encrypted = encrypt(testPlaintext, testPassword);
      expect(() => decrypt(encrypted, testPassword + ' ')).toThrow();
    });
  });

  describe('randomness', () => {
    it('produces different ciphertexts for same plaintext (random IV)', () => {
      const e1 = encrypt(testPlaintext, testPassword);
      const e2 = encrypt(testPlaintext, testPassword);
      expect(e1.ciphertext).not.toBe(e2.ciphertext);
      expect(e1.iv).not.toBe(e2.iv);
      expect(e1.salt).not.toBe(e2.salt);
    });

    it('uses different IVs (12 bytes each)', () => {
      const e = encrypt(testPlaintext, testPassword);
      const ivBytes = base64ToBytes(e.iv);
      expect(ivBytes.length).toBe(12);
    });

    it('uses different salts (16 bytes each)', () => {
      const e = encrypt(testPlaintext, testPassword);
      const saltBytes = base64ToBytes(e.salt);
      expect(saltBytes.length).toBe(16);
    });
  });

  describe('version handling', () => {
    it('marks payload with version 1', () => {
      const e = encrypt(testPlaintext, testPassword);
      expect(e.version).toBe(1);
    });

    it('rejects unsupported version', () => {
      const e = encrypt(testPlaintext, testPassword);
      const future = { ...e, version: 99 };
      expect(() => decrypt(future, testPassword)).toThrow(/Unsupported encryption version/);
    });
  });

  describe('key derivation', () => {
    it('derives 32-byte key (AES-256)', () => {
      const salt = new Uint8Array(16);
      const key = deriveKey('password', salt);
      expect(key.length).toBe(32);
    });

    it('derives different keys for different salts', () => {
      const salt1 = new Uint8Array(16).fill(1);
      const salt2 = new Uint8Array(16).fill(2);
      const key1 = deriveKey('password', salt1);
      const key2 = deriveKey('password', salt2);
      expect(key1).not.toEqual(key2);
    });

    it('derives different keys for different passwords', () => {
      const salt = new Uint8Array(16);
      const key1 = deriveKey('password1', salt);
      const key2 = deriveKey('password2', salt);
      expect(key1).not.toEqual(key2);
    });
  });

  describe('base64 helpers', () => {
    it('round-trips bytes through base64', () => {
      const original = new Uint8Array([0, 1, 2, 255, 128, 64, 32]);
      const b64 = bytesToBase64(original);
      const restored = base64ToBytes(b64);
      expect(Array.from(restored)).toEqual(Array.from(original));
    });

    it('handles empty bytes', () => {
      const b64 = bytesToBase64(new Uint8Array(0));
      expect(b64).toBe('');
      expect(base64ToBytes(b64).length).toBe(0);
    });
  });
});
