import crypto from "crypto";

const IV_LENGTH = 12;

// Key registry for rotation support
const KEY_REGISTRY: Record<string, string | undefined> = {
  v1: process.env.DATA_ENCRYPTION_KEY,
  v2: process.env.DATA_ENCRYPTION_KEY_V2,
};

// Current version determines which key is used for new encryptions
const CURRENT_VERSION = process.env.ENCRYPTION_KEY_VERSION || "v1";

// Domain-separated keys: each data domain has its own AES key.
// If one domain key is compromised, other domains remain protected.
const DOMAIN_KEYS: Record<string, string | undefined> = {
  journal: process.env.ENCRYPTION_KEY_JOURNAL,
  treasury: process.env.ENCRYPTION_KEY_TREASURY,
  trades: process.env.ENCRYPTION_KEY_TRADES,
  mail: process.env.ENCRYPTION_KEY_MAIL,
};

const getDomainKey = (domain: keyof typeof DOMAIN_KEYS): Buffer => {
  const keyRaw = DOMAIN_KEYS[domain] || process.env.DATA_ENCRYPTION_KEY;
  if (!keyRaw) {
    throw new Error(`No encryption key configured for domain '${domain}'`);
  }
  const keyBuffer = Buffer.from(keyRaw, "base64");
  if (keyBuffer.length !== 32) {
    throw new Error(`Encryption key for domain '${domain}' must be 32 bytes (base64) for AES-256-GCM`);
  }
  return keyBuffer;
};

export const encryptForDomain = (domain: keyof typeof DOMAIN_KEYS, value?: string | null): string | null => {
  if (value === undefined || value === null) return null;
  if (value.startsWith("enc:v")) return value;
  if (value.length === 0) return value;

  ensureServer();
  const key = getDomainKey(domain);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `enc:${CURRENT_VERSION}:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
};

export const decryptForDomain = (domain: keyof typeof DOMAIN_KEYS, value?: string | null): string | null => {
  if (value === undefined || value === null) return null;
  if (!value.startsWith("enc:v")) return value;

  ensureServer();

  const versionMatch = value.match(/^enc:(v\d+):/);
  if (!versionMatch) return value;

  const version = versionMatch[1];
  const prefix = `enc:${version}:`;

  // Use domain key (fall back to default versioned key for legacy data)
  const keyRaw = DOMAIN_KEYS[domain] || KEY_REGISTRY[version];
  if (!keyRaw) return value;
  const keyBuffer = Buffer.from(keyRaw, "base64");
  if (keyBuffer.length !== 32) return value;

  const payload = value.slice(prefix.length);
  const [ivB64, tagB64, dataB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !dataB64) return value;

  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const encrypted = Buffer.from(dataB64, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", keyBuffer, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
};

const getKey = (version: string = CURRENT_VERSION): Buffer => {
  const keyRaw = KEY_REGISTRY[version];
  if (!keyRaw) {
    throw new Error(`Encryption key for version ${version} is not configured`);
  }

  const keyBuffer = Buffer.from(keyRaw, "base64");
  if (keyBuffer.length !== 32) {
    throw new Error(`Key v${version} must be 32 bytes (base64) for AES-256-GCM`);
  }

  return keyBuffer;
};

const ensureServer = () => {
  if (typeof window !== "undefined") {
    throw new Error("Encryption utilities must run on the server");
  }
};

export const encryptText = (value?: string | null): string | null => {
  if (value === undefined || value === null) return null;
  // Idempotency: if already encrypted, return as-is (regardless of version)
  if (value.startsWith("enc:v")) return value;
  if (value.length === 0) return value;

  ensureServer();
  const key = getKey(CURRENT_VERSION);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  const prefix = `enc:${CURRENT_VERSION}:`;
  return `${prefix}${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
};

export const decryptText = (value?: string | null): string | null => {
  if (value === undefined || value === null) return null;
  if (!value.startsWith("enc:v")) return value;

  ensureServer();

  // Parse version from prefix: enc:v1:... or enc:v2:...
  const versionMatch = value.match(/^enc:(v\d+):/);
  if (!versionMatch) return value;

  const version = versionMatch[1]; // e.g., "v1" or "v2"
  const prefix = `enc:${version}:`;
  const key = getKey(version);

  const payload = value.slice(prefix.length);
  const [ivB64, tagB64, dataB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    return value;
  }

  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const encrypted = Buffer.from(dataB64, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

  return decrypted.toString("utf8");
};
