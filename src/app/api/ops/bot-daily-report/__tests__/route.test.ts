// Integration test for /api/ops/bot-daily-report GET handler.
//
// Endpoint del dashboard ops que muestra el último DAILY_VERIFICATION
// event por profile (forex/futuros). Covers:
//   1. 401 cuando auth falla.
//   2. 500 cuando bots select tira.
//   3. Empty result cuando user no tiene bots.
//   4. Empty result cuando no hay eventos DAILY_VERIFICATION.
//   5. Happy path: latest + byProfile.forex/futuros con shapes correctos.
//   6. byProfile.forex = null cuando solo hay eventos de futuros.
//   7. Defaults (UNKNOWN status, null marketPolicy) cuando payload es vacío.
//   8. Recommendations array preservado del latest event.
//   9. Cache-Control header con no-store.
//  10. 500 cuando bot_events select tira.

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

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

let GET: () => Promise<Response>;
beforeAll(async () => {
  const mod = await import("../route");
  GET = mod.GET;
});

function makeChain(result: { data?: unknown; error?: unknown }) {
  const proxy: Record<string, unknown> = {};
  const chainable = ["select", "eq", "in", "is", "order", "limit"];
  for (const m of chainable) proxy[m] = () => proxy;
  proxy.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return proxy;
}

interface BotRow { id: string; name: string }
interface EventRow {
  id: string;
  bot_id: string;
  created_at: string;
  payload: {
    profile?: "forex" | "futuros";
    generatedAt?: string;
    overallStatus?: string;
    marketPolicy?: string | null;
    recommendations?: string[];
    sloSummary?: unknown;
    health?: unknown;
  };
}

function setupSupabase({
  bots, botsError, events, eventsError,
}: {
  bots?:        BotRow[] | null;
  botsError?:   { message: string };
  events?:      EventRow[] | null;
  eventsError?: { message: string };
}) {
  fromMock.mockImplementation((table: string) => {
    if (table === "bots")       return makeChain({ data: bots ?? [], error: botsError ?? null });
    if (table === "bot_events") return makeChain({ data: events ?? [], error: eventsError ?? null });
    return makeChain({ data: null, error: null });
  });
}

describe("/api/ops/bot-daily-report — handler", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    fromMock.mockReset();
  });

  it("returns 401 when auth fails", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "x" } });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 500 when bots select errors", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    setupSupabase({ bots: null, botsError: { message: "rls denied" } });
    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/Failed to load bot profiles/i);
  });

  it("returns null fields when user has no bots", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    setupSupabase({ bots: [] });
    const res = await GET();
    const body = await res.json();
    expect(body).toMatchObject({
      ok: true,
      latest: null,
      byProfile: { forex: null, futuros: null },
      recommendations: [],
    });
  });

  it("returns null fields when there are no DAILY_VERIFICATION events", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    setupSupabase({
      bots: [{ id: "b1", name: "Forex bot" }],
      events: [],
    });
    const res = await GET();
    const body = await res.json();
    expect(body.latest).toBeNull();
    expect(body.byProfile.forex).toBeNull();
    expect(body.byProfile.futuros).toBeNull();
  });

  it("happy path: latest + byProfile.forex/futuros con shape correcto", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    setupSupabase({
      bots: [{ id: "b1", name: "Forex" }, { id: "b2", name: "Futuros" }],
      events: [
        {
          id: "e1", bot_id: "b1", created_at: "2026-06-14T10:00:00Z",
          payload: {
            profile: "forex",
            generatedAt: "2026-06-14T09:59:00Z",
            overallStatus: "PASS",
            marketPolicy: "auto",
            recommendations: ["Sistema operando normalmente"],
            sloSummary: { checks: 0 },
            health: { checks: [] },
          },
        },
        {
          id: "e2", bot_id: "b2", created_at: "2026-06-14T09:00:00Z",
          payload: {
            profile: "futuros",
            generatedAt: "2026-06-14T08:59:00Z",
            overallStatus: "DEGRADED",
            marketPolicy: "manual",
            recommendations: ["Revisar estado del bot"],
            sloSummary: { checks: 1 },
            health: { checks: [{ code: "STALE_HB" }] },
          },
        },
      ],
    });

    const res = await GET();
    const body = await res.json();
    expect(body.latest).toMatchObject({
      id: "e1",
      overallStatus: "PASS",
      marketPolicy: "auto",
    });
    expect(body.byProfile.forex).toMatchObject({
      id: "e1",
      overallStatus: "PASS",
      sloSummary: { checks: 0 },
    });
    expect(body.byProfile.futuros).toMatchObject({
      id: "e2",
      overallStatus: "DEGRADED",
    });
    expect(body.recommendations).toEqual(["Sistema operando normalmente"]);
  });

  it("byProfile.forex = null when only futuros events exist", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    setupSupabase({
      bots: [{ id: "b2", name: "Futuros" }],
      events: [{
        id: "e2", bot_id: "b2", created_at: "2026-06-14T10:00:00Z",
        payload: { profile: "futuros", overallStatus: "PASS" },
      }],
    });
    const res = await GET();
    const body = await res.json();
    expect(body.byProfile.forex).toBeNull();
    expect(body.byProfile.futuros).not.toBeNull();
  });

  it("defaults: UNKNOWN status + null marketPolicy cuando payload incompleto", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    setupSupabase({
      bots: [{ id: "b1", name: "Forex" }],
      events: [{
        id: "e1", bot_id: "b1", created_at: "2026-06-14T10:00:00Z",
        payload: {},  // ← empty payload
      }],
    });
    const res = await GET();
    const body = await res.json();
    expect(body.latest.overallStatus).toBe("UNKNOWN");
    expect(body.latest.marketPolicy).toBeNull();
  });

  it("recommendations preservadas como array desde el latest event", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    setupSupabase({
      bots: [{ id: "b1", name: "Forex" }],
      events: [{
        id: "e1", bot_id: "b1", created_at: "2026-06-14T10:00:00Z",
        payload: { recommendations: ["a", "b", "c"] },
      }],
    });
    const res = await GET();
    const body = await res.json();
    expect(body.recommendations).toEqual(["a", "b", "c"]);
  });

  it("Cache-Control header is no-store on the happy path response", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    // Cache-Control header is only set on the happy-path branch (events>0),
    // not on the empty-bots / empty-events early returns.
    setupSupabase({
      bots: [{ id: "b1", name: "Forex" }],
      events: [{
        id: "e1", bot_id: "b1", created_at: "2026-06-14T10:00:00Z",
        payload: { profile: "forex", overallStatus: "PASS" },
      }],
    });
    const res = await GET();
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });

  it("returns 500 when bot_events select errors", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    setupSupabase({
      bots: [{ id: "b1", name: "Forex" }],
      events: null,
      eventsError: { message: "events rls denied" },
    });
    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/Failed to load daily verification events/i);
  });
});
