// Integration test for /api/algorithms/alert-preferences GET/PUT (Wave 5
// item 22 — user-configurable alert thresholds, first cut: coinarb-heartbeat).
//
// Covers: 401 on both, GET returns hardcoded defaults + isDefault:true when
// no row exists, GET returns the stored row + isDefault:false when it does,
// PUT validation (out-of-range values), PUT upserts and returns the saved row.

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { getUserMock, fromMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  fromMock:    vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
  }),
}));
vi.mock("@/lib/log", () => ({
  logError: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn(),
}));

let GET: (req: NextRequest) => Promise<Response>;
let PUT: (req: NextRequest) => Promise<Response>;
beforeAll(async () => {
  const mod = await import("../route");
  GET = mod.GET; PUT = mod.PUT;
});

function makeAwaitableChain(result: { data?: unknown; error?: unknown }) {
  const proxy: Record<string, unknown> = {};
  const chainable = ["select", "eq", "maybeSingle", "single", "upsert"];
  for (const m of chainable) proxy[m] = () => proxy;
  proxy.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return proxy;
}

function makeGetRequest(): NextRequest {
  return new NextRequest("http://localhost/api/algorithms/alert-preferences", { method: "GET" });
}
function makePutRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/algorithms/alert-preferences", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    duplex: "half",
  });
}

function setupAuth() {
  getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
}

describe("/api/algorithms/alert-preferences", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    fromMock.mockReset();
  });

  describe("GET", () => {
    it("returns 401 when unauthenticated", async () => {
      getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "x" } });
      const res = await GET(makeGetRequest());
      expect(res.status).toBe(401);
    });

    it("returns hardcoded defaults + isDefault:true when no row exists", async () => {
      setupAuth();
      fromMock.mockReturnValue(makeAwaitableChain({ data: null, error: null }));
      const res = await GET(makeGetRequest());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.isDefault).toBe(true);
      expect(body.preferences).toEqual({ coinarb_heartbeat_stale_sec: 300, coinarb_heartbeat_dedup_minutes: 30 });
    });

    it("returns the stored row + isDefault:false when it exists", async () => {
      setupAuth();
      fromMock.mockReturnValue(makeAwaitableChain({ data: { coinarb_heartbeat_stale_sec: 600, coinarb_heartbeat_dedup_minutes: 15 }, error: null }));
      const res = await GET(makeGetRequest());
      const body = await res.json();
      expect(body.isDefault).toBe(false);
      expect(body.preferences).toEqual({ coinarb_heartbeat_stale_sec: 600, coinarb_heartbeat_dedup_minutes: 15 });
    });
  });

  describe("PUT", () => {
    it("returns 401 when unauthenticated", async () => {
      getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "x" } });
      const res = await PUT(makePutRequest({ coinarb_heartbeat_stale_sec: 300, coinarb_heartbeat_dedup_minutes: 30 }));
      expect(res.status).toBe(401);
    });

    it("returns 400 when stale_sec is out of range", async () => {
      setupAuth();
      const res = await PUT(makePutRequest({ coinarb_heartbeat_stale_sec: 10, coinarb_heartbeat_dedup_minutes: 30 }));
      expect(res.status).toBe(400);
    });

    it("returns 400 when dedup_minutes is out of range", async () => {
      setupAuth();
      const res = await PUT(makePutRequest({ coinarb_heartbeat_stale_sec: 300, coinarb_heartbeat_dedup_minutes: 9999 }));
      expect(res.status).toBe(400);
    });

    it("upserts and returns the saved preferences", async () => {
      setupAuth();
      fromMock.mockReturnValue(makeAwaitableChain({ data: { coinarb_heartbeat_stale_sec: 600, coinarb_heartbeat_dedup_minutes: 45 }, error: null }));
      const res = await PUT(makePutRequest({ coinarb_heartbeat_stale_sec: 600, coinarb_heartbeat_dedup_minutes: 45 }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.preferences).toEqual({ coinarb_heartbeat_stale_sec: 600, coinarb_heartbeat_dedup_minutes: 45 });
    });
  });
});
