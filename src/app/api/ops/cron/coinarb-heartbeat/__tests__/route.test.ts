// Integration test for /api/ops/cron/coinarb-heartbeat POST handler.
//
// Cron que detecta stale heartbeats en crypto algorithms y dispara push
// notifications con dedup vía app_logs.fingerprint. Covers:
//   1. 401 cuando validateBearerToken rechaza.
//   2. 500 cuando faltan Supabase env vars.
//   3. 500 cuando algorithms select tira.
//   4. checked=0 cuando no hay crypto algorithms.
//   5. Healthy algo (heartbeat < 300s) → no alert, no log.
//   6. Stale algo (heartbeat > 300s) + no dedup row → fetch push + log
//      con notified=true.
//   7. Stale algo + dedup row reciente → NO fetch push pero SÍ log
//      con notified=false (mensaje "suppressed by dedup").
//   8. No telemetry row → ageSec=Infinity → notify con mensaje "nunca ha
//      enviado heartbeat" + age_seconds=null en meta.
//   9. Push fetch failure non-blocking → log + response sigue ok.

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
  return new NextRequest("http://localhost/api/ops/cron/coinarb-heartbeat", {
    method:  "POST",
    headers: { authorization: "Bearer ops-secret" },
  });
}

interface AlgoRow { id: string; user_id: string; name: string }
interface TeleRow { last_heartbeat_at: string | null }
interface DedupRow { id: string }
interface AppLogInsert {
  user_id: string;
  level: string;
  area: string;
  message: string;
  meta: Record<string, unknown>;
  fingerprint: string;
}

function setupSupabase({
  algos = [],
  algoError,
  telemetryByAlgo = {},
  dedupByAlgo = {},
}: {
  algos?:           AlgoRow[];
  algoError?:       { message: string };
  telemetryByAlgo?: Record<string, TeleRow | null>;
  dedupByAlgo?:     Record<string, DedupRow | null>;
}) {
  const appLogInserts: AppLogInsert[] = [];

  createClientMock.mockReturnValue({
    from: (table: string) => {
      if (table === "algorithms") {
        const proxy: Record<string, unknown> = {};
        proxy.select = () => proxy;
        proxy.eq     = () => proxy;
        proxy.is     = () => proxy;
        proxy.then = (resolve: (v: unknown) => unknown) =>
          Promise.resolve({ data: algos, error: algoError ?? null }).then(resolve);
        return proxy;
      }
      if (table === "coinarb_telemetry") {
        let currentAlgo: string | null = null;
        const proxy: Record<string, unknown> = {};
        proxy.select = () => proxy;
        proxy.eq = (col: string, val: string) => {
          if (col === "agent_id") currentAlgo = val;
          return proxy;
        };
        proxy.order = () => proxy;
        proxy.limit = () => proxy;
        proxy.maybeSingle = () => {
          const tele = telemetryByAlgo[currentAlgo ?? ""];
          return Promise.resolve({ data: tele ?? null, error: null });
        };
        return proxy;
      }
      if (table === "app_logs") {
        let currentFingerprint: string | null = null;
        const proxy: Record<string, unknown> = {};
        proxy.select = () => proxy;
        proxy.eq = (col: string, val: string) => {
          if (col === "fingerprint") currentFingerprint = val;
          return proxy;
        };
        proxy.gte = () => proxy;
        proxy.limit = () => proxy;
        proxy.maybeSingle = () => {
          // fingerprint format: 'coinarb_heartbeat_stale:<algoId>'
          const algoId = currentFingerprint?.replace("coinarb_heartbeat_stale:", "") ?? "";
          const dedup = dedupByAlgo[algoId];
          return Promise.resolve({ data: dedup ?? null, error: null });
        };
        proxy.insert = (row: unknown) => {
          appLogInserts.push(row as AppLogInsert);
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

  return { appLogInserts };
}

describe("/api/ops/cron/coinarb-heartbeat — handler", () => {
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

  it("returns 500 when algorithms select errors", async () => {
    setupSupabase({ algoError: { message: "rls denied" } });
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("rls denied");
  });

  it("returns checked=0 when there are no crypto algorithms", async () => {
    setupSupabase({ algos: [] });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.checked).toBe(0);
  });

  it("healthy algo (heartbeat < 300s) → no alert, no insert", async () => {
    const { appLogInserts } = setupSupabase({
      algos: [{ id: "a1", user_id: "u1", name: "Coinarb" }],
      telemetryByAlgo: { a1: { last_heartbeat_at: new Date(Date.now() - 60_000).toISOString() } },
    });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const res = await POST(makeRequest());
    const body = await res.json();
    expect(body.checked).toBe(1);
    expect(body.stale).toBe(0);
    expect(appLogInserts).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stale algo + no dedup row → fetch push + log notified=true", async () => {
    const staleIso = new Date(Date.now() - 600_000).toISOString();  // 10min ago
    const { appLogInserts } = setupSupabase({
      algos: [{ id: "a1", user_id: "u1", name: "Coinarb" }],
      telemetryByAlgo: { a1: { last_heartbeat_at: staleIso } },
      dedupByAlgo: { a1: null },
    });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const res = await POST(makeRequest());
    const body = await res.json();
    expect(body.stale).toBe(1);
    expect(body.alerts[0]).toMatchObject({ id: "a1", notified: true });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/push/notify-user"),
      expect.objectContaining({ method: "POST" }),
    );
    expect(appLogInserts[0]).toMatchObject({
      area: "coinarb-heartbeat",
      fingerprint: "coinarb_heartbeat_stale:a1",
    });
    expect(appLogInserts[0].meta.notified).toBe(true);
  });

  it("stale algo + recent dedup row → NO push but logs with notified=false", async () => {
    const staleIso = new Date(Date.now() - 600_000).toISOString();
    const { appLogInserts } = setupSupabase({
      algos: [{ id: "a1", user_id: "u1", name: "Coinarb" }],
      telemetryByAlgo: { a1: { last_heartbeat_at: staleIso } },
      dedupByAlgo: { a1: { id: "log-existing" } },
    });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const res = await POST(makeRequest());
    const body = await res.json();
    expect(body.alerts[0]).toMatchObject({ notified: false });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(appLogInserts[0].message).toMatch(/suppressed by dedup/i);
    expect(appLogInserts[0].meta.notified).toBe(false);
  });

  it("no telemetry row → ageSec=Infinity → notify mentions 'nunca ha enviado'", async () => {
    const { appLogInserts } = setupSupabase({
      algos: [{ id: "a1", user_id: "u1", name: "Coinarb" }],
      telemetryByAlgo: { a1: null },
      dedupByAlgo: { a1: null },
    });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await POST(makeRequest());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const pushCall = fetchMock.mock.calls[0];
    const initArg = pushCall[1] as { body: string };
    const pushBody = JSON.parse(initArg.body);
    expect(pushBody.body).toMatch(/nunca ha enviado heartbeat/i);
    // age_seconds=null when Infinity
    expect(appLogInserts[0].meta.age_seconds).toBeNull();
  });

  it("push fetch failure non-blocking → still logs and returns ok", async () => {
    const staleIso = new Date(Date.now() - 600_000).toISOString();
    const { appLogInserts } = setupSupabase({
      algos: [{ id: "a1", user_id: "u1", name: "Coinarb" }],
      telemetryByAlgo: { a1: { last_heartbeat_at: staleIso } },
      dedupByAlgo: { a1: null },
    });
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("network ECONNREFUSED")) as unknown as typeof fetch;

    const res = await POST(makeRequest());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    // Log still happens even when push fetch throws.
    expect(appLogInserts).toHaveLength(1);
  });
});
