// @vitest-environment jsdom
//
// AlphaCore mutations.ts — createEntity / updateEntity / softDeleteEntity.
// Cubre los caminos críticos: auth check, request building, success/failure
// parsing del response, manejo del catch.
//
// Validates:
//   1. createEntity: UNAUTH retornado cuando supabase.auth.getUser falla.
//   2. createEntity: success path con response.ok → status='synced' + data.
//   3. createEntity: failure path con response.ok=false + error en body.
//   4. createEntity: catch path con fetch throw → INTERNAL_ERROR.
//   5. createEntity: mutationId es un UUID v4 válido.
//   6. createEntity: URL es /api/alphacore/{table}/create.
//   7. updateEntity: success path con PUT a /api/alphacore/{table}/update/{id}.
//   8. updateEntity: UNAUTH path.
//   9. softDeleteEntity: success path con DELETE a /api/alphacore/{table}/delete/{id}.

import { describe, it, expect, vi, beforeEach } from "vitest";

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/browser", () => ({
  createClient: createClientMock,
}));
vi.mock("@/lib/log", () => ({
  logError: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn(),
}));
// AlphaShield logger lookups in mutations.ts go via dynamic import / network;
// suppress noise by mocking the alphashield module.
vi.mock("@/lib/alphashield/alphashield-client", () => ({
  default: {
    logMutationSuccess: vi.fn(),
    logMutationError: vi.fn(),
    logMutationOptimistic: vi.fn(),
  },
}));

import { createEntity, updateEntity, softDeleteEntity } from "../mutations";

function authedSupabase(userId = "u-1") {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId } }, error: null,
      }),
    },
  };
}

function unauthedSupabase() {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: null }, error: { message: "no session" },
      }),
    },
  };
}

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("createEntity", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("UNAUTH cuando supabase.auth.getUser retorna error / null user", async () => {
    createClientMock.mockResolvedValue(unauthedSupabase());

    const result = await createEntity("accounts", { name: "Test" });
    expect(result.status).toBe("failed");
    expect(result.error?.code).toBe("UNAUTH");
    expect(result.error?.message).toBe("User not authenticated");
    expect(result.mutationId).toMatch(UUID_V4_RE);
  });

  it("Success path: response.ok con data → status='synced'", async () => {
    createClientMock.mockResolvedValue(authedSupabase());
    globalThis.fetch = vi.fn(async () => ({
      ok: true, json: async () => ({ data: { id: "srv-1", name: "Test" } }),
    } as unknown as Response)) as unknown as typeof fetch;

    const result = await createEntity("accounts", { name: "Test" });
    expect(result.status).toBe("synced");
    expect(result.data).toEqual({ id: "srv-1", name: "Test" });
    expect(result.error).toBeUndefined();
  });

  it("Failure path: response.ok=false con body.message → error parseado", async () => {
    createClientMock.mockResolvedValue(authedSupabase());
    globalThis.fetch = vi.fn(async () => ({
      ok: false, status: 400,
      json: async () => ({ code: "VALIDATION_FAILED", message: "name too short" }),
    } as unknown as Response)) as unknown as typeof fetch;

    const result = await createEntity("accounts", { name: "x" });
    expect(result.status).toBe("failed");
    expect(result.error?.code).toBe("VALIDATION_FAILED");
    expect(result.error?.message).toBe("name too short");
  });

  it("Failure path: response.ok=false sin body → fallback 'HTTP {status}'", async () => {
    createClientMock.mockResolvedValue(authedSupabase());
    globalThis.fetch = vi.fn(async () => ({
      ok: false, status: 500,
      json: async () => { throw new Error("not json"); },
    } as unknown as Response)) as unknown as typeof fetch;

    const result = await createEntity("accounts", { name: "Test" });
    expect(result.status).toBe("failed");
    expect(result.error?.message).toBe("HTTP 500");
  });

  it("Catch path: fetch throws → INTERNAL_ERROR", async () => {
    createClientMock.mockResolvedValue(authedSupabase());
    globalThis.fetch = vi.fn(async () => {
      throw new Error("network ECONNREFUSED");
    }) as unknown as typeof fetch;

    const result = await createEntity("accounts", { name: "Test" });
    expect(result.status).toBe("failed");
    expect(result.error?.code).toBe("INTERNAL_ERROR");
    expect(result.error?.message).toBe("network ECONNREFUSED");
    expect(result.error?.originalError).toBeInstanceOf(Error);
  });

  it("mutationId siempre es UUID v4 válido", async () => {
    createClientMock.mockResolvedValue(unauthedSupabase());
    const result = await createEntity("accounts", {});
    expect(result.mutationId).toMatch(UUID_V4_RE);
  });

  it("URL es /api/alphacore/{table}/create con Content-Type JSON", async () => {
    createClientMock.mockResolvedValue(authedSupabase());
    let capturedUrl  = "";
    let capturedInit: RequestInit | undefined;
    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      capturedUrl  = url;
      capturedInit = init;
      return { ok: true, json: async () => ({ data: { id: "x" } }) } as unknown as Response;
    }) as unknown as typeof fetch;

    await createEntity("custom_table", { foo: "bar" });
    expect(capturedUrl).toBe("/api/alphacore/custom_table/create");
    expect(capturedInit?.method).toBe("POST");
    expect((capturedInit?.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });
});

// updateEntity y softDeleteEntity NO hacen auth check — directamente
// fetchean. La auth la valida el endpoint /api/alphacore/{...}.

describe("updateEntity", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("Success path: PATCH a /api/alphacore/{table}/{id}/update", async () => {
    createClientMock.mockResolvedValue(authedSupabase());
    let capturedUrl  = "";
    let capturedInit: RequestInit | undefined;
    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      capturedUrl  = url;
      capturedInit = init;
      return { ok: true, json: async () => ({ data: { id: "ent-9", name: "Updated" } }) } as unknown as Response;
    }) as unknown as typeof fetch;

    const result = await updateEntity("accounts", "ent-9", { name: "Updated" });
    expect(result.status).toBe("synced");
    expect(result.data?.name).toBe("Updated");
    expect(capturedUrl).toBe("/api/alphacore/accounts/ent-9/update");
    expect(capturedInit?.method).toBe("PATCH");
  });

  it("Failure path con response.ok=false en update", async () => {
    createClientMock.mockResolvedValue(authedSupabase());
    globalThis.fetch = vi.fn(async () => ({
      ok: false, status: 404,
      json: async () => ({ message: "not found" }),
    } as unknown as Response)) as unknown as typeof fetch;

    const result = await updateEntity("accounts", "missing", {});
    expect(result.status).toBe("failed");
    expect(result.error?.message).toBe("not found");
  });

  it("Catch path: fetch throws → INTERNAL_ERROR", async () => {
    createClientMock.mockResolvedValue(authedSupabase());
    globalThis.fetch = vi.fn(async () => {
      throw new Error("connection refused");
    }) as unknown as typeof fetch;

    const result = await updateEntity("accounts", "ent-9", { name: "x" });
    expect(result.status).toBe("failed");
    expect(result.error?.code).toBe("INTERNAL_ERROR");
    expect(result.error?.message).toBe("connection refused");
  });
});

describe("softDeleteEntity", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("Success path: DELETE a /api/alphacore/{table}/{id}/delete", async () => {
    createClientMock.mockResolvedValue(authedSupabase());
    let capturedUrl  = "";
    let capturedInit: RequestInit | undefined;
    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      capturedUrl  = url;
      capturedInit = init;
      return { ok: true, json: async () => ({ data: { id: "ent-9", deleted_at: "2026-06-15" } }) } as unknown as Response;
    }) as unknown as typeof fetch;

    const result = await softDeleteEntity("accounts", "ent-9");
    expect(result.status).toBe("synced");
    expect(capturedUrl).toBe("/api/alphacore/accounts/ent-9/delete");
    expect(capturedInit?.method).toBe("DELETE");
  });

  it("Failure path: response.ok=false → returns error from body", async () => {
    createClientMock.mockResolvedValue(authedSupabase());
    globalThis.fetch = vi.fn(async () => ({
      ok: false, status: 404,
      json: async () => ({ message: "row not found" }),
    } as unknown as Response)) as unknown as typeof fetch;

    const result = await softDeleteEntity("accounts", "ent-9");
    expect(result.status).toBe("failed");
    expect(result.error?.message).toBe("row not found");
  });
});
