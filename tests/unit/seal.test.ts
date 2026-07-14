/**
 * Crypto seal tests
 */

import { computeSessionHash, signSessionHash, verifySeal, sealSession } from '../../src/lib/crypto/seal';

describe('computeSessionHash', () => {
  it('produces a stable SHA-256 hash for the same payload', async () => {
    const payload = { a: 1, b: 'test', c: [1, 2, 3] };
    const hash1 = await computeSessionHash(payload);
    const hash2 = await computeSessionHash(payload);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex
  });

  it('changes when payload changes', async () => {
    const h1 = await computeSessionHash({ value: 1 });
    const h2 = await computeSessionHash({ value: 2 });
    expect(h1).not.toBe(h2);
  });
});

describe('signSessionHash', () => {
  it('produces a deterministic signature for the same key', async () => {
    const hash = 'abc123';
    const key = 'test-key';
    const sig1 = await signSessionHash(hash, key);
    const sig2 = await signSessionHash(hash, key);
    expect(sig1).toBe(sig2);
    expect(sig1).toHaveLength(64);
  });

  it('changes with different keys', async () => {
    const hash = 'abc123';
    const sig1 = await signSessionHash(hash, 'key1');
    const sig2 = await signSessionHash(hash, 'key2');
    expect(sig1).not.toBe(sig2);
  });
});

describe('verifySeal', () => {
  it('verifies a valid seal', async () => {
    const payload = { points: [], traverses: [] };
    const key = 'test-key';
    const hash = await computeSessionHash(payload);
    const signature = await signSessionHash(hash, key);
    const valid = await verifySeal(payload, signature, key);
    expect(valid).toBe(true);
  });

  it('rejects a tampered payload', async () => {
    const originalPayload = { points: [], traverses: [] };
    const key = 'test-key';
    const hash = await computeSessionHash(originalPayload);
    const signature = await signSessionHash(hash, key);
    // Tamper with payload
    const tamperedPayload = { points: [{ x: 1 }], traverses: [] };
    const valid = await verifySeal(tamperedPayload, signature, key);
    expect(valid).toBe(false);
  });
});

describe('sealSession', () => {
  it('returns a complete seal result', async () => {
    const result = await sealSession({
      payload: { points: [{ x: 1, y: 2 }] },
      surveyorName: 'John Doe',
      surveyorLicense: 'ISK/1234',
      firmName: 'Doe Surveyors',
    });
    expect(result.method).toBe('hmac-sha256');
    expect(result.documentHash).toHaveLength(64);
    expect(result.signature).toHaveLength(64);
    expect(result.surveyorName).toBe('John Doe');
    expect(result.surveyorLicense).toBe('ISK/1234');
    expect(result.certificateText).toContain('METARDU ACCESS');
    expect(result.certificateText).toContain('John Doe');
    expect(result.certificateText).toContain('ISK/1234');
    expect(result.certificateText).toContain('HMAC-SHA256');
  });
});
