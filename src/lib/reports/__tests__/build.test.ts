import { describe, it, expect } from "vitest";
import { buildReportBase, type ScoredNewsItem } from "../buildBase";
import { buildUS500Report } from "../buildUS500";
import { buildXAUUSDReport } from "../buildXAUUSD";
import type { Asset } from "@/lib/news/sources";
import type { AIAnalysis } from "@/lib/terminal-ia/analyzeWithAI";

function makeAi(overrides: Partial<AIAnalysis> = {}): AIAnalysis {
  return {
    market_context: "ctx",
    sentiment_reasoning: "reason",
    sentiment_score: 0,
    sentiment_label: "Neutral",
    key_drivers: [],
    forward_outlook: "outlook",
    trading_bias: "neutral",
    confidence: 75,
    ...overrides,
  };
}

function makeItem(overrides: Partial<ScoredNewsItem> = {}): ScoredNewsItem {
  return {
    id: `n-${Math.random()}`,
    title: "Generic news headline",
    source: "test-source",
    publishedAt: new Date(),
    asset: "US500" as Asset,
    impact: "medium",
    ...overrides,
  };
}

describe("buildReportBase", () => {
  it("retorna shape ReportBuild completo", () => {
    const r = buildReportBase("US500", [makeItem({ title: "Fed cuts rates" })]);
    expect(r).toHaveProperty("asset");
    expect(r).toHaveProperty("title");
    expect(r).toHaveProperty("summary");
    expect(r).toHaveProperty("markdown");
    expect(r).toHaveProperty("html");
    expect(r).toHaveProperty("sections");
    expect(r).toHaveProperty("relevantItemIds");
    expect(r).toHaveProperty("hash");
    expect(r).toHaveProperty("sentimentScore");
    expect(r).toHaveProperty("sentimentLabel");
    expect(r).toHaveProperty("incomplete");
    expect(r).toHaveProperty("incompleteReasons");
  });

  it("items vacíos → incomplete=true con reason 'Sin eventos'", () => {
    const r = buildReportBase("US500", []);
    expect(r.incomplete).toBe(true);
    expect(r.incompleteReasons[0]).toMatch(/Sin eventos/);
    expect(r.relevantItemIds).toEqual([]);
  });

  it("filtra items con impact='low' (no entran en relevantItems)", () => {
    const r = buildReportBase("US500", [
      makeItem({ id: "high1", impact: "high" }),
      makeItem({ id: "low1", impact: "low" }),
      makeItem({ id: "med1", impact: "medium" }),
    ]);
    expect(r.relevantItemIds).toContain("high1");
    expect(r.relevantItemIds).toContain("med1");
    expect(r.relevantItemIds).not.toContain("low1");
  });

  it("relevantItemIds está ordenado", () => {
    const r = buildReportBase("US500", [
      makeItem({ id: "zzz", impact: "high" }),
      makeItem({ id: "aaa", impact: "high" }),
      makeItem({ id: "mmm", impact: "high" }),
    ]);
    expect(r.relevantItemIds).toEqual(["aaa", "mmm", "zzz"]);
  });

  it("hash es determinístico (mismos ids → mismo hash)", () => {
    const items = [makeItem({ id: "a", impact: "high" }), makeItem({ id: "b", impact: "high" })];
    const r1 = buildReportBase("US500", items);
    const r2 = buildReportBase("US500", items);
    expect(r1.hash).toBe(r2.hash);
    expect(r1.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("hash cambia si los ids relevantes cambian", () => {
    const r1 = buildReportBase("US500", [makeItem({ id: "a", impact: "high" })]);
    const r2 = buildReportBase("US500", [makeItem({ id: "b", impact: "high" })]);
    expect(r1.hash).not.toBe(r2.hash);
  });

  it("sentimentLabel='Buy' cuando contiene keywords positivos (US500)", () => {
    const r = buildReportBase("US500", [
      makeItem({ title: "Fed signals rate cut and easing", impact: "high" }),
      makeItem({ title: "Cooling inflation supports soft landing", impact: "high" }),
    ]);
    expect(r.sentimentLabel).toBe("Buy");
    expect(r.sentimentScore).toBeGreaterThan(15);
  });

  it("sentimentLabel='Sell' cuando contiene keywords negativos", () => {
    const r = buildReportBase("US500", [
      makeItem({ title: "Fed announces rate hike amid tightening", impact: "high" }),
      makeItem({ title: "Recession fears and bank stress", impact: "high" }),
    ]);
    expect(r.sentimentLabel).toBe("Sell");
    expect(r.sentimentScore).toBeLessThan(-15);
  });

  it("sentimentLabel='Neutral' cuando hay mix balanceado o sin keywords", () => {
    const r = buildReportBase("US500", [
      makeItem({ title: "Earnings beat consensus", impact: "medium" }),
    ]);
    expect(r.sentimentLabel).toBe("Neutral");
  });

  it("sentimentScore clamped a [-100, 100]", () => {
    const manyNeg = Array.from({ length: 30 }, (_, i) =>
      makeItem({ id: `n${i}`, title: "rate hike inflation recession", impact: "high" })
    );
    const r = buildReportBase("US500", manyNeg);
    expect(r.sentimentScore).toBeGreaterThanOrEqual(-100);
    expect(r.sentimentScore).toBeLessThanOrEqual(100);
  });

  it("AI analysis override: usa ai.sentiment_score (Bullish→Buy)", () => {
    const ai = makeAi({ sentiment_score: 75, sentiment_label: "Bullish" });
    const r = buildReportBase("US500", [makeItem({ impact: "high" })], { aiAnalysis: ai });
    expect(r.sentimentScore).toBe(75);
    expect(r.sentimentLabel).toBe("Buy");
  });

  it("AI Bearish → Sell, Neutral → Neutral", () => {
    const baseItems = [makeItem({ impact: "high" })];
    const r1 = buildReportBase("US500", baseItems, {
      aiAnalysis: makeAi({ sentiment_score: -50, sentiment_label: "Bearish" }),
    });
    expect(r1.sentimentLabel).toBe("Sell");

    const r2 = buildReportBase("US500", baseItems, {
      aiAnalysis: makeAi({ sentiment_score: 5, sentiment_label: "Neutral" }),
    });
    expect(r2.sentimentLabel).toBe("Neutral");
  });

  it("title default usa 'US500' o 'XAUUSD' según asset", () => {
    const r1 = buildReportBase("US500", [makeItem({ impact: "high" })]);
    const r2 = buildReportBase("XAUUSD", [makeItem({ impact: "high" })]);
    expect(r1.title).toContain("US500");
    expect(r2.title).toContain("XAUUSD");
  });

  it("titleOverride se respeta", () => {
    const r = buildReportBase("US500", [makeItem({ impact: "high" })], {
      titleOverride: "Custom Report Title",
    });
    expect(r.title).toBe("Custom Report Title");
  });

  it("titleOverride vacío usa el default", () => {
    const r = buildReportBase("US500", [makeItem({ impact: "high" })], {
      titleOverride: "   ",
    });
    expect(r.title).toContain("US500");
  });

  it("hay items con impact alto → relevantItems poblado", () => {
    const r = buildReportBase("US500", [makeItem({ impact: "high" })]);
    expect(r.relevantItemIds).toHaveLength(1);
    // (incomplete puede seguir siendo true por reasons internos como "sin recap",
    // pero al menos el reason de 'sin eventos relevantes' NO aparece)
    expect(r.incompleteReasons.some((m) => m.includes("Sin eventos de impacto"))).toBe(false);
  });

  it("sections array tiene al menos 1 sección (data section)", () => {
    const r = buildReportBase("US500", [makeItem({ impact: "high", title: "T1" })]);
    expect(r.sections.length).toBeGreaterThan(0);
  });
});

describe("buildUS500Report / buildXAUUSDReport", () => {
  it("buildUS500Report delega a buildReportBase con asset='US500'", () => {
    const r = buildUS500Report([makeItem({ impact: "high" })]);
    expect(r.asset).toBe("US500");
  });

  it("buildXAUUSDReport delega a buildReportBase con asset='XAUUSD'", () => {
    const r = buildXAUUSDReport([makeItem({ impact: "high" })]);
    expect(r.asset).toBe("XAUUSD");
  });

  it("ambos aceptan AI analysis opcional", () => {
    const ai = makeAi({ sentiment_score: 30, sentiment_label: "Bullish" });
    const r1 = buildUS500Report([makeItem({ impact: "high" })], ai);
    const r2 = buildXAUUSDReport([makeItem({ impact: "high" })], ai);
    expect(r1.sentimentScore).toBe(30);
    expect(r2.sentimentScore).toBe(30);
  });
});
