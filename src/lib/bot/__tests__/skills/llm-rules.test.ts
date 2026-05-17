import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock encryption antes de importar llm-rules.
vi.mock("@/lib/security/encryption", () => ({
  decryptText: (value: string) => {
    if (value === "enc:v1:THROW") throw new Error("decrypt failed");
    if (value.startsWith("enc:")) return value.replace(/^enc:v\d+:/, "");
    return value;
  },
}));

import { extractTradingRules } from "../../skills/llm-rules";
import type { PaperTrade, TradingRule } from "../../skills/types";

function makeTrade(overrides: Partial<PaperTrade> = {}): PaperTrade {
  return {
    symbol: "XAUUSD",
    regime: "BULL_TREND_STRONG",
    direction: "BUY",
    confidence: 0.7,
    pnl: 100,
    pnl_percent: 0.02,
    session: "OVERLAP",
    ...overrides,
  } as PaperTrade;
}

const VALID_LLM_RESPONSE = {
  content: [{
    text: JSON.stringify({
      rules: [
        {
          condition: "regime==BULL_TREND_STRONG AND confidence>0.7",
          action: "BUY",
          confidence_threshold: 0.65,
          rationale: "Trending markets favor longs",
        },
        {
          condition: "session==CLOSED",
          action: "SKIP",
          confidence_threshold: 0.5,
          rationale: "Don't trade outside sessions",
        },
      ],
      insights: ["insight1"],
    }),
  }],
};

describe("extractTradingRules", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("happy path: 2 rules parseadas con id + source LLM + timestamp", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => VALID_LLM_RESPONSE,
    });
    const rules = await extractTradingRules([makeTrade()], []);
    expect(rules).toHaveLength(2);
    expect(rules[0].condition).toContain("BULL_TREND_STRONG");
    expect(rules[0].action).toBe("BUY");
    expect(rules[0].confidenceThreshold).toBe(0.65);
    expect(rules[0].source).toBe("LLM");
    expect(rules[0].id).toMatch(/^llm_\d+_0$/);
    expect(rules[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("response.ok=false → retorna [] (no throw)", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
    });
    const rules = await extractTradingRules([makeTrade()], []);
    expect(rules).toEqual([]);
  });

  it("fetch throw → retorna [] (graceful)", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("ECONNRESET"));
    const rules = await extractTradingRules([makeTrade()], []);
    expect(rules).toEqual([]);
  });

  it("JSON malformado → retorna [] sin throw", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ text: "{not valid json{" }] }),
    });
    const rules = await extractTradingRules([makeTrade()], []);
    expect(rules).toEqual([]);
  });

  it("remueve markdown ```json wrapping", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: "```json\n" + JSON.stringify({ rules: [], insights: [] }) + "\n```" }],
      }),
    });
    const rules = await extractTradingRules([makeTrade()], []);
    expect(rules).toEqual([]); // parse exitoso, sin reglas
  });

  it("response sin content → retorna [] (fallback {} parsea OK)", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    const rules = await extractTradingRules([makeTrade()], []);
    expect(rules).toEqual([]);
  });

  it("rules vacías en LLM response → []", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ text: JSON.stringify({ rules: [] }) }] }),
    });
    const rules = await extractTradingRules([makeTrade()], []);
    expect(rules).toEqual([]);
  });

  it("decrypta notes con prefijo enc:v* y graceful en fail", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => VALID_LLM_RESPONSE,
    });
    const trades = [
      makeTrade({ notes: "enc:v1:decrypted text" }),
      makeTrade({ notes: "enc:v1:THROW" }), // decrypt lanza → notesDecrypted = ""
      makeTrade({ notes: "plain text" }),     // sin prefijo → preserva
    ];
    await extractTradingRules(trades, []);
    // Verificamos que la llamada se hizo (no rompió por decrypt)
    expect(global.fetch).toHaveBeenCalledOnce();
    // Inspeccionamos el body del request
    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.messages[0].content).toContain("decrypted text");
    expect(body.messages[0].content).toContain("plain text");
  });

  it("cap a últimos 50 trades aunque se pasen más", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => VALID_LLM_RESPONSE,
    });
    const trades = Array.from({ length: 100 }, (_, i) =>
      makeTrade({ pnl: i, symbol: `SYM${i}` })
    );
    await extractTradingRules(trades, []);
    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    // El prompt menciona "ultimos 50"
    expect(body.messages[0].content).toContain("ultimos 50");
    // Los primeros 50 trades NO deberían aparecer (sólo los últimos)
    expect(body.messages[0].content).not.toContain('"SYM0"');
    expect(body.messages[0].content).toContain('"SYM99"');
  });

  it("currentRules son incluidas en el prompt", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => VALID_LLM_RESPONSE,
    });
    const currentRules: TradingRule[] = [
      {
        id: "rule-1",
        condition: "existing condition",
        action: "BUY",
        confidenceThreshold: 0.5,
        rationale: "existing rationale",
        performanceScore: 0.5,
        source: "RL",
        createdAt: "2026-01-01T00:00:00Z",
      },
    ];
    await extractTradingRules([makeTrade()], currentRules);
    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.messages[0].content).toContain("existing condition");
  });
});
