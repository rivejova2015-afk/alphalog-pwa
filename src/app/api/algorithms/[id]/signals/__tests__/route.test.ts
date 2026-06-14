// Integration test for /api/algorithms/[id]/signals GET handler.
//
// Backs the AlgorithmShadowInbox feed. Covers:
//   1. 401 when auth fails.
//   2. 404 when the algorithm is not found (RLS-level ownership check).
//   3. Default limit=50 when query param is absent or invalid.
//   4. Custom limit clamped into [1, 200].
//   5. status query param respected when in VALID_STATUSES set.
//   6. status param IGNORED when not in VALID_STATUSES (silently dropped).
//   7. Empty result returns { signals: [] } not 404.
//   8. 500 when the cme_signals select errors.
//   9. Cache-Control header set with max-age=10 + SWR.

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

let GET: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
beforeAll(async () => {
  const mod = await import("../route");
  GET = mod.GET;
});

// Chain proxy that captures the .eq() and .limit() args so tests can assert
// what query the route actually built.
function makeQueryChain(
  result: { data?: unknown; error?: unknown },
  capture?: { eqs: Array<[string, unknown]>; limit: number | null },
) {
  const proxy: Record<string, unknown> = {};
  proxy.select = () => proxy;
  proxy.is     = () => proxy;
  proxy.order  = () => proxy;
  proxy.eq     = (col: string, val: unknown) => { capture?.eqs.push([col, val]); return proxy; };
  proxy.limit  = (n: number) => { if (capture) capture.limit = n; return proxy; };
  proxy.maybeSingle = () => Promise.resolve(result);
  proxy.then  = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return proxy;
}

function makeRequest(qs = ""): NextRequest {
  return new NextRequest(`http://localhost/api/algorithms/algo-1/signals${qs}`, { method: "GET" });
}

const CTX = { params: Promise.resolve({ id: "algo-1" }) };

describe("/api/algorithms/[id]/signals — handler", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    fromMock.mockReset();
  });

  it("returns 401 when auth fails", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "x" } });
    const res = await GET(makeRequest(), CTX);
    expect(res.status).toBe(401);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the algorithm is not found", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    fromMock.mockReturnValue(makeQueryChain({ data: null, error: null }));
    const res = await GET(makeRequest(), CTX);
    expect(res.status).toBe(404);
  });

  it("uses default limit=50 when no query param is provided", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const capture = { eqs: [] as Array<[string, unknown]>, limit: null as number | null };
    let call = 0;
    fromMock.mockImplementation(() => {
      call++;
      if (call === 1) return makeQueryChain({ data: { id: "algo-1" }, error: null });
      return makeQueryChain({ data: [], error: null }, capture);
    });
    await GET(makeRequest(), CTX);
    expect(capture.limit).toBe(50);
  });

  it("clamps custom limit into [1, 200]", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    for (const { qs, expected } of [
      { qs: "?limit=10",      expected: 10  },
      // limit=0 → parseInt → 0 → `0 || 50` falls back to default → 50
      { qs: "?limit=0",       expected: 50  },
      { qs: "?limit=-100",    expected: 1   },
      { qs: "?limit=999",     expected: 200 },
      { qs: "?limit=notnum",  expected: 50  },  // parseInt → NaN → default 50
    ]) {
      const capture = { eqs: [] as Array<[string, unknown]>, limit: null as number | null };
      let call = 0;
      fromMock.mockImplementation(() => {
        call++;
        if (call === 1) return makeQueryChain({ data: { id: "algo-1" }, error: null });
        return makeQueryChain({ data: [], error: null }, capture);
      });
      await GET(makeRequest(qs), CTX);
      expect(capture.limit).toBe(expected);
      fromMock.mockReset();
    }
  });

  it("adds status=skipped filter when query param is in VALID_STATUSES", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const capture = { eqs: [] as Array<[string, unknown]>, limit: null as number | null };
    let call = 0;
    fromMock.mockImplementation(() => {
      call++;
      if (call === 1) return makeQueryChain({ data: { id: "algo-1" }, error: null });
      return makeQueryChain({ data: [], error: null }, capture);
    });
    await GET(makeRequest("?status=skipped"), CTX);
    expect(capture.eqs.some(([k, v]) => k === "status" && v === "skipped")).toBe(true);
  });

  it("IGNORES status filter when value is not in VALID_STATUSES (silent drop)", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const capture = { eqs: [] as Array<[string, unknown]>, limit: null as number | null };
    let call = 0;
    fromMock.mockImplementation(() => {
      call++;
      if (call === 1) return makeQueryChain({ data: { id: "algo-1" }, error: null });
      return makeQueryChain({ data: [], error: null }, capture);
    });
    await GET(makeRequest("?status=garbage"), CTX);
    expect(capture.eqs.some(([k]) => k === "status")).toBe(false);
  });

  it("returns { signals: [] } (not 404) when no signals exist", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    let call = 0;
    fromMock.mockImplementation(() => {
      call++;
      if (call === 1) return makeQueryChain({ data: { id: "algo-1" }, error: null });
      return makeQueryChain({ data: [], error: null });
    });
    const res = await GET(makeRequest(), CTX);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.signals).toEqual([]);
  });

  it("returns 500 when the cme_signals select errors", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    let call = 0;
    fromMock.mockImplementation(() => {
      call++;
      if (call === 1) return makeQueryChain({ data: { id: "algo-1" }, error: null });
      return makeQueryChain({ data: null, error: { message: "rls boom" } });
    });
    const res = await GET(makeRequest(), CTX);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("rls boom");
  });

  it("sets a Cache-Control header (private, max-age=10, SWR)", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    let call = 0;
    fromMock.mockImplementation(() => {
      call++;
      if (call === 1) return makeQueryChain({ data: { id: "algo-1" }, error: null });
      return makeQueryChain({ data: [], error: null });
    });
    const res = await GET(makeRequest(), CTX);
    const cc = res.headers.get("Cache-Control");
    expect(cc).toContain("private");
    expect(cc).toContain("max-age=10");
    expect(cc).toContain("stale-while-revalidate");
  });
});
