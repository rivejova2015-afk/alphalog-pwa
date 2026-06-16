import { describe, it, expect } from "vitest";
import {
  PROPFIRM_RULES,
  getPropfirmRule,
  isPropfirmManaged,
} from "../propfirm-rules";

describe("PROPFIRM_RULES catalog", () => {
  it("contiene las 4 propfirms del wizard", () => {
    const expected = ["Apex", "Lucid Trading", "MyFundedFutures", "Tradeify"];
    expect(Object.keys(PROPFIRM_RULES).sort()).toEqual(expected.sort());
  });

  it("Apex tiene overnight 16:59 ET + trailing lock $100", () => {
    const r = PROPFIRM_RULES.Apex;
    expect(r.overnightCutoffEt).toBe("16:59");
    expect(r.trailingDdLockAtProfitDollars).toBe(100);
    expect(r.newsBlackoutMinutesBefore).toBeUndefined();
  });

  it("Lucid Trading tiene overnight 16:45 ET sin news ni trailing lock", () => {
    const r = PROPFIRM_RULES["Lucid Trading"];
    expect(r.overnightCutoffEt).toBe("16:45");
    expect(r.newsBlackoutMinutesBefore).toBeUndefined();
    expect(r.trailingDdLockAtProfitDollars).toBeUndefined();
  });

  it("MyFundedFutures sin overnight + news Tier 1 ±2min + trailing lock $100", () => {
    const r = PROPFIRM_RULES.MyFundedFutures;
    expect(r.overnightCutoffEt).toBeUndefined();
    expect(r.newsBlackoutMinutesBefore).toBe(2);
    expect(r.newsBlackoutMinutesAfter).toBe(2);
    expect(r.newsBlackoutImpactLevels).toEqual(["high"]);
    expect(r.trailingDdLockAtProfitDollars).toBe(100);
  });

  it("Tradeify overnight 16:55 ET + trailing lock $100", () => {
    const r = PROPFIRM_RULES.Tradeify;
    expect(r.overnightCutoffEt).toBe("16:55");
    expect(r.trailingDdLockAtProfitDollars).toBe(100);
  });
});

describe("getPropfirmRule", () => {
  it("devuelve la regla para una propfirm conocida", () => {
    expect(getPropfirmRule("Apex")).toEqual(PROPFIRM_RULES.Apex);
  });

  it("devuelve null para provider desconocido", () => {
    expect(getPropfirmRule("TopstepX")).toBeNull();
    expect(getPropfirmRule("RandomBroker")).toBeNull();
  });

  it("devuelve null para null/undefined/empty", () => {
    expect(getPropfirmRule(null)).toBeNull();
    expect(getPropfirmRule(undefined)).toBeNull();
    expect(getPropfirmRule("")).toBeNull();
  });

  it("es case-sensitive (no matchea 'apex' minúscula)", () => {
    expect(getPropfirmRule("apex")).toBeNull();
    expect(getPropfirmRule("APEX")).toBeNull();
  });
});

describe("isPropfirmManaged", () => {
  it("true para las 4 conocidas", () => {
    expect(isPropfirmManaged("Apex")).toBe(true);
    expect(isPropfirmManaged("Lucid Trading")).toBe(true);
    expect(isPropfirmManaged("MyFundedFutures")).toBe(true);
    expect(isPropfirmManaged("Tradeify")).toBe(true);
  });

  it("false para desconocidos / null", () => {
    expect(isPropfirmManaged("Topstep")).toBe(false);
    expect(isPropfirmManaged(null)).toBe(false);
  });
});
