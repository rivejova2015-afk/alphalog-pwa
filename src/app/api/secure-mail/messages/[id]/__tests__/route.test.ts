// Integration test para GET /api/secure-mail/messages/[id].
//
// Covers:
//   1. 401 sin usuario autenticado.
//   2. 404 si el mensaje no existe o no pertenece al usuario.
//   3. Happy path: decrypt de subject/body/filename, audit insert con
//      event="read" — la migración 20260704014503 agregó 'read' al CHECK
//      constraint de secure_message_access_audit (antes el insert fallaba
//      en silencio siempre, sin romper la respuesta porque es fire-and-forget).
//   4. Fallback de decrypt: si decryptText tira, usa el valor crudo.
//   5. 500 si falla el fetch de attachments.

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { getUserMock, fromMock, decryptTextMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  fromMock: vi.fn(),
  decryptTextMock: vi.fn((v: string) => `decrypted:${v}`),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
  }),
}));
vi.mock("@/lib/security/encryption", () => ({
  decryptText: (v: string) => decryptTextMock(v),
}));
vi.mock("@/lib/log", () => ({
  logError: vi.fn(), logWarn: vi.fn(),
}));

let GET: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
beforeAll(async () => {
  const mod = await import("../route");
  GET = mod.GET;
});

function chain(result: { data?: unknown; error?: unknown }) {
  const proxy: Record<string, unknown> = {};
  for (const m of ["select", "eq", "is"]) proxy[m] = () => proxy;
  proxy.single = async () => result;
  proxy.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return proxy;
}

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/secure-mail/messages/msg-1");
}

describe("GET /api/secure-mail/messages/[id]", () => {
  const insertCalls: Array<{ table: string; payload: unknown }> = [];

  beforeEach(() => {
    insertCalls.length = 0;
    decryptTextMock.mockReset().mockImplementation((v: string) => `decrypted:${v}`);
  });

  it("401 sin usuario autenticado", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    const res = await GET(makeRequest(), { params: Promise.resolve({ id: "msg-1" }) });
    expect(res.status).toBe(401);
  });

  it("404 si el mensaje no existe o no pertenece al usuario", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    fromMock.mockImplementation((table: string) => {
      if (table === "secure_messages") return chain({ data: null, error: { message: "not found" } });
      throw new Error(`unexpected table ${table}`);
    });
    const res = await GET(makeRequest(), { params: Promise.resolve({ id: "msg-1" }) });
    expect(res.status).toBe(404);
  });

  it("happy path: decrypt subject/body/filename + audit insert con event='read'", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    fromMock.mockImplementation((table: string) => {
      if (table === "secure_messages") {
        return chain({
          data: { id: "msg-1", subject_ciphertext: "enc-subj", body_ciphertext: "enc-body" },
          error: null,
        });
      }
      if (table === "secure_message_access_audit") {
        return {
          insert: (payload: unknown) => {
            insertCalls.push({ table, payload });
            return Promise.resolve({ data: null, error: null });
          },
        };
      }
      if (table === "secure_attachments") {
        return chain({ data: [{ id: "att-1", filename_ciphertext: "enc-name" }], error: null });
      }
      throw new Error(`unexpected table ${table}`);
    });

    const res = await GET(makeRequest(), { params: Promise.resolve({ id: "msg-1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.message.subject_ciphertext).toBe("decrypted:enc-subj");
    expect(json.message.body_ciphertext).toBe("decrypted:enc-body");
    expect(json.attachments[0].filename_ciphertext).toBe("decrypted:enc-name");

    // Bug fijado: antes este insert usaba un event value que el CHECK
    // constraint rechazaba silenciosamente. Ahora 'read' es válido.
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0].payload).toMatchObject({ user_id: "u1", message_id: "msg-1", event: "read" });
  });

  it("decrypt falla → cae al valor crudo sin romper la respuesta", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    decryptTextMock.mockImplementation(() => { throw new Error("bad key"); });
    fromMock.mockImplementation((table: string) => {
      if (table === "secure_messages") {
        return chain({ data: { id: "msg-1", subject_ciphertext: "enc-subj", body_ciphertext: "enc-body" }, error: null });
      }
      if (table === "secure_message_access_audit") {
        return { insert: () => Promise.resolve({ data: null, error: null }) };
      }
      if (table === "secure_attachments") return chain({ data: [], error: null });
      throw new Error(`unexpected table ${table}`);
    });

    const res = await GET(makeRequest(), { params: Promise.resolve({ id: "msg-1" }) });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.message.subject_ciphertext).toBe("enc-subj"); // raw fallback
  });

  it("500 si falla el fetch de attachments", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    fromMock.mockImplementation((table: string) => {
      if (table === "secure_messages") {
        return chain({ data: { id: "msg-1", subject_ciphertext: "s", body_ciphertext: "b" }, error: null });
      }
      if (table === "secure_message_access_audit") {
        return { insert: () => Promise.resolve({ data: null, error: null }) };
      }
      if (table === "secure_attachments") return chain({ data: null, error: { message: "db down" } });
      throw new Error(`unexpected table ${table}`);
    });

    const res = await GET(makeRequest(), { params: Promise.resolve({ id: "msg-1" }) });
    expect(res.status).toBe(500);
  });
});
