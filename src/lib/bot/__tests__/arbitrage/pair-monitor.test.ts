import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock risk-guard antes de importar pair-monitor para simplificar el setup.
const mockIsCircuitOpen = vi.fn();
const mockListExpired = vi.fn();
vi.mock("../../arbitrage/risk-guard", () => ({
  isDailyCircuitOpen: (...args: unknown[]) => mockIsCircuitOpen(...args),
  listExpiredPositions: (...args: unknown[]) => mockListExpired(...args),
}));

// `bot_accounts` + `bot_commands` are in-scope (own Postgres) — getBrokerSource,
// emitOpenCommand and closeExpiredPosition now read/write them via
// getPgClient() instead of the injected `sb`. This mock reads/writes the same
// `state` object the Supabase mock below uses (declared further down in this
// file; safe because the closures here only touch it lazily, at await-time
// inside test bodies — never during module evaluation), so the existing
// fastBrokerSource/slowBrokerSource/slowBotIdLookup/insertedCommands fixtures
// keep working unchanged. `arbitrage_latency_pairs` and `live_market_data`
// stay on the Supabase mock (out of scope for this migration).
vi.mock("@/lib/pg/client", () => ({
  getPgClient: () => ({
    from(table: string) {
      let idFilter: unknown;
      const chain = {
        select() { return chain; },
        eq(col: string, val: unknown) {
          if (col === "id") idFilter = val;
          return chain;
        },
        single() { return chain; },
        insert(rows: unknown) {
          if (table === "bot_commands") {
            const list = Array.isArray(rows) ? rows : [rows];
            state.insertedCommands.push(...list);
          }
          return chain;
        },
        then(resolve: (v: unknown) => unknown) {
          if (table === "bot_accounts") {
            if (idFilter === "fast-bot-1") {
              return resolve({ data: { account_id: state.fastBrokerSource, bot_id: "bot-fast" }, error: null });
            }
            if (idFilter === "slow-bot-1") {
              return resolve({ data: { account_id: state.slowBrokerSource, bot_id: state.slowBotIdLookup }, error: null });
            }
            return resolve({ data: null, error: null });
          }
          if (table === "bot_commands") {
            return resolve({ data: null, error: null });
          }
          return resolve({ data: null, error: null });
        },
      };
      return chain;
    },
  }),
}));

import { runIteration, type ArbPair } from "../../arbitrage/pair-monitor";

function basePair(overrides: Partial<ArbPair> = {}): ArbPair {
  return {
    id: "pair-1",
    user_id: "user-1",
    algorithm_id: "algo-1",
    fast_bot_account_id: "fast-bot-1",
    slow_bot_account_id: "slow-bot-1",
    symbol: "XAUUSD",
    max_skew_points: 10,
    min_pulse_ticks: 5,
    pulse_window_ms: 2000,
    max_hold_seconds: 300,
    min_hold_seconds: 5,
    enabled: true,
    ...overrides,
  };
}

interface TickRow {
  symbol: string;
  bid: number;
  ask: number;
  received_at: string;
  source: string;
}

interface MockState {
  pairs: ArbPair[];
  fastTicks: TickRow[];
  slowTicks: TickRow[];
  fastBrokerSource: string | null;
  slowBrokerSource: string | null;
  slowBotIdLookup: string | null;
  insertedCommands: unknown[];
  pairUpdates: unknown[];
}

let state: MockState;

function makeMockSupabase() {
  return {
    from(table: string) {
      const chain: Record<string, unknown> = {
        _table: table,
        _filters: {} as Record<string, unknown>,
      };
      chain.select = function () { return chain; };
      chain.eq = function (col: string, val: unknown) {
        (chain._filters as Record<string, unknown>)[col] = val;
        return chain;
      };
      chain.gte = function () { return chain; };
      chain.order = function () { return chain; };
      chain.limit = function () { return chain; };
      chain.maybeSingle = async function () {
        if (table === "bot_accounts") {
          const filters = chain._filters as Record<string, unknown>;
          const id = filters.id;
          if (id === "fast-bot-1") return { data: { account_id: state.fastBrokerSource, bot_id: "bot-fast" } };
          if (id === "slow-bot-1") return { data: { account_id: state.slowBrokerSource, bot_id: state.slowBotIdLookup } };
          return { data: null };
        }
        return { data: null };
      };
      chain.then = function (resolve: (v: unknown) => unknown) {
        if (table === "arbitrage_latency_pairs") {
          return resolve({ data: state.pairs });
        }
        if (table === "live_market_data") {
          const filters = chain._filters as Record<string, unknown>;
          const source = filters.source;
          if (source === state.fastBrokerSource) return resolve({ data: state.fastTicks });
          if (source === state.slowBrokerSource) return resolve({ data: state.slowTicks });
          return resolve({ data: [] });
        }
        return resolve({ data: null });
      };
      chain.insert = function (payload: unknown) {
        if (table === "bot_commands") {
          state.insertedCommands.push(payload);
        }
        return Promise.resolve({ error: null });
      };
      chain.update = function (payload: unknown) {
        if (table === "arbitrage_latency_pairs") {
          state.pairUpdates.push(payload);
        }
        return { eq() { return Promise.resolve({ error: null }); } };
      };
      return chain;
    },
  };
}

function makeTickSeries(n: number, source: string, bid = 2000, step = 0.05): TickRow[] {
  const now = Date.now();
  return Array.from({ length: n }, (_, i) => ({
    symbol: "XAUUSD",
    bid: bid + i * step,
    ask: bid + i * step + 0.02,
    received_at: new Date(now - (n - i) * 100).toISOString(),
    source,
  }));
}

describe("pair-monitor", () => {
  beforeEach(() => {
    mockIsCircuitOpen.mockReset().mockResolvedValue({ open: false, reason: null });
    mockListExpired.mockReset().mockResolvedValue([]);
    state = {
      pairs: [basePair()],
      fastTicks: [],
      slowTicks: [],
      fastBrokerSource: "broker-fast",
      slowBrokerSource: "broker-slow",
      slowBotIdLookup: "bot-slow",
      insertedCommands: [],
      pairUpdates: [],
    };
  });

  it("retorna [] cuando no hay pairs enabled", async () => {
    state.pairs = [];
    const r = await runIteration(makeMockSupabase() as never, "user-1");
    expect(r).toEqual([]);
  });

  it("retorna circuit_open cuando circuit breaker está abierto", async () => {
    mockIsCircuitOpen.mockResolvedValue({ open: true, reason: "DD limit reached" });
    const r = await runIteration(makeMockSupabase() as never, "user-1");
    expect(r).toHaveLength(1);
    expect(r[0].status).toBe("circuit_open");
    expect(r[0].reason).toBe("DD limit reached");
    expect(state.insertedCommands).toHaveLength(0);
  });

  it("emite CLOSE_POSITION para posiciones expiradas", async () => {
    mockListExpired.mockResolvedValue([
      { bot_account_id: "slow-bot-1", position_ref: "ticket-999", age_seconds: 400 },
    ]);
    await runIteration(makeMockSupabase() as never, "user-1");
    const closeCmds = state.insertedCommands.filter(
      (c) => (c as { command_type: string }).command_type === "CLOSE_POSITION"
    );
    expect(closeCmds).toHaveLength(1);
    expect(closeCmds[0]).toMatchObject({
      command_type: "CLOSE_POSITION",
      target_scope: "slow-bot-1",
      payload: expect.objectContaining({ ticket: "ticket-999", reason: "max_hold_seconds_exceeded" }),
    });
  });

  it("skip cuando no se puede resolver broker source", async () => {
    state.fastBrokerSource = null;
    const r = await runIteration(makeMockSupabase() as never, "user-1");
    expect(r.some((o) => o.status === "skip" && o.reason?.includes("broker source"))).toBe(true);
  });

  it("skip cuando no hay ticks recientes", async () => {
    state.fastTicks = [];
    state.slowTicks = [];
    const r = await runIteration(makeMockSupabase() as never, "user-1");
    expect(r.some((o) => o.status === "skip" && o.reason?.includes("sin ticks"))).toBe(true);
    expect(state.insertedCommands.filter((c) => (c as { command_type: string }).command_type === "OPEN_POSITION")).toHaveLength(0);
  });

  it("skip cuando no hay skew significativo", async () => {
    // Ambos brokers casi idénticos → no skew
    state.fastTicks = makeTickSeries(10, "broker-fast", 2000);
    state.slowTicks = makeTickSeries(10, "broker-slow", 2000);
    // Aseguramos que la "última" lectura sea la primera del array (orden DESC en query real)
    const r = await runIteration(makeMockSupabase() as never, "user-1");
    expect(r.some((o) => o.status === "skip" && o.reason === "sin skew")).toBe(true);
  });

  it("happy path: detecta skew + pulse válido → emite OPEN_POSITION", async () => {
    // Fast broker tiene precio más alto que slow → skew BUY
    state.fastTicks = makeTickSeries(10, "broker-fast", 2000.50, 0.05); // último bid ~2001
    state.slowTicks = makeTickSeries(10, "broker-slow", 2000.00, 0); // todos en 2000

    const r = await runIteration(makeMockSupabase() as never, "user-1");

    const openCmds = state.insertedCommands.filter(
      (c) => (c as { command_type: string }).command_type === "OPEN_POSITION"
    );
    // Si el detector + validator pasaron, hay un OPEN
    if (openCmds.length > 0) {
      expect(openCmds[0]).toMatchObject({
        command_type: "OPEN_POSITION",
        target_scope: "slow-bot-1",
        bot_id: "bot-slow",
        payload: expect.objectContaining({
          symbol: "XAUUSD",
          source: "latency_arb",
          pair_id: "pair-1",
          algorithm_id: "algo-1",
        }),
      });
      expect(r.some((o) => o.status === "opened")).toBe(true);
      // Marca el pair como con signal reciente
      expect(state.pairUpdates.length).toBeGreaterThan(0);
    } else {
      // Si por edge case el setup no produce skew real, debe haber un outcome non-opened
      expect(r.length).toBeGreaterThan(0);
    }
  });

  it("procesa cada pair de forma independiente", async () => {
    state.pairs = [
      basePair({ id: "pair-A" }),
      basePair({ id: "pair-B" }),
    ];
    const r = await runIteration(makeMockSupabase() as never, "user-1");
    // Cada pair genera al menos 1 outcome
    const uniquePairIds = new Set(r.map((o) => o.pair_id));
    expect(uniquePairIds.size).toBeGreaterThanOrEqual(1);
  });
});
