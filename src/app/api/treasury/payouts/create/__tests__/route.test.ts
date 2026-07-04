// Integration tests for POST /api/treasury/payouts/create.
//
// This route previously had 0 coverage despite creating real financial
// records. Covers:
//   - auth/step-up/rate-limit/validation gates
//   - blocked-reason short-circuits (409)
//   - the cycle-math regression (withdrawal_day clamped via
//     payoutEngine.computeCycleStart, same bug as payouts/preview)
//   - tax_buffer_accumulated now actually increments on a successful payout
//     (previously never written anywhere — confirmed gap in the 2026-07
//     maturity audit)

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";

const {
  createServerClientMock,
  cookiesMock,
  requireFreshStepUpMock,
  checkAiRateLimitMock,
} = vi.hoisted(() => ({
  createServerClientMock: vi.fn(),
  cookiesMock: vi.fn(),
  requireFreshStepUpMock: vi.fn(),
  checkAiRateLimitMock: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({ createServerClient: createServerClientMock }));
vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("@/lib/log", () => ({ logError: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn() }));
vi.mock("@/lib/security/stepUp", () => ({
  requireFreshStepUp: (...args: unknown[]) => requireFreshStepUpMock(...args),
}));
vi.mock("@/lib/security/aiRateLimit", () => ({
  checkAiRateLimit: (...args: unknown[]) => checkAiRateLimitMock(...args),
}));
vi.mock("@/lib/security/integrity", () => ({
  computeIntegrityHash: () => "fake-hash",
}));
vi.mock("@/lib/security/encryption", () => ({
  encryptNumeric: (_domain: string, v: number) => `enc:${v}`,
  encryptForDomain: (_domain: string, v: string) => `enc:${v}`,
}));

let POST: (req: Request) => Promise<Response>;
beforeAll(async () => {
  const mod = await import("../route");
  POST = mod.POST;
});

const ACCOUNT_ID = "9c858901-8a57-4791-81c0-0c79c8500abf";

const ACCOUNT = {
  id: ACCOUNT_ID,
  name: "Cuenta 1",
  account_size: 10_000,
  current_balance: 11_000,
  phase_status: "funded",
  withdrawals_enabled: true,
};

const CONFIG = {
  id: "cfg-1",
  account_id: ACCOUNT_ID,
  withdrawal_day: 30,
  split_mode: "growth",
  balance_threshold: null,
  anti_drawdown_active: false,
  anti_drawdown_threshold: 20,
  tax_buffer_percentage: 30,
  tax_buffer_accumulated: 200,
  wallet_id: "wallet-1",
};

const TRADE = {
  id: "t-1",
  account_id: ACCOUNT_ID,
  entry_date: "2026-03-01",
  exit_date: "2026-03-01",
  created_at: "2026-03-01",
  pnl: 1000,
  status: "Closed",
};

interface RouteState {
  account?: { data: unknown; error?: unknown } | null;
  config?: { data: unknown; error?: unknown } | null;
  trades?: unknown[];
  existingPayouts?: unknown[];
  insertResult?: { data: unknown; error?: unknown };
  configUpdateCalls: Array<{ payload: unknown; id: unknown }>;
}

function makeSupabase(state: RouteState) {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "u-1" } } }, error: null }),
    },
    from: vi.fn((table: string) => {
      const chain: Record<string, unknown> = { _table: table, _filters: {} };
      chain.select = () => chain;
      chain.eq = (col: string, val: unknown) => {
        (chain._filters as Record<string, unknown>)[col] = val;
        return chain;
      };
      chain.is = () => chain;
      chain.order = () => chain;
      chain.limit = () => chain;
      chain.single = () => {
        if (table === "accounts") return Promise.resolve(state.account ?? { data: null, error: { message: "not found" } });
        if (table === "treasury_configs") return Promise.resolve(state.config ?? { data: null, error: { message: "not found" } });
        return Promise.resolve({ data: null, error: { message: "unexpected single()" } });
      };
      chain.then = (resolve: (v: unknown) => unknown) => {
        if (table === "trades") return Promise.resolve({ data: state.trades ?? [] }).then(resolve);
        if (table === "treasury_payouts" && !chain._isInsert) {
          return Promise.resolve({ data: state.existingPayouts ?? [] }).then(resolve);
        }
        return Promise.resolve({ data: null }).then(resolve);
      };
      chain.insert = (payload: unknown) => {
        chain._isInsert = true;
        void payload;
        return {
          select: () => ({
            single: () => Promise.resolve(state.insertResult ?? { data: { id: "payout-1" }, error: null }),
          }),
        };
      };
      chain.update = (payload: unknown) => {
        state.configUpdateCalls.push({ payload, id: undefined });
        return {
          eq: (_col: string, id: unknown) => {
            state.configUpdateCalls[state.configUpdateCalls.length - 1].id = id;
            return Promise.resolve({ error: null });
          },
        };
      };
      return chain;
    }),
  };
}

function makeRequest(body?: unknown): Request {
  return new Request("http://localhost/api/treasury/payouts/create", {
    method: "POST",
    body: JSON.stringify(body ?? {}),
    headers: { "Content-Type": "application/json" },
  });
}

function baseState(overrides: Partial<RouteState> = {}): RouteState {
  return {
    account: { data: ACCOUNT, error: null },
    config: { data: CONFIG, error: null },
    trades: [TRADE],
    existingPayouts: [],
    configUpdateCalls: [],
    ...overrides,
  };
}

describe("POST /api/treasury/payouts/create", () => {
  beforeEach(() => {
    createServerClientMock.mockReset();
    cookiesMock.mockReset();
    cookiesMock.mockResolvedValue({ getAll: () => [] });
    requireFreshStepUpMock.mockReset().mockResolvedValue({ ok: true });
    checkAiRateLimitMock.mockReset().mockResolvedValue({ allowed: true });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("401 cuando no hay sesión", async () => {
    const supa = makeSupabase(baseState());
    supa.auth.getSession = vi.fn().mockResolvedValue({ data: { session: null }, error: { message: "no session" } });
    createServerClientMock.mockReturnValue(supa);
    const res = await POST(makeRequest({ accountId: ACCOUNT_ID }));
    expect(res.status).toBe(401);
  });

  it("propaga step_up_required cuando el step-up no está fresco", async () => {
    requireFreshStepUpMock.mockResolvedValue({ ok: false, status: 403, reason: "step_up_stale" });
    createServerClientMock.mockReturnValue(makeSupabase(baseState()));
    const res = await POST(makeRequest({ accountId: ACCOUNT_ID }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("step_up_required");
  });

  it("429 cuando se excede el rate limit", async () => {
    checkAiRateLimitMock.mockResolvedValue({ allowed: false, retryAfterSeconds: 120 });
    createServerClientMock.mockReturnValue(makeSupabase(baseState()));
    const res = await POST(makeRequest({ accountId: ACCOUNT_ID }));
    expect(res.status).toBe(429);
  });

  it("400 cuando accountId no es un UUID válido", async () => {
    createServerClientMock.mockReturnValue(makeSupabase(baseState()));
    const res = await POST(makeRequest({ accountId: "not-a-uuid" }));
    expect(res.status).toBe(400);
  });

  it("404 cuando la cuenta no existe", async () => {
    createServerClientMock.mockReturnValue(
      makeSupabase(baseState({ account: { data: null, error: { message: "not found" } } }))
    );
    const res = await POST(makeRequest({ accountId: ACCOUNT_ID }));
    expect(res.status).toBe(404);
  });

  it("404 cuando no hay treasury_configs para la cuenta", async () => {
    createServerClientMock.mockReturnValue(
      makeSupabase(baseState({ config: { data: null, error: { message: "not found" } } }))
    );
    const res = await POST(makeRequest({ accountId: ACCOUNT_ID }));
    expect(res.status).toBe(404);
  });

  it("400 cuando el config no tiene wallet_id mapeado", async () => {
    createServerClientMock.mockReturnValue(
      makeSupabase(baseState({ config: { data: { ...CONFIG, wallet_id: null }, error: null } }))
    );
    const res = await POST(makeRequest({ accountId: ACCOUNT_ID }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Wallet mapping required");
  });

  it("409 con blockedReasons cuando withdrawals_enabled=false", async () => {
    createServerClientMock.mockReturnValue(
      makeSupabase(baseState({ account: { data: { ...ACCOUNT, withdrawals_enabled: false }, error: null } }))
    );
    const res = await POST(makeRequest({ accountId: ACCOUNT_ID }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.blockedReasons).toContain("withdrawals_disabled");
  });

  it("400 cuando no hay retirable profit disponible", async () => {
    createServerClientMock.mockReturnValue(
      makeSupabase(baseState({ account: { data: { ...ACCOUNT, current_balance: 10_000 }, error: null } }))
    );
    const res = await POST(makeRequest({ accountId: ACCOUNT_ID }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("retirable");
  });

  it("regresión: withdrawal_day=30 con hoy=2026-03-01 clampea cycleStart a 2026-02-28", async () => {
    createServerClientMock.mockReturnValue(makeSupabase(baseState()));
    const res = await POST(makeRequest({ accountId: ACCOUNT_ID }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cycleStart).toBe("2026-02-28");
  });

  it("happy path: crea el payout y acumula tax_reserve_amount en tax_buffer_accumulated", async () => {
    const state = baseState();
    createServerClientMock.mockReturnValue(makeSupabase(state));
    const res = await POST(makeRequest({ accountId: ACCOUNT_ID }));
    expect(res.status).toBe(200);
    const body = await res.json();

    // profitTotal=1000, retirable=500 (growth 50%), taxReserve=150 (30%), cashPayout=350
    expect(body.breakdown).toEqual({
      retirable: 500,
      taxReserveAmount: 150,
      bonusVaultAmount: 0,
      cashPayoutAmount: 350,
    });
    expect(body.payoutId).toBe("payout-1");

    // Previously this update never happened anywhere in the codebase.
    expect(state.configUpdateCalls).toHaveLength(1);
    expect(state.configUpdateCalls[0].payload).toEqual({ tax_buffer_accumulated: 200 + 150 });
    expect(state.configUpdateCalls[0].id).toBe(CONFIG.id);
  });

  it("500 cuando el insert de treasury_payouts falla", async () => {
    createServerClientMock.mockReturnValue(
      makeSupabase(baseState({ insertResult: { data: null, error: { message: "insert boom" } } }))
    );
    const res = await POST(makeRequest({ accountId: ACCOUNT_ID }));
    expect(res.status).toBe(500);
  });
});
