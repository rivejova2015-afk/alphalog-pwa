import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks de Supabase y market-hours antes de importar el módulo bajo test
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => mockSupabase,
}));
vi.mock("../market-hours", () => ({
  isGlobexOpen: () => mockIsMarketHours(),
  isPastCutoffEt: (_now: Date, cutoff: string) => mockIsPastCutoffEt(cutoff),
  nowToEt: () => mockNowToEt(),
}));

const mockIsMarketHours = vi.fn(() => true);
const mockIsPastCutoffEt = vi.fn((_cutoff: string) => false);
const mockNowToEt = vi.fn(() => ({ dayOfWeek: 1, minutesOfDay: 10 * 60 })); // Mon 10:00 ET default

type TableData = {
  cme_risk_configs?: { enabled: boolean; paused_reason?: string | null; circuit_breaker_pct: number; max_positions?: number | null } | null;
  algo_cme_accounts?: { max_daily_loss?: number | null; max_trailing_dd?: number | null; funded_amount?: number | null; provider_name?: string | null } | null;
  cme_positions?: Array<{ id: string; is_manual: boolean; quantity?: number | null }>;
  cme_connections?: { daily_pnl_usd: number; status: string } | null;
  cme_equity_snapshots?: Array<{ equity_usd: number; snapshot_at: string }>;
  terminal_events?: Array<{ id: string; name: string; impact: string; timestamp_utc: string }>;
};

let tableData: TableData = {};

// Mock "order-aware": para tablas seedeadas como array (cme_equity_snapshots,
// cme_positions, terminal_events), simula sort real por la columna pasada a
// .order() + slice por .limit(n) — necesario porque risk-manager.ts ahora
// hace 2 queries de una sola fila cada una (peak por equity_usd DESC, actual
// por snapshot_at DESC) en vez de traer hasta 500 filas de una.
const mockSupabase = {
  from(table: string) {
    const data = tableData[table as keyof TableData];
    let orderCol: string | null = null;
    let orderAsc = true;
    let limitN: number | null = null;

    function sortedSliced(): Record<string, unknown>[] {
      const arr = (Array.isArray(data) ? [...data] : data ? [data] : []) as Record<string, unknown>[];
      if (orderCol) {
        const col = orderCol;
        arr.sort((a, b) => {
          const av = a[col] as string | number;
          const bv = b[col] as string | number;
          if (av === bv) return 0;
          return orderAsc ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
        });
      }
      return limitN != null ? arr.slice(0, limitN) : arr;
    }

    const chain = {
      select: () => chain,
      eq: () => chain,
      in: () => chain,
      gte: () => chain,
      lte: () => chain,
      order: (col: string, opts?: { ascending?: boolean }) => {
        orderCol = col;
        orderAsc = opts?.ascending ?? true;
        return chain;
      },
      limit: (n: number) => {
        limitN = n;
        return chain;
      },
      maybeSingle: async () => ({ data: sortedSliced()[0] ?? null }),
      // When the call ends without .maybeSingle() (e.g. cme_positions), the awaited result is the array
      then: (resolve: (v: unknown) => unknown) => resolve({ data: sortedSliced() }),
    };
    return chain;
  },
};

import { checkOrderRisk } from "../risk-manager";

const PARAMS = {
  userId: "user-1",
  cmeAccountId: "acc-1",
  direction: "BUY" as const,
  quantity: 1,
};

describe("risk-manager", () => {
  beforeEach(() => {
    mockIsMarketHours.mockReturnValue(true);
    mockIsPastCutoffEt.mockReset().mockReturnValue(false);
    mockNowToEt.mockReset().mockReturnValue({ dayOfWeek: 1, minutesOfDay: 10 * 60 });
    tableData = {
      cme_risk_configs: { enabled: true, paused_reason: null, circuit_breaker_pct: 80, max_positions: 5 },
      algo_cme_accounts: { max_daily_loss: 1000, max_trailing_dd: null, funded_amount: 50000, provider_name: null },
      cme_positions: [],
      cme_connections: { daily_pnl_usd: 0, status: "connected" },
      cme_equity_snapshots: [],
      terminal_events: [],
    };
  });

  describe("checkOrderRisk", () => {
    it("happy path: permite cuando todas las reglas pasan", async () => {
      const r = await checkOrderRisk(PARAMS);
      expect(r.allowed).toBe(true);
    });

    it("rechaza fuera de market hours", async () => {
      mockIsMarketHours.mockReturnValue(false);
      const r = await checkOrderRisk(PARAMS);
      expect(r.allowed).toBe(false);
      expect(r.reason).toBe("outside_market_hours");
    });

    it("rechaza cuando risk_config.enabled = false", async () => {
      tableData.cme_risk_configs = { enabled: false, paused_reason: "manual", circuit_breaker_pct: 80, max_positions: 5 };
      const r = await checkOrderRisk(PARAMS);
      expect(r.allowed).toBe(false);
      expect(r.reason).toBe("manual");
    });

    it("rechaza cuando risk_config no existe", async () => {
      tableData.cme_risk_configs = null;
      const r = await checkOrderRisk(PARAMS);
      expect(r.allowed).toBe(false);
      expect(r.reason).toBe("account_disabled");
    });

    it("rechaza cuando connection.status != 'connected'", async () => {
      tableData.cme_connections = { daily_pnl_usd: 0, status: "disconnected" };
      const r = await checkOrderRisk(PARAMS);
      expect(r.allowed).toBe(false);
      expect(r.reason).toBe("account_not_connected");
    });

    it("rechaza cuando hay posición manual abierta", async () => {
      tableData.cme_positions = [{ id: "pos-1", is_manual: true }];
      const r = await checkOrderRisk(PARAMS);
      expect(r.allowed).toBe(false);
      expect(r.reason).toBe("manual_position_active");
    });

    it("rechaza por circuit breaker cuando daily PnL <= -(max_daily_loss × cb_pct/100)", async () => {
      // max_daily_loss=1000, cb=80% → threshold = 800
      tableData.cme_connections = { daily_pnl_usd: -850, status: "connected" };
      const r = await checkOrderRisk(PARAMS);
      expect(r.allowed).toBe(false);
      expect(r.reason).toBe("circuit_breaker_threshold");
    });

    it("permite cuando daily PnL = -799 (justo bajo el threshold)", async () => {
      tableData.cme_connections = { daily_pnl_usd: -799, status: "connected" };
      const r = await checkOrderRisk(PARAMS);
      expect(r.allowed).toBe(true);
    });

    it("rechaza cuando posiciones abiertas >= max_positions", async () => {
      tableData.cme_positions = [
        { id: "p1", is_manual: false }, { id: "p2", is_manual: false },
        { id: "p3", is_manual: false }, { id: "p4", is_manual: false },
        { id: "p5", is_manual: false },
      ];
      const r = await checkOrderRisk(PARAMS);
      expect(r.allowed).toBe(false);
      expect(r.reason).toBe("max_positions_reached");
    });

    it("permite cuando max_positions = null (ilimitado)", async () => {
      tableData.cme_risk_configs = { enabled: true, paused_reason: null, circuit_breaker_pct: 80, max_positions: null };
      tableData.cme_positions = Array.from({ length: 100 }, (_, i) => ({ id: `p${i}`, is_manual: false }));
      const r = await checkOrderRisk(PARAMS);
      expect(r.allowed).toBe(true);
    });

    // Trailing drawdown — propfirm protection.
    it("rechaza cuando trailing DD desde el peak supera max_trailing_dd", async () => {
      tableData.algo_cme_accounts = { max_daily_loss: 1000, max_trailing_dd: 2000, funded_amount: 50000 };
      tableData.cme_equity_snapshots = [
        { equity_usd: 47000, snapshot_at: "2026-06-10T00:00:00Z" }, // actual (DESC)
        { equity_usd: 52000, snapshot_at: "2026-06-05T00:00:00Z" }, // peak
        { equity_usd: 50000, snapshot_at: "2026-06-01T00:00:00Z" },
      ];
      // peak=52000, current=47000 → DD=5000 ≥ 2000 → bloqueado.
      const r = await checkOrderRisk(PARAMS);
      expect(r.allowed).toBe(false);
      expect(r.reason).toBe("max_trailing_dd_breached");
    });

    it("permite cuando trailing DD está bajo el umbral", async () => {
      tableData.algo_cme_accounts = { max_daily_loss: 1000, max_trailing_dd: 2000, funded_amount: 50000 };
      tableData.cme_equity_snapshots = [
        { equity_usd: 51500, snapshot_at: "2026-06-10T00:00:00Z" }, // actual
        { equity_usd: 52000, snapshot_at: "2026-06-05T00:00:00Z" }, // peak
      ];
      // peak=52000, current=51500 → DD=500 < 2000 → permite.
      const r = await checkOrderRisk(PARAMS);
      expect(r.allowed).toBe(true);
    });

    it("ignora trailing DD cuando max_trailing_dd es null", async () => {
      tableData.algo_cme_accounts = { max_daily_loss: 1000, max_trailing_dd: null, funded_amount: 50000 };
      tableData.cme_equity_snapshots = [
        { equity_usd: 10000, snapshot_at: "2026-06-10T00:00:00Z" }, // dramatic loss, ignorado
        { equity_usd: 52000, snapshot_at: "2026-06-05T00:00:00Z" },
      ];
      const r = await checkOrderRisk(PARAMS);
      expect(r.allowed).toBe(true);
    });

    it("usa funded_amount como peak inicial cuando no hay snapshots por encima", async () => {
      tableData.algo_cme_accounts = { max_daily_loss: 1000, max_trailing_dd: 1500, funded_amount: 50000 };
      tableData.cme_equity_snapshots = [
        { equity_usd: 48000, snapshot_at: "2026-06-10T00:00:00Z" }, // peak=funded=50000, DD=2000 ≥ 1500
      ];
      const r = await checkOrderRisk(PARAMS);
      expect(r.allowed).toBe(false);
      expect(r.reason).toBe("max_trailing_dd_breached");
    });

    // Bug #4 del review: la query vieja ordenaba por snapshot_at DESC +
    // limit(500), que a la frecuencia real de equity-sync (cada 5min) solo
    // cubre ~1.7-2 días — un peak más viejo quedaba invisible. Ahora se pide
    // el MAX real (ORDER BY equity_usd DESC LIMIT 1) separado del equity
    // actual (ORDER BY snapshot_at DESC LIMIT 1), sin importar cuántas filas
    // haya entre medio.
    it("detecta el peak real aunque esté 'sepultado' entre cientos de snapshots más recientes y bajos", async () => {
      tableData.algo_cme_accounts = { max_daily_loss: 1000, max_trailing_dd: 2000, funded_amount: 50000 };
      const manySnapshots = Array.from({ length: 300 }, (_, i) => ({
        equity_usd: 51000, // ninguno de estos es el peak real
        snapshot_at: new Date(2026, 5, 20 + i).toISOString(),
      }));
      tableData.cme_equity_snapshots = [
        { equity_usd: 60000, snapshot_at: "2026-06-01T00:00:00Z" }, // peak real, "viejo"
        ...manySnapshots,
        { equity_usd: 51000, snapshot_at: "2026-06-30T00:00:00Z" }, // más reciente = equity actual
      ];
      // peak=60000, current=51000 → DD=9000 ≥ 2000 → debe bloquear.
      const r = await checkOrderRisk(PARAMS);
      expect(r.allowed).toBe(false);
      expect(r.reason).toBe("max_trailing_dd_breached");
    });

    it("permite cuando el peak real está lejos pero el DD sigue bajo el umbral", async () => {
      tableData.algo_cme_accounts = { max_daily_loss: 1000, max_trailing_dd: 5000, funded_amount: 50000 };
      tableData.cme_equity_snapshots = [
        { equity_usd: 52000, snapshot_at: "2026-06-01T00:00:00Z" }, // peak real
        { equity_usd: 50000, snapshot_at: "2026-06-30T00:00:00Z" }, // actual, DD=2000 < 5000
      ];
      const r = await checkOrderRisk(PARAMS);
      expect(r.allowed).toBe(true);
    });

    // ── Reglas por propfirm (Fase 2) ─────────────────────────────────────
    describe("propfirm overnight cutoff", () => {
      it("Apex past 16:59 ET → bloqueado con propfirm_overnight_cutoff", async () => {
        tableData.algo_cme_accounts!.provider_name = "Apex";
        mockIsPastCutoffEt.mockImplementation((cutoff) => cutoff === "16:59");
        const r = await checkOrderRisk(PARAMS);
        expect(r.allowed).toBe(false);
        expect(r.reason).toBe("propfirm_overnight_cutoff");
      });

      it("Apex antes del cutoff → permite", async () => {
        tableData.algo_cme_accounts!.provider_name = "Apex";
        mockIsPastCutoffEt.mockReturnValue(false);
        const r = await checkOrderRisk(PARAMS);
        expect(r.allowed).toBe(true);
      });

      it("Lucid Trading past 16:45 ET → bloqueado", async () => {
        tableData.algo_cme_accounts!.provider_name = "Lucid Trading";
        mockIsPastCutoffEt.mockImplementation((cutoff) => cutoff === "16:45");
        const r = await checkOrderRisk(PARAMS);
        expect(r.allowed).toBe(false);
        expect(r.reason).toBe("propfirm_overnight_cutoff");
      });

      it("MyFundedFutures no tiene cutoff → permite a cualquier hora", async () => {
        tableData.algo_cme_accounts!.provider_name = "MyFundedFutures";
        mockIsPastCutoffEt.mockReturnValue(true); // aunque sea past, MFFU no tiene cutoff
        const r = await checkOrderRisk(PARAMS);
        expect(r.allowed).toBe(true);
      });

      it("provider desconocido (TopstepX legacy) → no aplica cutoff", async () => {
        tableData.algo_cme_accounts!.provider_name = "TopstepX";
        mockIsPastCutoffEt.mockReturnValue(true);
        const r = await checkOrderRisk(PARAMS);
        expect(r.allowed).toBe(true);
      });
    });

    describe("propfirm max contracts per tier (Apex)", () => {
      it("Apex $25K + 0 positions + orden de 2 → permite (justo en el límite)", async () => {
        tableData.algo_cme_accounts = {
          max_daily_loss: 1000, max_trailing_dd: null, funded_amount: 25000, provider_name: "Apex",
        };
        tableData.cme_positions = [];
        const r = await checkOrderRisk({ ...PARAMS, quantity: 2 });
        expect(r.allowed).toBe(true);
      });

      it("Apex $25K + 1 posición de 1 contract + orden de 2 → bloqueado (1+2 > 2)", async () => {
        tableData.algo_cme_accounts = {
          max_daily_loss: 1000, max_trailing_dd: null, funded_amount: 25000, provider_name: "Apex",
        };
        tableData.cme_positions = [{ id: "pos-1", is_manual: false, quantity: 1 }];
        const r = await checkOrderRisk({ ...PARAMS, quantity: 2 });
        expect(r.allowed).toBe(false);
        expect(r.reason).toBe("propfirm_max_contracts");
      });

      it("Apex $50K + 3 positions de 1 + orden de 1 → permite (3+1=4 ≤ 4)", async () => {
        tableData.algo_cme_accounts = {
          max_daily_loss: 1000, max_trailing_dd: null, funded_amount: 50000, provider_name: "Apex",
        };
        tableData.cme_positions = [
          { id: "p1", is_manual: false, quantity: 1 },
          { id: "p2", is_manual: false, quantity: 1 },
          { id: "p3", is_manual: false, quantity: 1 },
        ];
        const r = await checkOrderRisk({ ...PARAMS, quantity: 1 });
        expect(r.allowed).toBe(true);
      });

      it("Apex con funded_amount no-tier ($75K) → no aplica check de contracts", async () => {
        tableData.algo_cme_accounts = {
          max_daily_loss: 1000, max_trailing_dd: null, funded_amount: 75000, provider_name: "Apex",
        };
        const r = await checkOrderRisk({ ...PARAMS, quantity: 100 });
        expect(r.allowed).toBe(true);
      });

      it("Lucid (sin maxContractsByTier) + 100 contracts → permite", async () => {
        tableData.algo_cme_accounts = {
          max_daily_loss: 1000, max_trailing_dd: null, funded_amount: 50000, provider_name: "Lucid Trading",
        };
        const r = await checkOrderRisk({ ...PARAMS, quantity: 100 });
        expect(r.allowed).toBe(true);
      });

      // Bug #2 del review: en un reversal, quantity ya incluye el tamaño para
      // cerrar la posición actual (quantity = |netPos| + proposedQty) — sumarle
      // además currentContracts contaba esa misma posición dos veces.
      it("Apex $25K reversal: long 2 (en el límite) + SELL de flatten+flip (quantity=3) → permite (neta=1)", async () => {
        tableData.algo_cme_accounts = {
          max_daily_loss: 1000, max_trailing_dd: null, funded_amount: 25000, provider_name: "Apex",
        };
        tableData.cme_positions = [{ id: "pos-1", is_manual: false, quantity: 2 }];
        // Sin isReversal, esto se hubiera bloqueado (2+3=5 > 2) aunque la
        // posición neta resultante (short 1) está bien dentro del límite.
        const r = await checkOrderRisk({ ...PARAMS, quantity: 3, isReversal: true });
        expect(r.allowed).toBe(true);
      });

      it("Apex $25K reversal que SÍ excede el límite neto (quantity=6, current=2 → neta=4 > 2) → bloqueado", async () => {
        tableData.algo_cme_accounts = {
          max_daily_loss: 1000, max_trailing_dd: null, funded_amount: 25000, provider_name: "Apex",
        };
        tableData.cme_positions = [{ id: "pos-1", is_manual: false, quantity: 2 }];
        const r = await checkOrderRisk({ ...PARAMS, quantity: 6, isReversal: true });
        expect(r.allowed).toBe(false);
        expect(r.reason).toBe("propfirm_max_contracts");
      });

      it("misma orden SIN isReversal (default false) → usa la fórmula normal (2+3=5 > 2, bloqueado)", async () => {
        tableData.algo_cme_accounts = {
          max_daily_loss: 1000, max_trailing_dd: null, funded_amount: 25000, provider_name: "Apex",
        };
        tableData.cme_positions = [{ id: "pos-1", is_manual: false, quantity: 2 }];
        const r = await checkOrderRisk({ ...PARAMS, quantity: 3 });
        expect(r.allowed).toBe(false);
        expect(r.reason).toBe("propfirm_max_contracts");
      });
    });

    describe("propfirm news blackout", () => {
      it("MFFU con terminal_event impact=high en ventana → bloqueado", async () => {
        tableData.algo_cme_accounts!.provider_name = "MyFundedFutures";
        tableData.terminal_events = [
          { id: "evt-1", name: "FOMC", impact: "high", timestamp_utc: new Date().toISOString() },
        ];
        const r = await checkOrderRisk(PARAMS);
        expect(r.allowed).toBe(false);
        expect(r.reason).toBe("propfirm_news_blackout");
      });

      it("MFFU sin events en ventana → permite", async () => {
        tableData.algo_cme_accounts!.provider_name = "MyFundedFutures";
        tableData.terminal_events = [];
        const r = await checkOrderRisk(PARAMS);
        expect(r.allowed).toBe(true);
      });

      it("Apex no tiene news blackout → no se consulta terminal_events", async () => {
        tableData.algo_cme_accounts!.provider_name = "Apex";
        // Aunque haya eventos, Apex no debería bloquearse por news.
        tableData.terminal_events = [
          { id: "evt-1", name: "FOMC", impact: "high", timestamp_utc: new Date().toISOString() },
        ];
        const r = await checkOrderRisk(PARAMS);
        expect(r.allowed).toBe(true);
      });

      it("MFFU keyword filter: 'Retail Sales' high impact NO bloquea (no es Tier 1)", async () => {
        tableData.algo_cme_accounts!.provider_name = "MyFundedFutures";
        tableData.terminal_events = [
          { id: "evt-1", name: "Retail Sales m/m", impact: "high", timestamp_utc: new Date().toISOString() },
        ];
        const r = await checkOrderRisk(PARAMS);
        expect(r.allowed).toBe(true);
      });

      it("MFFU keyword filter: 'CPI y/y' bloquea (matchea 'CPI')", async () => {
        tableData.algo_cme_accounts!.provider_name = "MyFundedFutures";
        tableData.terminal_events = [
          { id: "evt-1", name: "Core CPI y/y", impact: "high", timestamp_utc: new Date().toISOString() },
        ];
        const r = await checkOrderRisk(PARAMS);
        expect(r.allowed).toBe(false);
        expect(r.reason).toBe("propfirm_news_blackout");
      });

      it("MFFU keyword filter: 'Nonfarm Payrolls' bloquea (matchea 'Nonfarm' o 'NFP')", async () => {
        tableData.algo_cme_accounts!.provider_name = "MyFundedFutures";
        tableData.terminal_events = [
          { id: "evt-1", name: "Nonfarm Payrolls", impact: "high", timestamp_utc: new Date().toISOString() },
        ];
        const r = await checkOrderRisk(PARAMS);
        expect(r.allowed).toBe(false);
        expect(r.reason).toBe("propfirm_news_blackout");
      });
    });

    describe("propfirm weekend hold check (A8)", () => {
      // Test del comportamiento futuro — ninguna propfirm actual tiene
      // disallowWeekendHolds=true por default. Mockeamos el rule directamente.
      it("disallowWeekendHolds + sábado → bloqueado con propfirm_weekend_blocked", async () => {
        tableData.algo_cme_accounts!.provider_name = "Apex";
        mockNowToEt.mockReturnValue({ dayOfWeek: 6, minutesOfDay: 10 * 60 }); // sábado 10:00 ET
        // Apex no tiene disallowWeekendHolds por default → no bloquea.
        // Para testear el comportamiento, parcheo PROPFIRM_RULES en runtime.
        const propfirmRules = await import("../propfirm-rules");
        const original = propfirmRules.PROPFIRM_RULES.Apex.disallowWeekendHolds;
        propfirmRules.PROPFIRM_RULES.Apex.disallowWeekendHolds = true;
        try {
          const r = await checkOrderRisk(PARAMS);
          expect(r.allowed).toBe(false);
          expect(r.reason).toBe("propfirm_weekend_blocked");
        } finally {
          propfirmRules.PROPFIRM_RULES.Apex.disallowWeekendHolds = original;
        }
      });

      it("disallowWeekendHolds + domingo 17:00 ET (antes apertura ETH) → bloqueado", async () => {
        tableData.algo_cme_accounts!.provider_name = "Apex";
        mockNowToEt.mockReturnValue({ dayOfWeek: 0, minutesOfDay: 17 * 60 });
        const propfirmRules = await import("../propfirm-rules");
        const original = propfirmRules.PROPFIRM_RULES.Apex.disallowWeekendHolds;
        propfirmRules.PROPFIRM_RULES.Apex.disallowWeekendHolds = true;
        try {
          const r = await checkOrderRisk(PARAMS);
          expect(r.allowed).toBe(false);
          expect(r.reason).toBe("propfirm_weekend_blocked");
        } finally {
          propfirmRules.PROPFIRM_RULES.Apex.disallowWeekendHolds = original;
        }
      });

      it("disallowWeekendHolds + domingo 18:30 ET (ETH abierto) → permite", async () => {
        tableData.algo_cme_accounts!.provider_name = "Apex";
        mockNowToEt.mockReturnValue({ dayOfWeek: 0, minutesOfDay: 18 * 60 + 30 });
        const propfirmRules = await import("../propfirm-rules");
        const original = propfirmRules.PROPFIRM_RULES.Apex.disallowWeekendHolds;
        propfirmRules.PROPFIRM_RULES.Apex.disallowWeekendHolds = true;
        try {
          const r = await checkOrderRisk(PARAMS);
          expect(r.allowed).toBe(true);
        } finally {
          propfirmRules.PROPFIRM_RULES.Apex.disallowWeekendHolds = original;
        }
      });
    });

    describe("propfirm trailing DD lock-at-profit", () => {
      it("Apex con equity actual bajo lock floor → bloqueado por trailing DD", async () => {
        tableData.algo_cme_accounts = {
          max_daily_loss: 1000,
          max_trailing_dd: 50,
          funded_amount: 50000,
          provider_name: "Apex",
        };
        // Equity llegó a 50200 (>= funded+100 lock) y ahora cayó a 50000.
        // effectivePeak = max(50200, funded+100=50100) = 50200.
        // DD = 50200 - 50000 = 200 ≥ max_trailing_dd 50 → bloqueado.
        tableData.cme_equity_snapshots = [
          { equity_usd: 50000, snapshot_at: "2026-06-15T18:00:00Z" }, // actual
          { equity_usd: 50200, snapshot_at: "2026-06-14T18:00:00Z" }, // peak post-lock
        ];
        const r = await checkOrderRisk(PARAMS);
        expect(r.allowed).toBe(false);
        expect(r.reason).toBe("max_trailing_dd_breached");
      });

      it("Apex sin equity ≥ lock floor → trailing DD aplica solo a peak observado", async () => {
        tableData.algo_cme_accounts = {
          max_daily_loss: 1000,
          max_trailing_dd: 500,
          funded_amount: 50000,
          provider_name: "Apex",
        };
        // Equity nunca alcanzó funded+100 → lock no se activa.
        // peak observado = max(50000, 50050) = 50050. current=49600. DD=450 < 500 → permite.
        tableData.cme_equity_snapshots = [
          { equity_usd: 49600, snapshot_at: "2026-06-15T18:00:00Z" },
          { equity_usd: 50050, snapshot_at: "2026-06-14T18:00:00Z" },
        ];
        const r = await checkOrderRisk(PARAMS);
        expect(r.allowed).toBe(true);
      });

      it("Lucid sin trailing lock → comportamiento idéntico a sin propfirm rules", async () => {
        tableData.algo_cme_accounts = {
          max_daily_loss: 1000,
          max_trailing_dd: 200,
          funded_amount: 50000,
          provider_name: "Lucid Trading",
        };
        tableData.cme_equity_snapshots = [
          { equity_usd: 49850, snapshot_at: "2026-06-15T18:00:00Z" },
          { equity_usd: 50100, snapshot_at: "2026-06-14T18:00:00Z" },
        ];
        // peak=50100, current=49850, DD=250 ≥ 200 → bloqueado (sin lock applies).
        const r = await checkOrderRisk(PARAMS);
        expect(r.allowed).toBe(false);
        expect(r.reason).toBe("max_trailing_dd_breached");
      });
    });
  });
});
