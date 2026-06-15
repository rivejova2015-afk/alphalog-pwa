// Integration test for /api/ops/cron/polyarb-heartbeat POST handler.
//
// Cron simple (sin dedup) que detecta stale heartbeats en polyarb_agents
// con status='RUNNING'. Inserta circuit_breaker_event + push. Covers:
//   1. 401 cuando validateBearerToken rechaza.
//   2. 500 cuando faltan Supabase env vars.
//   3. checked=0 cuando agents select retorna [].
//   4. checked=0 cuando agents select tira (handler trata como vacío).
//   5. Healthy agent (hb < 60s) → no alert, no insert.
//   6. Stale > 60s → alerta + insert circuit_breaker_events con severity='S2'.
//   7. Stale > 300s → severity='S1' (más severa).
//   8. last_heartbeat_at null → ageSec=Infinity → alerta.
//   9. Push fetch failure non-blocking → response sigue ok=true.

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { createClientMock, validateBearerMock } = vi.hoisted(() => ({
  createClientMock:   vi.fn(),
  validateBearerMock: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({ createClient: createClientMock }));
vi.mock("@/lib/security/timing", () => ({ validateBearerToken: validateBearerMock }));

let POST: (req: NextRequest) => Promise<Response>;
beforeAll(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  process.env.OPS_CRON_SECRET = "ops-secret";
  process.env.NEXT_PUBLIC_APP_URL = "https://test.alphalog.io";
  process.env.INTERNAL_API_SECRET = "internal-secret";
  const mod = await import("../route");
  POST = mod.POST;
});

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/ops/cron/polyarb-heartbeat", {
    method: "POST",
    headers: { authorization: "Bearer ops-secret" },
  });
}

interface AgentRow { id: string; user_id: string; name: string; last_heartbeat_at: string | null }

function setupSupabase({
  agents = [],
  agentsError,
}: {
  agents?:      AgentRow[];
  agentsError?: { message: string };
}) {
  const circuitBreakerInserts: Record<string, unknown>[] = [];

  createClientMock.mockReturnValue({
    from: (table: string) => {
      if (table === "polyarb_agents") {
        const proxy: Record<string, unknown> = {};
        proxy.select = () => proxy;
        proxy.eq     = () => proxy;
        proxy.is     = () => proxy;
        proxy.then = (resolve: (v: unknown) => unknown) =>
          Promise.resolve({ data: agents, error: agentsError ?? null }).then(resolve);
        return proxy;
      }
      if (table === "polyarb_circuit_breaker_events") {
        const proxy: Record<string, unknown> = {};
        proxy.insert = (row: Record<string, unknown>) => {
          circuitBreakerInserts.push(row);
          return Promise.resolve({ error: null });
        };
        return proxy;
      }
      const fallback: Record<string, unknown> = {};
      fallback.select = () => fallback;
      fallback.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(resolve);
      return fallback;
    },
  });

  return { circuitBreakerInserts };
}

describe("/api/ops/cron/polyarb-heartbeat — handler", () => {
  beforeEach(() => {
    createClientMock.mockReset();
    validateBearerMock.mockReset();
    validateBearerMock.mockReturnValue({ ok: true });
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as unknown as typeof fetch;
  });

  it("returns 401 when validateBearerToken rejects", async () => {
    validateBearerMock.mockReturnValue({ ok: false, error: "Unauthorized", status: 401 });
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 500 when Supabase env vars are missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  });

  it("returns checked=0 when there are no RUNNING agents", async () => {
    setupSupabase({ agents: [] });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.checked).toBe(0);
  });

  it("returns checked=0 when agents select errors (handler treats as empty)", async () => {
    setupSupabase({ agentsError: { message: "rls boom" } });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.checked).toBe(0);
  });

  it("healthy agent (hb < 60s) → no alert, no circuit_breaker insert", async () => {
    const freshIso = new Date(Date.now() - 30_000).toISOString();
    const { circuitBreakerInserts } = setupSupabase({
      agents: [{ id: "a1", user_id: "u1", name: "PolyArb", last_heartbeat_at: freshIso }],
    });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const res = await POST(makeRequest());
    const body = await res.json();
    expect(body.checked).toBe(1);
    expect(body.alerts).toEqual([]);
    expect(circuitBreakerInserts).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stale > 60s, < 300s → severity='S2' circuit_breaker insert + push", async () => {
    const staleIso = new Date(Date.now() - 120 * 1000).toISOString();
    const { circuitBreakerInserts } = setupSupabase({
      agents: [{ id: "a1", user_id: "u1", name: "PolyArb", last_heartbeat_at: staleIso }],
    });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const res = await POST(makeRequest());
    const body = await res.json();
    expect(body.alerts).toHaveLength(1);
    expect(body.alerts[0]).toMatch(/PolyArb: stale 12\ds/);

    expect(circuitBreakerInserts).toHaveLength(1);
    expect(circuitBreakerInserts[0]).toMatchObject({
      user_id:      "u1",
      agent_id:     "a1",
      trigger_type: "HEARTBEAT_STALE",
      severity:     "S2",
      action_taken: "WARN",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/push/notify-user"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("stale > 300s → severity='S1' (más severa)", async () => {
    const veryStaleIso = new Date(Date.now() - 600 * 1000).toISOString();  // 10 min
    const { circuitBreakerInserts } = setupSupabase({
      agents: [{ id: "a1", user_id: "u1", name: "PolyArb", last_heartbeat_at: veryStaleIso }],
    });
    await POST(makeRequest());
    expect(circuitBreakerInserts[0].severity).toBe("S1");
  });

  it("null last_heartbeat_at → ageSec=Infinity → triggers alert", async () => {
    const { circuitBreakerInserts } = setupSupabase({
      agents: [{ id: "a1", user_id: "u1", name: "PolyArb", last_heartbeat_at: null }],
    });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const res = await POST(makeRequest());
    const body = await res.json();
    expect(body.alerts).toHaveLength(1);
    expect(circuitBreakerInserts).toHaveLength(1);
    expect(circuitBreakerInserts[0].severity).toBe("S1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("push fetch failure non-blocking → response sigue ok=true", async () => {
    const staleIso = new Date(Date.now() - 120 * 1000).toISOString();
    setupSupabase({
      agents: [{ id: "a1", user_id: "u1", name: "PolyArb", last_heartbeat_at: staleIso }],
    });
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("network ECONNREFUSED")) as unknown as typeof fetch;

    const res = await POST(makeRequest());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.alerts).toHaveLength(1);
  });
});
