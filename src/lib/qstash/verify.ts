import { createHash, createHmac, timingSafeEqual } from "crypto";

const base64UrlEncode = (buffer: Buffer) =>
  buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const base64UrlDecode = (input: string) => {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((input.length + 3) % 4);
  return Buffer.from(padded, "base64").toString("utf-8");
};

const hashBody = (body: string) =>
  base64UrlEncode(createHash("sha256").update(body).digest());

function verifyJwt(token: string, key: string, body: string, expectedUrl: string): boolean {
  const [headerB64, payloadB64, signatureB64] = token.split(".");
  if (!headerB64 || !payloadB64 || !signatureB64) return false;

  const data = `${headerB64}.${payloadB64}`;
  const digest = base64UrlEncode(createHmac("sha256", key).update(data).digest());

  const sigBuf = Buffer.from(signatureB64);
  const digBuf = Buffer.from(digest);
  if (sigBuf.length !== digBuf.length) return false;
  if (!timingSafeEqual(sigBuf, digBuf)) return false;

  const payload = JSON.parse(base64UrlDecode(payloadB64));
  const now = Math.floor(Date.now() / 1000);
  if (payload?.iss && payload.iss !== "Upstash") return false;
  if (payload?.sub && payload.sub !== expectedUrl) return false;
  if (payload?.nbf && now < payload.nbf) return false;
  if (payload?.exp && now > payload.exp) return false;
  if (payload?.body && payload.body !== hashBody(body)) return false;

  return true;
}

export function verifyQStashSignature(signature: string, body: string, expectedUrl: string): boolean {
  const keys = [
    process.env.QSTASH_CURRENT_SIGNING_KEY,
    process.env.QSTASH_NEXT_SIGNING_KEY,
  ].filter(Boolean) as string[];
  if (keys.length === 0) return false;
  return keys.some((key) => verifyJwt(signature, key, body, expectedUrl));
}
