/**
 * AES-256-GCM encryption/decryption — ported from AlphaLog
 * Uses same enc:v1: prefix format so both systems can read/write encrypted fields.
 */

import crypto from 'node:crypto';

const ENCRYPTION_PREFIX = 'enc:v1:';
const IV_LENGTH = 12;

let keyCache: Buffer | null = null;

function getKey(): Buffer {
  if (keyCache) return keyCache;
  const keyRaw = process.env.DATA_ENCRYPTION_KEY;
  if (!keyRaw) throw new Error('DATA_ENCRYPTION_KEY is not configured');
  const keyBuffer = Buffer.from(keyRaw, 'base64');
  if (keyBuffer.length !== 32) throw new Error('DATA_ENCRYPTION_KEY must be 32 bytes');
  keyCache = keyBuffer;
  return keyBuffer;
}

export function encryptText(value?: string | null): string | null {
  if (value === undefined || value === null) return null;
  if (value.startsWith(ENCRYPTION_PREFIX)) return value;
  if (value.length === 0) return value;

  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${ENCRYPTION_PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptText(value?: string | null): string | null {
  if (value === undefined || value === null) return null;
  if (!value.startsWith(ENCRYPTION_PREFIX)) return value;

  const key = getKey();
  const parts = value.slice(ENCRYPTION_PREFIX.length).split(':');
  if (parts.length !== 3) return null;

  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);

  return decrypted.toString('utf8');
}
