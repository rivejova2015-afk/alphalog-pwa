import { describe, it, expect } from "vitest";
import { pickPhase, computeRiskUsd, PhaseManager } from "../src/risk/phase-manager.js";

describe("phase-manager", () => {
  describe("pickPhase", () => {
    it("$100 inicial → phase '$100'", () => {
      expect(pickPhase(100).name).toBe("$100");
      expect(pickPhase(100).riskPct).toBe(0.01);
    });

    it("$20 exacto → phase '$20-testing' (riskPct 5%, $1/trade)", () => {
      expect(pickPhase(20).name).toBe("$20-testing");
      expect(pickPhase(20).riskPct).toBe(0.05);
      expect(computeRiskUsd(20, pickPhase(20).riskPct)).toBe(1);
    });

    it("$50 (entre tiers) → sigue en '$20-testing'", () => {
      expect(pickPhase(50).name).toBe("$20-testing");
    });

    it("$0 (debajo del mínimo) → phase '$20-testing' (default lowest)", () => {
      expect(pickPhase(0).name).toBe("$20-testing");
    });

    it("$500 exacto → phase '$500'", () => {
      expect(pickPhase(500).name).toBe("$500");
      expect(pickPhase(500).riskPct).toBe(0.015);
    });

    it("$999 (debajo de $1K) → phase '$500'", () => {
      expect(pickPhase(999).name).toBe("$500");
    });

    it("$1000 exacto → phase '$1K'", () => {
      expect(pickPhase(1000).name).toBe("$1K");
      expect(pickPhase(1000).riskPct).toBe(0.02);
    });

    it("$10K → riskPct = 3%", () => {
      expect(pickPhase(10_000).riskPct).toBe(0.03);
    });

    it("$5M (cap) → riskPct = 15%", () => {
      expect(pickPhase(5_000_000).riskPct).toBe(0.15);
    });

    it("$10M (sobre el cap) → sigue en phase '$5M'", () => {
      expect(pickPhase(10_000_000).name).toBe("$5M");
    });

    it("phases son monotónicas desde $100 hacia arriba (el tier $20-testing es deliberadamente más agresivo)", () => {
      const capitals = [100, 500, 5000, 50_000, 500_000, 5_000_000];
      const risks = capitals.map((c) => pickPhase(c).riskPct);
      for (let i = 1; i < risks.length; i++) {
        expect(risks[i]).toBeGreaterThanOrEqual(risks[i - 1]);
      }
    });
  });

  describe("computeRiskUsd", () => {
    it("$10K capital × 1% = $100", () => {
      expect(computeRiskUsd(10_000, 0.01)).toBe(100);
    });
    it("$100K capital × 5% = $5000", () => {
      expect(computeRiskUsd(100_000, 0.05)).toBe(5000);
    });
    it("$0 capital → 0", () => {
      expect(computeRiskUsd(0, 0.05)).toBe(0);
    });
  });

  describe("PhaseManager", () => {
    it("constructor selecciona la phase inicial correcta", () => {
      const pm = new PhaseManager(2500);
      expect(pm.phaseName).toBe("$1K"); // $1000 ≤ 2500 < $5000
      expect(pm.riskPct).toBe(0.02);
      expect(pm.capitalNow).toBe(2500);
    });

    it("state retorna phase + capital + riskPct", () => {
      const pm = new PhaseManager(500);
      const s = pm.state;
      expect(s.phase.name).toBe("$500");
      expect(s.capital).toBe(500);
      expect(s.riskPct).toBe(0.015);
    });

    it("recordClose con capital igual no cambia phase", async () => {
      const pm = new PhaseManager(1000);
      const before = pm.phaseName;
      const r = await pm.recordClose(1100);
      expect(r.phase.name).toBe(before); // sigue $1K
      expect(pm.capitalNow).toBe(1100);
    });

    it("recordClose con capital subiendo dispara phase up", async () => {
      const pm = new PhaseManager(800); // $500
      const r = await pm.recordClose(1500); // $1K
      expect(r.phase.name).toBe("$1K");
      expect(pm.riskPct).toBe(0.02);
    });

    it("recordClose con capital cayendo dispara phase down", async () => {
      const pm = new PhaseManager(15_000); // $10K
      const r = await pm.recordClose(2_000); // back to $1K
      expect(r.phase.name).toBe("$1K");
      expect(pm.riskPct).toBe(0.02);
    });

    it("recordClose no rompe cuando COINARB_USER_ID está vacío", async () => {
      // En tests no hay COINARB_USER_ID → logTransition skipea sin throw
      const pm = new PhaseManager(800);
      await expect(pm.recordClose(1500)).resolves.toBeDefined();
    });
  });
});
