import crypto from "crypto";
import { triggerSecurityAlert } from "./securityAlert";

const getSecret = () => {
  const s = process.env.INTEGRITY_HMAC_SECRET || process.env.DATA_ENCRYPTION_KEY;
  if (!s) throw new Error("No INTEGRITY_HMAC_SECRET configured");
  return s;
};

export function computeIntegrityHash(fields: Record<string, unknown>): string {
  const payload = JSON.stringify(fields, Object.keys(fields).sort());
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function verifyIntegrity(
  fields: Record<string, unknown>,
  storedHash: string | null | undefined,
  context: { table: string; id: string }
): boolean {
  if (!storedHash) return true; // Legacy rows without hash — skip check
  try {
    const expected = computeIntegrityHash(fields);
    const a = Buffer.from(expected);
    const b = Buffer.from(storedHash);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      void triggerSecurityAlert("db_tampering_detected" as Parameters<typeof triggerSecurityAlert>[0], {
        path: `${context.table}/${context.id}`,
      });
      return false;
    }
    return true;
  } catch {
    return true; // Fail open: don't block reads if secret misconfigured
  }
}
