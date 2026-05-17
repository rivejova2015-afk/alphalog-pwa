import { describe, it, expect, beforeEach } from "vitest";
import { CircuitBreaker } from "../src/risk/circuit-breaker.js";

describe("CircuitBreaker", () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    cb = new CircuitBreaker();
  });

  describe("canTrade", () => {
    it("permite trading en estado inicial", () => {
      const decision = cb.canTrade();
      expect(decision.allow).toBe(true);
    });

    it("bloquea con reason='loss-streak' después de 6 losses consecutivos", () => {
      for (let i = 0; i < 6; i++) cb.recordClose(-10);
      const decision = cb.canTrade();
      expect(decision.allow).toBe(false);
      if (!decision.allow) {
        expect(decision.reason).toBe("loss-streak");
        expect(decision.pausedUntil).toBeDefined();
      }
    });

    it("una ganancia reinicia el streak de pérdidas", () => {
      for (let i = 0; i < 5; i++) cb.recordClose(-10);
      cb.recordClose(50); // win → reset
      // El siguiente loss empieza desde 1
      cb.recordClose(-10);
      const decision = cb.canTrade();
      expect(decision.allow).toBe(true);
    });

    it("permite trading nuevamente después de que pasa la pausa", () => {
      const now = 1_000_000;
      for (let i = 0; i < 6; i++) cb.recordClose(-10, now);
      // Snapshot tiene pausedUntil = now + 3h
      const snap = cb.snapshot;
      expect(snap.pausedUntil).toBeGreaterThan(now);
      // After pause expires
      const after = (snap.pausedUntil ?? 0) + 1000;
      const decision = cb.canTrade(after);
      expect(decision.allow).toBe(true);
      // Y reinicia el contador de losses
      expect(cb.snapshot.consecutiveLosses).toBe(0);
    });

    it("bloquea con reason='daily-cap' al llegar a 100 trades", () => {
      for (let i = 0; i < 100; i++) cb.recordOpen();
      const decision = cb.canTrade();
      expect(decision.allow).toBe(false);
      if (!decision.allow) expect(decision.reason).toBe("daily-cap");
    });

    it("permite trading hasta justo antes del cap", () => {
      for (let i = 0; i < 99; i++) cb.recordOpen();
      expect(cb.canTrade().allow).toBe(true);
    });
  });

  describe("recordOpen", () => {
    it("incrementa dailyTrades en 1", () => {
      cb.recordOpen();
      cb.recordOpen();
      cb.recordOpen();
      expect(cb.snapshot.dailyTrades).toBe(3);
    });
  });

  describe("recordClose", () => {
    it("PnL positivo → reset consecutiveLosses", () => {
      cb.recordClose(-10);
      cb.recordClose(-10);
      expect(cb.snapshot.consecutiveLosses).toBe(2);
      cb.recordClose(20);
      expect(cb.snapshot.consecutiveLosses).toBe(0);
    });

    it("PnL = 0 cuenta como loss", () => {
      cb.recordClose(0);
      expect(cb.snapshot.consecutiveLosses).toBe(1);
    });

    it("Activa la pausa exactamente en el 6º loss", () => {
      for (let i = 0; i < 5; i++) cb.recordClose(-10);
      expect(cb.snapshot.pausedUntil).toBeNull();
      cb.recordClose(-10);
      expect(cb.snapshot.pausedUntil).not.toBeNull();
    });
  });

  describe("hydrate", () => {
    it("restaura snapshot completo", () => {
      cb.hydrate({
        consecutiveLosses: 4,
        dailyTrades: 50,
        pausedUntil: 2_000_000,
        dayUtc: "2026-05-03",
      });
      const snap = cb.snapshot;
      expect(snap.consecutiveLosses).toBe(4);
      expect(snap.dailyTrades).toBe(50);
      expect(snap.pausedUntil).toBe(2_000_000);
      expect(snap.dayUtc).toBe("2026-05-03");
    });

    it("usa defaults cuando state está vacío", () => {
      cb.hydrate({});
      const snap = cb.snapshot;
      expect(snap.consecutiveLosses).toBe(0);
      expect(snap.dailyTrades).toBe(0);
      expect(snap.pausedUntil).toBeNull();
    });
  });
});
