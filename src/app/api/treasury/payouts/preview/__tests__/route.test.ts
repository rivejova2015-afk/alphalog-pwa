// Integration tests for POST /api/treasury/payouts/preview.
//
// This route previously had 0 coverage despite computing real payout math.
// Also serves as a regression test for the cycle-math bug fixed in the
// 2026-07 maturity audit: the route used to compute cycleStart with
// unclamped inline `new Date(year, month, withdrawal_day)` math, which for
// withdrawal_day values that don't exist in every month (e.g. 30, 31)
// could roll over into a nonsensical date instead of falling back cleanly.
// The route now delegates to payoutEngine.computeCycleStart(), which clamps
// to day 28.

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";

const { createServerClientMock, cookiesMock, sendThresholdPushMock } = vi.hoisted(() => ({
  createServerClientMock: vi.fn(),
  cookiesMock: vi.fn(),
  sendThresholdPushMock: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({ createServerClient: createServerClientMock }));
vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("@/lib/log", () => ({ logError: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn() }));
vi.mock("@/lib/treasury/pushNotifications", () => ({
  sendThresholdPush: (...args: unknown[]) => sendThresholdPushMock(...args),
}));

let POST: (req: Request) => Promise<Response>;
beforeAll(async () => {
  const mod = await import("../route");
  POST = mod.POST;
});

interface Tables {
  accounts?: unknown[];
  treasury_configs?: unknown[];
  trades?: unknown[];
}

function makeSupabase(tables: Tables, hasSession = true) {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue(
        hasSession
          ? { data: { session: { user: { id: "u-1" } } }, error: null }
          : { data: { session: null }, error: { message: "no session" } }
      ),
    },
    from: vi.fn((table: string) => {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.is = () => chain;
      chain.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: tables[table as keyof Tables] ?? [] }).then(resolve);
      return chain;
    }),
  };
}

function makeRequest(body?: unknown): Request {
  return new Request("http://localhost/api/treasury/payouts/preview", {
    method: "POST",
    body: JSON.stringify(body ?? {}),
    headers: { "Content-Type": "application/json" },
  });
}

const ACCOUNT = {
  id: "acc-1",
  name: "Cuenta 1",
  account_size: 10_000,
  current_balance: 11_000,
  phase_status: "funded",
  withdrawals_enabled: true,
};

const CONFIG = {
  id: "cfg-1",
  account_id: "acc-1",
  withdrawal_day: 30,
  split_mode: "growth",
  balance_threshold: null,
  anti_drawdown_active: false,
  anti_drawdown_threshold: 20,
  tax_buffer_percentage: 30,
  wallet_id: "wallet-1",
  last_threshold_push_cycle_start: null,
};

const TRADE = {
  id: "t-1",
  account_id: "acc-1",
  entry_date: "2026-03-01",
  exit_date: "2026-03-01",
  created_at: "2026-03-01",
  pnl: 1000,
  status: "Closed",
};

describe("POST /api/treasury/payouts/preview", () => {
  beforeEach(() => {
    createServerClientMock.mockReset();
    cookiesMock.mockReset();
    cookiesMock.mockResolvedValue({ getAll: () => [] });
    sendThresholdPushMock.mockReset().mockResolvedValue(true);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("401 cuando no hay sesión", async () => {
    createServerClientMock.mockReturnValue(makeSupabase({}, false));
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it("400 cuando accountId no es 'ALL' ni un UUID válido", async () => {
    createServerClientMock.mockReturnValue(makeSupabase({}));
    const res = await POST(makeRequest({ accountId: "not-a-uuid" }));
    expect(res.status).toBe(400);
  });

  it("404 cuando el accountId provisto no existe entre las cuentas del usuario", async () => {
    createServerClientMock.mockReturnValue(
      makeSupabase({ accounts: [ACCOUNT], treasury_configs: [CONFIG], trades: [] })
    );
    const res = await POST(makeRequest({ accountId: "9c858901-8a57-4791-81c0-0c79c8500abf" }));
    expect(res.status).toBe(404);
  });

  it("cuenta sin treasury_configs se omite del preview sin error", async () => {
    createServerClientMock.mockReturnValue(
      makeSupabase({ accounts: [ACCOUNT], treasury_configs: [], trades: [] })
    );
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.perAccountPreview).toEqual([]);
  });

  it("regresión: withdrawal_day=30 con hoy=2026-03-01 clampea a cycleStart=2026-02-28, no rueda a un día sin sentido dentro de marzo", async () => {
    createServerClientMock.mockReturnValue(
      makeSupabase({ accounts: [ACCOUNT], treasury_configs: [CONFIG], trades: [TRADE] })
    );
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.perAccountPreview).toHaveLength(1);
    expect(body.perAccountPreview[0].cycleStart).toBe("2026-02-28");
  });

  it("calcula breakdown correcto (growth split 50%, tax buffer 30%)", async () => {
    createServerClientMock.mockReturnValue(
      makeSupabase({ accounts: [ACCOUNT], treasury_configs: [CONFIG], trades: [TRADE] })
    );
    const res = await POST(makeRequest());
    const body = await res.json();
    const preview = body.perAccountPreview[0];
    // profitTotal = 11000-10000=1000, payoutableProfit=min(periodPnL,1000)=1000
    // retirable = 1000 * 0.5 = 500, taxReserve = 500*0.3=150, cashPayout=350
    expect(preview.retirable).toBe(500);
    expect(preview.taxReserveAmount).toBe(150);
    expect(preview.cashPayoutAmount).toBe(350);
    expect(preview.isCreatable).toBe(true);
    expect(preview.blockedReasons).toEqual([]);
  });

  it("marca blockedReasons cuando withdrawals_enabled=false, e isCreatable=false", async () => {
    createServerClientMock.mockReturnValue(
      makeSupabase({
        accounts: [{ ...ACCOUNT, withdrawals_enabled: false }],
        treasury_configs: [CONFIG],
        trades: [TRADE],
      })
    );
    const res = await POST(makeRequest());
    const body = await res.json();
    const preview = body.perAccountPreview[0];
    expect(preview.blockedReasons).toContain("withdrawals_disabled");
    expect(preview.isCreatable).toBe(false);
  });

  it("envía push de umbral cuando se cumple la condición y no se envió ya en este ciclo", async () => {
    createServerClientMock.mockReturnValue(
      makeSupabase({
        accounts: [ACCOUNT],
        treasury_configs: [{ ...CONFIG, balance_threshold: 10_500 }],
        trades: [TRADE],
      })
    );
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pushNotificationsPending).toHaveLength(1);
    expect(sendThresholdPushMock).toHaveBeenCalledTimes(1);
  });

  it("500 cuando falla el fetch de datos (accounts null)", async () => {
    const supa = makeSupabase({ treasury_configs: [CONFIG], trades: [] });
    supa.from = vi.fn((table: string) => {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.is = () => chain;
      chain.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: table === "accounts" ? null : [] }).then(resolve);
      return chain;
    });
    createServerClientMock.mockReturnValue(supa);
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
  });
});
