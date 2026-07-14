// Vault de secretos propio de lattice-server, accedido directamente por SQL
// (no vía la ruta HTTP api/src/routes/secrets.ts, que es JWT-session-scoped
// para el dashboard Tauri — ver README de lattice-server, sección "Secret:
// dos vías de acceso", Task 9 de este plan).
//
// La tabla "Secret" vive en la base `lattice` (NO alphalog_bots) y su FK de
// userId apunta al único usuario de lattice-server -- nunca al user_id de
// AlphaLog, son sistemas de usuarios distintos sin correspondencia de UUIDs.
// project+name ya desambiguan de sobra sin necesitar el user_id de AlphaLog.

import postgres from "postgres";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const LATTICE_USER_ID = "02cea22f-b155-4fe6-bcd4-9354160f3a8a";

let sql: ReturnType<typeof postgres> | null = null;

function getLatticeSql() {
  if (sql) return sql;
  const url = process.env.LATTICE_PG_URL;
  if (!url) throw new Error("Missing LATTICE_PG_URL env var");
  sql = postgres(url, { max: 3 });
  return sql;
}

function getKey(): Buffer {
  const hexKey = process.env.LATTICE_ENCRYPTION_KEY;
  if (!hexKey) throw new Error("Missing LATTICE_ENCRYPTION_KEY env var");
  const key = Buffer.from(hexKey, "hex");
  if (key.length !== 32) throw new Error("LATTICE_ENCRYPTION_KEY debe ser 32 bytes (64 hex chars)");
  return key;
}

function encrypt(plaintext: string): { ciphertext: Buffer; iv: Buffer; authTag: Buffer } {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return { ciphertext, iv, authTag: cipher.getAuthTag() };
}

function decrypt(ciphertext: Buffer, iv: Buffer, authTag: Buffer): string {
  const key = getKey();
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

export async function getLatticeSecret(project: string, name: string): Promise<string | null> {
  const client = getLatticeSql();
  const rows = await client<{ ciphertext: Buffer; iv: Buffer; authTag: Buffer }[]>`
    SELECT ciphertext, iv, "authTag" FROM "Secret"
    WHERE "userId" = ${LATTICE_USER_ID} AND project = ${project} AND name = ${name}
  `;
  if (rows.length === 0) return null;
  return decrypt(rows[0].ciphertext, rows[0].iv, rows[0].authTag);
}

export async function setLatticeSecret(project: string, name: string, value: string): Promise<void> {
  const client = getLatticeSql();
  const { ciphertext, iv, authTag } = encrypt(value);
  await client`
    INSERT INTO "Secret" (id, "userId", project, name, ciphertext, iv, "authTag", "createdAt", "updatedAt")
    VALUES (gen_random_uuid()::text, ${LATTICE_USER_ID}, ${project}, ${name}, ${ciphertext}, ${iv}, ${authTag}, now(), now())
    ON CONFLICT ("userId", project, name) DO UPDATE SET
      ciphertext = EXCLUDED.ciphertext,
      iv = EXCLUDED.iv,
      "authTag" = EXCLUDED."authTag",
      "updatedAt" = now()
  `;
}

// DELETE real (Ajuste #4) -- vault.ts hoy "borra" sobrescribiendo con string
// vacío; acá se decide explícitamente pasar a un DELETE real de la fila,
// más limpio y sin el estado intermedio ambiguo de "secreto vacío".
export async function deleteLatticeSecret(project: string, name: string): Promise<void> {
  const client = getLatticeSql();
  await client`
    DELETE FROM "Secret" WHERE "userId" = ${LATTICE_USER_ID} AND project = ${project} AND name = ${name}
  `;
}
