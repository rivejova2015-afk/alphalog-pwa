// Regression test for /api/auth/device/verify POST handler.
//
// SECURITY (audit 2026-06, Área 13 — step-up bypass): a device must NEVER be
// trusted on the password session alone WHEN the user has a verified second
// factor — the handler requires a completed AAL2 this session first.
// Lockout-safety: a user with NO factor enrolled is still allowed to trust the
// device (and is nudged to enable 2FA), so they cannot be locked out.

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

const { getUserMock, aalMock, factorsMock, fromMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  aalMock:     vi.fn(),
  factorsMock: vi.fn(),
  fromMock:    vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: getUserMock,
      mfa: { getAuthenticatorAssuranceLevel: aalMock, listFactors: factorsMock },
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

const withFactor = () => ({
  data: { all: [{ id: "f1", status: "verified", factor_type: "totp" }], totp: [], phone: [] },
  error: null,
});
const noFactor = () => ({ data: { all: [], totp: [], phone: [] }, error: null });

function req() {
  return new Request("http://localhost/api/auth/device/verify", {
    method: "POST",
    headers: { "user-agent": "test-agent" },
  });
}

describe("POST /api/auth/device/verify — AAL2 gate (lockout-safe)", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    aalMock.mockReset();
    factorsMock.mockReset();
    fromMock.mockReset();
    // Skip the optional per-IP rate-limit service block (no env → guarded off).
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    getUserMock.mockResolvedValue({ data: { user: { id: "u-1" } }, error: null });
    factorsMock.mockResolvedValue(withFactor()); // default: user already has a verified factor
  });

  it("401 when unauthenticated", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "no session" } });
    const res = await POST(req());
    expect(res.status).toBe(401);
  });

  it("403 mfa_required when user HAS a factor but session is NOT aal2", async () => {
    aalMock.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal2" }, error: null });
    const res = await POST(req());
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("mfa_required");
    expect(fromMock).not.toHaveBeenCalled(); // no upsert → device not trusted
  });

  it("403 when AAL lookup errors (fail closed) for a user with a factor", async () => {
    aalMock.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await POST(req());
    expect(res.status).toBe(403);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("200 and trusts the device when user has a factor and session is aal2", async () => {
    aalMock.mockResolvedValue({ data: { currentLevel: "aal2", nextLevel: "aal2" }, error: null });
    fromMock.mockReturnValue(makeUpsertChain({ data: { id: "d-1", trusted: true }, error: null }));
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(fromMock).toHaveBeenCalledWith("auth_device_sessions");
  });

  it("lockout-safe: 200 and trusts the device when the user has NO factor (even if not aal2)", async () => {
    factorsMock.mockResolvedValue(noFactor());
    aalMock.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal1" }, error: null });
    fromMock.mockReturnValue(makeUpsertChain({ data: { id: "d-2", trusted: true }, error: null }));
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(fromMock).toHaveBeenCalledWith("auth_device_sessions");
  });
});
