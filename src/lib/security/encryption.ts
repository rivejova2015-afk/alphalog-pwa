import crypto from "crypto";

const ENCRYPTION_PREFIX = "enc:v1:";
const IV_LENGTH = 12;

const getKey = (): Buffer => {
  const keyRaw = process.env.DATA_ENCRYPTION_KEY;
  if (!keyRaw) {
    throw new Error("DATA_ENCRYPTION_KEY is not configured");
  }

  const keyBuffer = Buffer.from(keyRaw, "base64");
  if (keyBuffer.length !== 32) {
    throw new Error("DATA_ENCRYPTION_KEY must be 32 bytes (base64) for AES-256-GCM");
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
  if (value.startsWith(ENCRYPTION_PREFIX)) return value;
  if (value.length === 0) return value;

  ensureServer();
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${ENCRYPTION_PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
};

export const decryptText = (value?: string | null): string | null => {
  if (value === undefined || value === null) return null;
  if (!value.startsWith(ENCRYPTION_PREFIX)) return value;

  ensureServer();
  const key = getKey();
  const payload = value.slice(ENCRYPTION_PREFIX.length);
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
