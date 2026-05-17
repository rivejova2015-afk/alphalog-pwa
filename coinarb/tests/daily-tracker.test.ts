import { describe, it, expect, beforeEach } from "vitest";
import { DailyTracker } from "../src/risk/daily-tracker.js";

describe("DailyTracker", () => {
  let dt: DailyTracker;

  beforeEach(() => {
    dt = new DailyTracker();
  });

  describe("recordTrade", () => {
    it("incrementa totalTrades + wins en trade ganador", () => {
      dt.recordTrade("BTC-USD", 50, 1050, "phase-1");
      const { data } = dt.current;
      expect(data.totalTrades).toBe(1);
      expect(data.wins).toBe(1);
      expect(data.losses).toBe(0);
      expect(data.pnlUsd).toBe(50);
    });

    it("incrementa losses + consecutiveLossCurrent en trade perdedor", () => {
      dt.recordTrade("BTC-USD", -20, 980, "phase-1");
      dt.recordTrade("BTC-USD", -15, 965, "phase-1");
      const { data } = dt.current;
      expect(data.losses).toBe(2);
      expect(data.consecutiveLossCurrent).toBe(2);
      expect(data.consecutiveLossMax).toBe(2);
    });

    it("reinicia consecutiveLossCurrent en una ganancia, mantiene Max", () => {
      dt.recordTrade("BTC-USD", -10, 990, "phase-1");
      dt.recordTrade("BTC-USD", -10, 980, "phase-1");
      dt.recordTrade("BTC-USD", -10, 970, "phase-1");
      dt.recordTrade("BTC-USD", 30, 1000, "phase-1");
      const { data } = dt.current;
      expect(data.consecutiveLossCurrent).toBe(0);
      expect(data.consecutiveLossMax).toBe(3);
    });

    it("rastrea bestTradeUsd y worstTradeUsd", () => {
      dt.recordTrade("BTC-USD", 30, 1030, "phase-1");
      dt.recordTrade("BTC-USD", -50, 980, "phase-1");
      dt.recordTrade("BTC-USD", 75, 1055, "phase-1");
      const { data } = dt.current;
      expect(data.bestTradeUsd).toBe(75);
      expect(data.worstTradeUsd).toBe(-50);
    });

    it("acumula pnlUsd", () => {
      dt.recordTrade("BTC-USD", 100, 1100, "phase-1");
      dt.recordTrade("ETH-USD", -30, 1070, "phase-1");
      dt.recordTrade("SOL-USD", 50, 1120, "phase-1");
      expect(dt.current.data.pnlUsd).toBe(120);
    });
  });

  describe("symbol caps", () => {
    it("isSymbolCapReached false bajo el cap (33)", () => {
      for (let i = 0; i < 32; i++) dt.recordTrade("BTC-USD", 10, 1000, "phase-1");
      expect(dt.isSymbolCapReached("BTC-USD")).toBe(false);
    });

    it("isSymbolCapReached true al alcanzar 33 trades del mismo símbolo", () => {
      for (let i = 0; i < 33; i++) dt.recordTrade("BTC-USD", 10, 1000, "phase-1");
      expect(dt.isSymbolCapReached("BTC-USD")).toBe(true);
    });

    it("getCountBySymbol retorna conteo correcto por símbolo", () => {
      dt.recordTrade("BTC-USD", 10, 1000, "phase-1");
      dt.recordTrade("BTC-USD", 10, 1000, "phase-1");
      dt.recordTrade("ETH-USD", 10, 1000, "phase-1");
      expect(dt.getCountBySymbol("BTC-USD")).toBe(2);
      expect(dt.getCountBySymbol("ETH-USD")).toBe(1);
      expect(dt.getCountBySymbol("SOL-USD")).toBe(0);
    });

    it("getAllCountsBySymbol devuelve mapa completo", () => {
      dt.recordTrade("BTC-USD", 10, 1000, "phase-1");
      dt.recordTrade("ETH-USD", 10, 1000, "phase-1");
      expect(dt.getAllCountsBySymbol()).toEqual({ "BTC-USD": 1, "ETH-USD": 1 });
    });
  });

  describe("total cap", () => {
    it("isTotalCapReached true al llegar a 100 trades", () => {
      // Distribuir entre símbolos para no chocar con cap por símbolo (33)
      for (let i = 0; i < 33; i++) dt.recordTrade("BTC-USD", 1, 1000, "phase-1");
      for (let i = 0; i < 33; i++) dt.recordTrade("ETH-USD", 1, 1000, "phase-1");
      for (let i = 0; i < 33; i++) dt.recordTrade("SOL-USD", 1, 1000, "phase-1");
      for (let i = 0; i < 1; i++) dt.recordTrade("BTC-USD", 1, 1000, "phase-1");
      expect(dt.current.data.totalTrades).toBe(100);
      expect(dt.isTotalCapReached()).toBe(true);
    });
  });

  describe("setOpeningCapital", () => {
    it("solo registra capitalStart la primera vez", () => {
      dt.setOpeningCapital(1000, "phase-1");
      dt.setOpeningCapital(1500, "phase-2"); // ignored
      expect(dt.current.data.capitalStart).toBe(1000);
      expect(dt.current.data.phaseStart).toBe("phase-1");
    });
  });

  describe("recordFearGreed", () => {
    it("acumula sum y samples", () => {
      dt.recordFearGreed(40);
      dt.recordFearGreed(60);
      dt.recordFearGreed(50);
      expect(dt.current.data.fearGreedSum).toBe(150);
      expect(dt.current.data.fearGreedSamples).toBe(3);
    });
  });

  describe("hydrate", () => {
    it("restaura snapshot parcial mergeado con blank()", () => {
      dt.hydrate({ totalTrades: 25, wins: 15, pnlUsd: 230 });
      const { data } = dt.current;
      expect(data.totalTrades).toBe(25);
      expect(data.wins).toBe(15);
      expect(data.pnlUsd).toBe(230);
      // El resto sigue siendo blank
      expect(data.losses).toBe(0);
      expect(data.consecutiveLossMax).toBe(0);
    });
  });

  describe("markCircuitTriggered", () => {
    it("setea circuitTriggered = true", () => {
      expect(dt.current.data.circuitTriggered).toBe(false);
      dt.markCircuitTriggered();
      expect(dt.current.data.circuitTriggered).toBe(true);
    });
  });
});
