import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'crypto';

// Set up a valid 32-byte base64 key before importing the module
const TEST_KEY = crypto.randomBytes(32).toString('base64');

beforeAll(() => {
  process.env.DATA_ENCRYPTION_KEY = TEST_KEY;
  // Mock window as undefined so ensureServer() passes
  (global as any).window = undefined;
});

// Dynamic import so env var is set before module-level code runs
const getEncryption = () => import('./encryption');

describe('encryptText / decryptText', () => {
  it('round-trips a plain string', async () => {
    const { encryptText, decryptText } = await getEncryption();
    const original = 'Hello AlphaLog!';
    const encrypted = encryptText(original);
    expect(encrypted).not.toBeNull();
    expect(encrypted).toContain('enc:v1:');
    const decrypted = decryptText(encrypted);
    expect(decrypted).toBe(original);
  });

  it('returns null for null input', async () => {
    const { encryptText, decryptText } = await getEncryption();
    expect(encryptText(null)).toBeNull();
    expect(decryptText(null)).toBeNull();
  });

  it('returns null for undefined input', async () => {
    const { encryptText, decryptText } = await getEncryption();
    expect(encryptText(undefined)).toBeNull();
    expect(decryptText(undefined)).toBeNull();
  });

  it('returns empty string unchanged', async () => {
    const { encryptText } = await getEncryption();
    expect(encryptText('')).toBe('');
  });

  it('does not double-encrypt already encrypted values', async () => {
    const { encryptText, decryptText } = await getEncryption();
    const original = 'Trade journal entry';
    const encrypted = encryptText(original)!;
    const doubleEncrypted = encryptText(encrypted);
    expect(doubleEncrypted).toBe(encrypted);
    expect(decryptText(doubleEncrypted)).toBe(original);
  });

  it('returns non-prefixed string as-is from decryptText', async () => {
    const { decryptText } = await getEncryption();
    expect(decryptText('plain text')).toBe('plain text');
  });

  it('produces different ciphertext on each call (random IV)', async () => {
    const { encryptText } = await getEncryption();
    const a = encryptText('same input');
    const b = encryptText('same input');
    expect(a).not.toBe(b);
  });

  it('handles unicode text correctly', async () => {
    const { encryptText, decryptText } = await getEncryption();
    const unicode = '🚀 Trading en EUR/USD — señal alcista';
    expect(decryptText(encryptText(unicode))).toBe(unicode);
  });
});
