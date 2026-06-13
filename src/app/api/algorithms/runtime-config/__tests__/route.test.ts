// Integration test for /api/algorithms/runtime-config GET handler.
//
// Surfaces DISPATCH_MODE to the client (used by DispatchModeBanner +
// DispatchModeChip). Covers:
//   1. 401 when unauthenticated.
//   2. 200 with dispatch_mode='shadow' when env var is unset (defensive default).
//   3. 200 with dispatch_mode='live' when env var === 'live'.
//   4. 200 with dispatch_mode='shadow' for non-'live' env values (typo guard).
//   5. Cache-Control header set so the client polls at reasonable cadence.

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

const { getUserMock } = vi.hoisted(() => ({ getUserMock: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
  }),
}));

let GET: () => Promise<Response>;
beforeAll(async () => {
  const mod = await import("../route");
  GET = mod.GET;
});

describe("/api/algorithms/runtime-config — handler", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    delete process.env.DISPATCH_MODE;
  });

  it("returns 401 when auth fails", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "no session" } });
    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns dispatch_mode='shadow' by default when DISPATCH_MODE is unset", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dispatch_mode).toBe("shadow");
  });

  it("returns dispatch_mode='live' when DISPATCH_MODE=live", async () => {
    process.env.DISPATCH_MODE = "live";
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dispatch_mode).toBe("live");
  });

  it("returns dispatch_mode='shadow' for non-'live' typos (defensive)", async () => {
    process.env.DISPATCH_MODE = "production";
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const res = await GET();
    const body = await res.json();
    expect(body.dispatch_mode).toBe("shadow");
  });

  it("returns dispatch_mode='live' regardless of case ('LIVE' / 'Live')", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });

    process.env.DISPATCH_MODE = "LIVE";
    expect((await (await GET()).json()).dispatch_mode).toBe("live");

    process.env.DISPATCH_MODE = "Live";
    expect((await (await GET()).json()).dispatch_mode).toBe("live");
  });

  it("sets a Cache-Control header (30s + SWR)", async () => {
    process.env.DISPATCH_MODE = "shadow";
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const res = await GET();
    const cc = res.headers.get("Cache-Control");
    expect(cc).toContain("private");
    expect(cc).toContain("max-age=30");
    expect(cc).toContain("stale-while-revalidate");
  });
});
