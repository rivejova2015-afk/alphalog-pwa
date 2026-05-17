import { describe, it, expect, vi } from "vitest";
import {
  stateToIndex,
  contextToState,
  chooseAction,
  calculateReward,
  updateQTable,
  decayEpsilon,
  createEmptyQTable,
  runLearningCycle,
} from "../../skills/rl-engine";
import type { SkillState, QTable, PaperTrade } from "../../skills/types";

describe("rl-engine", () => {
  describe("stateToIndex", () => {
    it("estado todo-cero → índice 0", () => {
      const state: SkillState = { regimeBucket: 0, confidenceBucket: 0, volBucket: 0, sessionBucket: 0 };
      expect(stateToIndex(state)).toBe(0);
    });

    it("encode lineal: cada componente shift correcto", () => {
      // regimeBucket=1 → 1 * 64 = 64
      expect(stateToIndex({ regimeBucket: 1, confidenceBucket: 0, volBucket: 0, sessionBucket: 0 })).toBe(64);
      // confidenceBucket=1 → 1 * 16 = 16
      expect(stateToIndex({ regimeBucket: 0, confidenceBucket: 1, volBucket: 0, sessionBucket: 0 })).toBe(16);
      // volBucket=1 → 1 * 4 = 4
      expect(stateToIndex({ regimeBucket: 0, confidenceBucket: 0, volBucket: 1, sessionBucket: 0 })).toBe(4);
      // sessionBucket=1 → 1
      expect(stateToIndex({ regimeBucket: 0, confidenceBucket: 0, volBucket: 0, sessionBucket: 1 })).toBe(1);
    });

    it("máximo de cada bucket no excede 448 (tabla size)", () => {
      // regime 0-6, conf 0-3, vol 0-3, session 0-3
      const max = stateToIndex({ regimeBucket: 6, confidenceBucket: 3, volBucket: 3, sessionBucket: 3 });
      expect(max).toBe(6 * 64 + 3 * 16 + 3 * 4 + 3); // 447
      expect(max).toBeLessThan(448);
    });
  });

  describe("contextToState", () => {
    it("BULL_TREND_STRONG → regimeBucket=0", () => {
      const s = contextToState("BULL_TREND_STRONG", 0.7, 0.005, "NY" as never);
      expect(s.regimeBucket).toBe(0);
    });

    it("BREAKOUT_IMMINENT → regimeBucket=6", () => {
      const s = contextToState("BREAKOUT_IMMINENT", 0.7, 0.005, "NY" as never);
      expect(s.regimeBucket).toBe(6);
    });

    it("regime desconocido → fallback bucket=4 (SIDEWAYS_LOW_VOL)", () => {
      const s = contextToState("UNKNOWN_REGIME", 0.7, 0.005, "NY" as never);
      expect(s.regimeBucket).toBe(4);
    });

    it("confidence buckets: <0.6=0, 0.6-0.7=1, 0.7-0.85=2, ≥0.85=3", () => {
      expect(contextToState("BULL_TREND_STRONG", 0.5, 0.005, "NY" as never).confidenceBucket).toBe(0);
      expect(contextToState("BULL_TREND_STRONG", 0.65, 0.005, "NY" as never).confidenceBucket).toBe(1);
      expect(contextToState("BULL_TREND_STRONG", 0.8, 0.005, "NY" as never).confidenceBucket).toBe(2);
      expect(contextToState("BULL_TREND_STRONG", 0.9, 0.005, "NY" as never).confidenceBucket).toBe(3);
    });

    it("vol buckets: <0.002, 0.002-0.005, 0.005-0.010, >0.010", () => {
      expect(contextToState("BULL_TREND_STRONG", 0.7, 0.001, "NY" as never).volBucket).toBe(0);
      expect(contextToState("BULL_TREND_STRONG", 0.7, 0.003, "NY" as never).volBucket).toBe(1);
      expect(contextToState("BULL_TREND_STRONG", 0.7, 0.008, "NY" as never).volBucket).toBe(2);
      expect(contextToState("BULL_TREND_STRONG", 0.7, 0.02, "NY" as never).volBucket).toBe(3);
    });

    it("session buckets correctos", () => {
      expect(contextToState("BULL_TREND_STRONG", 0.7, 0.005, "CLOSED" as never).sessionBucket).toBe(0);
      expect(contextToState("BULL_TREND_STRONG", 0.7, 0.005, "NY" as never).sessionBucket).toBe(1);
      expect(contextToState("BULL_TREND_STRONG", 0.7, 0.005, "LONDON" as never).sessionBucket).toBe(2);
      expect(contextToState("BULL_TREND_STRONG", 0.7, 0.005, "OVERLAP" as never).sessionBucket).toBe(3);
    });
  });

  describe("chooseAction", () => {
    it("epsilon=0 → siempre argmax", () => {
      const qTable = [[1, 5, 2]]; // best at idx 1
      // No mock needed; epsilon=0 nunca cae en branch random
      for (let i = 0; i < 10; i++) {
        expect(chooseAction(qTable, 0, 0)).toBe(1);
      }
    });

    it("epsilon=0 con varios maxes elige el primero", () => {
      const qTable = [[5, 5, 5]];
      expect(chooseAction(qTable, 0, 0)).toBe(0);
    });

    it("epsilon=1 → random (todos los outputs ∈ {0,1,2})", () => {
      const qTable = [[1, 5, 2]];
      vi.spyOn(Math, "random").mockReturnValue(0.5);
      const action = chooseAction(qTable, 0, 1);
      expect([0, 1, 2]).toContain(action);
      vi.restoreAllMocks();
    });
  });

  describe("calculateReward", () => {
    it("PnL positivo / risk → reward positivo", () => {
      const r = calculateReward({ pnl: 100, maxAdverseExcursion: 50 });
      expect(r).toBeCloseTo(100 / 50.0001, 2);
    });

    it("PnL negativo → reward negativo", () => {
      const r = calculateReward({ pnl: -50, maxAdverseExcursion: 100 });
      expect(r).toBeLessThan(0);
    });

    it("pnl=null → reward=0/risk", () => {
      const r = calculateReward({ pnl: null });
      expect(r).toBe(0);
    });

    it("MAE=0 no causa div by zero (epsilon protege)", () => {
      const r = calculateReward({ pnl: 50, maxAdverseExcursion: 0 });
      expect(Number.isFinite(r)).toBe(true);
      expect(r).toBeGreaterThan(0);
    });
  });

  describe("updateQTable", () => {
    it("actualiza Q-value según fórmula Bellman", () => {
      const q = [[0, 0, 0], [10, 0, 0]];
      // reward=5, gamma=0.9, nextMax=10 → 0 + 0.1 * (5 + 0.9*10 - 0) = 1.4
      updateQTable(q, 0, 0 as never, 5, 1, 0.1, 0.9);
      expect(q[0][0]).toBeCloseTo(1.4, 5);
    });

    it("alpha=0 no produce cambios", () => {
      const q = [[5, 0, 0], [10, 0, 0]];
      const before = q[0][0];
      updateQTable(q, 0, 0 as never, 100, 1, 0, 0.9);
      expect(q[0][0]).toBe(before);
    });

    it("muta el qTable in-place y retorna referencia", () => {
      const q = [[0, 0, 0], [10, 0, 0]];
      const result = updateQTable(q, 0, 0 as never, 5, 1);
      expect(result).toBe(q); // misma referencia
    });
  });

  describe("decayEpsilon", () => {
    it("decay 0.5% por paso", () => {
      expect(decayEpsilon(0.3)).toBeCloseTo(0.3 * 0.995, 5);
    });
    it("floor en 0.05", () => {
      expect(decayEpsilon(0.05)).toBe(0.05);
      expect(decayEpsilon(0.001)).toBe(0.05);
    });
  });

  describe("createEmptyQTable", () => {
    it("retorna Q-table 448x3 inicializada en cero", () => {
      const q = createEmptyQTable("XAUUSD");
      expect(q.table).toHaveLength(448);
      expect(q.table[0]).toEqual([0, 0, 0]);
      expect(q.epsilon).toBe(0.3);
      expect(q.version).toBe(1);
      expect(q.instrument).toBe("XAUUSD");
    });

    it("trainedAt es ISO timestamp", () => {
      const q = createEmptyQTable("ES");
      expect(q.trainedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe("runLearningCycle", () => {
    function makeTrade(overrides: Partial<PaperTrade> = {}): PaperTrade {
      return {
        pnl: 100,
        direction: "BUY",
        regime: "BULL_TREND_STRONG",
        confidence: 0.7,
        vol15m: 0.005,
        session: "NY",
        maxAdverseExcursion: 50,
        ...overrides,
      } as PaperTrade;
    }

    it("trades vacíos → episodeCount=0, avgReward=0", () => {
      const empty = createEmptyQTable("XAUUSD");
      const r = runLearningCycle({
        closedTrades: [],
        currentQTable: empty,
        regimeHistory: [],
        sessionHistory: [],
      });
      expect(r.episodeCount).toBe(0);
      expect(r.avgReward).toBe(0);
      expect(r.improvedActions).toBe(0);
    });

    it("incrementa version y aplica epsilon decay", () => {
      const empty = createEmptyQTable("XAUUSD");
      const r = runLearningCycle({
        closedTrades: [makeTrade(), makeTrade({ pnl: -30 })],
        currentQTable: empty,
        regimeHistory: ["BULL_TREND_STRONG", "BULL_TREND_WEAK"],
        sessionHistory: ["NY", "NY"],
      });
      expect(r.updatedQTable.version).toBe(2);
      expect(r.updatedQTable.epsilon).toBeLessThan(empty.epsilon);
    });

    it("episodeCount = closedTrades.length", () => {
      const empty = createEmptyQTable("XAUUSD");
      const trades = Array.from({ length: 10 }, () => makeTrade());
      const r = runLearningCycle({
        closedTrades: trades,
        currentQTable: empty,
        regimeHistory: Array(10).fill("BULL_TREND_STRONG"),
        sessionHistory: Array(10).fill("NY"),
      });
      expect(r.episodeCount).toBe(10);
    });

    it("no muta el qTable original", () => {
      const empty = createEmptyQTable("XAUUSD");
      const snapshotJson = JSON.stringify(empty.table);
      runLearningCycle({
        closedTrades: [makeTrade()],
        currentQTable: empty,
        regimeHistory: ["BULL_TREND_STRONG"],
        sessionHistory: ["NY"],
      });
      // original intacto (la función clona el table al entrar)
      expect(JSON.stringify(empty.table)).toBe(snapshotJson);
    });

    it("improvedActions cuenta cambios significativos en Q-value", () => {
      const empty = createEmptyQTable("XAUUSD");
      const r = runLearningCycle({
        closedTrades: [makeTrade({ pnl: 1000, maxAdverseExcursion: 10 })], // reward grande
        currentQTable: empty,
        regimeHistory: ["BULL_TREND_STRONG"],
        sessionHistory: ["NY"],
      });
      expect(r.improvedActions).toBeGreaterThan(0);
    });
  });
});
