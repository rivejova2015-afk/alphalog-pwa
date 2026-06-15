// Integration test for /api/ops/alert-summary GET handler.
//
// Aggrega ops_alert_history rows por (job_name, severity) sobre las últimas
// N horas. Covers:
//   1. 401 cuando auth falla.
//   2. 500 cuando ops_alert_history select tira.
//   3. total_events=0 + buckets=[] cuando no hay rows.
//   4. Hours param clamping: default 24, max 168, min 1, parseFloat NaN → 24.
//   5. Buckets agregados por (job_name, severity) con count + last_message
//      + last_at del más reciente.
//   6. Buckets sort: critical > error > warning > info, luego por count desc.
//   7. Cache-Control header con max-age=30 + SWR.

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { getUserMock, serviceFromMock } = vi.hoisted(() => ({
  getUserMock:     vi.fn(),
  serviceFromMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient:        async () => ({ auth: { getUser: getUserMock } }),
  createServiceClient: () => ({ from: serviceFromMock }),
}));
vi.mock("@/lib/log", () => ({
  logError: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn(),
}));

let GET: (req: NextRequest) => Promise<Response>;
beforeAll(async () => {
  const mod = await import("../route");
  GET = mod.GET;
});

function makeAwaitableChain(result: { data?: unknown; error?: unknown }) {
  const proxy: Record<string, unknown> = {};
  const chainable = ["select", "gte", "order", "limit", "eq"];
  for (const m of chainable) proxy[m] = () => proxy;
  proxy.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return proxy;
}

function makeRequest(qs = ""): NextRequest {
  return new NextRequest(`http://localhost/api/ops/alert-summary${qs}`, { method: "GET" });
}

describe("/api/ops/alert-summary — handler", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    serviceFromMock.mockReset();
  });

  it("returns 401 when auth fails", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "x" } });
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(serviceFromMock).not.toHaveBeenCalled();
  });

  it("returns 500 when ops_alert_history select errors", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    serviceFromMock.mockReturnValue(makeAwaitableChain({ data: null, error: { message: "rls denied" } }));
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/Failed to fetch alerts/i);
  });

  it("returns total_events=0 + buckets=[] when no alert rows", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    serviceFromMock.mockReturnValue(makeAwaitableChain({ data: [], error: null }));
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total_events).toBe(0);
    expect(body.buckets).toEqual([]);
    expect(body.hours).toBe(24);
  });

  it("hours query param clamps into [1, 168] with default 24", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    serviceFromMock.mockReturnValue(makeAwaitableChain({ data: [], error: null }));

    for (const { qs, expected } of [
      { qs: "?hours=48",   expected: 48 },
      { qs: "?hours=0",    expected: 24 },   // 0 || 24 → 24
      { qs: "?hours=-50",  expected: 1 },    // Math.max(1, -50) → 1
      { qs: "?hours=9999", expected: 168 },  // Math.min(168, 9999)
      { qs: "?hours=abc",  expected: 24 },   // NaN || 24
    ]) {
      const res = await GET(makeRequest(qs));
      const body = await res.json();
      expect(body.hours).toBe(expected);
    }
  });

  it("aggregates buckets por (job_name, severity) con count y last_message del MÁS RECIENTE", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    // Rows sorted DESC por created_at (más recientes primero — así viene del DB).
    serviceFromMock.mockReturnValue(makeAwaitableChain({
      data: [
        { job_name: "bot-slo-monitor", severity: "critical", message: "latest critical", created_at: "2026-06-14T10:00:00Z" },
        { job_name: "bot-slo-monitor", severity: "critical", message: "older critical",  created_at: "2026-06-14T09:00:00Z" },
        { job_name: "bot-slo-monitor", severity: "critical", message: "oldest critical", created_at: "2026-06-14T08:00:00Z" },
        { job_name: "polyarb-heartbeat", severity: "warning", message: "warn 1", created_at: "2026-06-14T09:30:00Z" },
      ],
      error: null,
    }));

    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.total_events).toBe(4);
    const critical = body.buckets.find((b: { severity: string }) => b.severity === "critical");
    expect(critical).toMatchObject({
      job_name: "bot-slo-monitor",
      count: 3,
      last_message: "latest critical",  // primer row procesado (más reciente)
      last_at: "2026-06-14T10:00:00Z",
    });
  });

  it("buckets sort: critical > error > warning > info, luego count desc", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    serviceFromMock.mockReturnValue(makeAwaitableChain({
      data: [
        { job_name: "j1", severity: "info",     message: "x", created_at: "2026-06-14T00:00:00Z" },
        { job_name: "j2", severity: "warning",  message: "x", created_at: "2026-06-14T00:00:00Z" },
        { job_name: "j2", severity: "warning",  message: "x", created_at: "2026-06-14T00:00:00Z" },
        { job_name: "j3", severity: "error",    message: "x", created_at: "2026-06-14T00:00:00Z" },
        { job_name: "j4", severity: "critical", message: "x", created_at: "2026-06-14T00:00:00Z" },
        { job_name: "j4", severity: "critical", message: "x", created_at: "2026-06-14T00:00:00Z" },
      ],
      error: null,
    }));

    const res = await GET(makeRequest());
    const body = await res.json();
    const severities = body.buckets.map((b: { severity: string }) => b.severity);
    expect(severities).toEqual(["critical", "error", "warning", "info"]);
  });

  it("Cache-Control header has private + max-age=30 + SWR", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    serviceFromMock.mockReturnValue(makeAwaitableChain({ data: [], error: null }));
    const res = await GET(makeRequest());
    const cc = res.headers.get("Cache-Control");
    expect(cc).toContain("private");
    expect(cc).toContain("max-age=30");
    expect(cc).toContain("stale-while-revalidate");
  });
});
