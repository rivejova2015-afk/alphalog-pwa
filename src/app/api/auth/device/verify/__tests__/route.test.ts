// Regression test for /api/auth/device/verify POST handler.
//
// SECURITY (audit 2026-06, Área 13 — step-up bypass): a device must NEVER be
// trusted on the password session alone. The handler now requires a completed
// second factor (AAL2) this session before marking the device trusted.

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

const { getUserMock, aalMock, fromMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  aalMock:     vi.fn(),
  fromMock:    vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: getUserMock,
      mfa: { getAuthenticatorAssuranceLevel: aalMock },
    },
    from: fromMock,
  }),
}));
vi.mock("@/lib/log", () => ({ logError: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn() }));
vi.mock("@/lib/security/auditLog", () => ({ logAuditFromRequest: vi.fn().mockResolvedValue(null) }));

let POST: (req: Request) => Promise<Response>;
beforeAll(async () => {
  POST = (await import("../route")).POST;
});

function makeUpsertChain(result: { data?: unknown; error?: unknown }) {
  const p: Record<string, unknown> = {};
  p.upsert = () => p;
  p.select = () => p;
  p.single = () => Promise.resolve(result);
  return p;
}

function req() {
  return new Request("http://localhost/api/auth/device/verify", {
    method: "POST",
    headers: { "user-agent": "test-agent" },
  });
}

describe("POST /api/auth/device/verify — AAL2 gate", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    aalMock.mockReset();
    fromMock.mockReset();
    // Skip the optional per-IP rate-limit service block (no env → guarded off).
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    getUserMock.mockResolvedValue({ data: { user: { id: "u-1" } }, error: null });
  });

  it("401 when unauthenticated", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "no session" } });
    const res = await POST(req());
    expect(res.status).toBe(401);
  });

  it("403 mfa_required when session is NOT aal2 — never trusts the device", async () => {
    aalMock.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal2" }, error: null });
    const res = await POST(req());
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("mfa_required");
    expect(fromMock).not.toHaveBeenCalled(); // no upsert → device not trusted
  });

  it("403 when AAL lookup errors (fail closed)", async () => {
    aalMock.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await POST(req());
    expect(res.status).toBe(403);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("200 and trusts the device when session is aal2", async () => {
    aalMock.mockResolvedValue({ data: { currentLevel: "aal2", nextLevel: "aal2" }, error: null });
    fromMock.mockReturnValue(makeUpsertChain({ data: { id: "d-1", trusted: true }, error: null }));
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(fromMock).toHaveBeenCalledWith("auth_device_sessions");
  });
});
