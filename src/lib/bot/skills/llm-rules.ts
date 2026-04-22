import { decryptText } from "@/lib/security/encryption";
import type { PaperTrade, TradingRule, LLMExtractionResult } from "./types";

export async function extractTradingRules(
  paperTrades: PaperTrade[],
  currentRules: TradingRule[]
): Promise<TradingRule[]> {
  // Prepare trade summary (last 50 trades, max to avoid token bloat)
  const tradesSample = paperTrades.slice(-50);

  const tradeSummary = await Promise.all(
    tradesSample.map(async (t) => {
      let notesDecrypted = "";
      if (t.notes) {
        if (t.notes.startsWith("enc:v1:")) {
          try {
            const decrypted = await decryptText(t.notes);
            notesDecrypted = decrypted ?? "";
          } catch {
            notesDecrypted = "";
          }
        } else {
          notesDecrypted = t.notes;
        }
      }

      return {
        symbol: t.symbol,
        regime: t.regime ?? "UNKNOWN",
        direction: t.direction,
        confidence: t.confidence?.toFixed(3) ?? "0.5",
        pnl: t.pnl?.toFixed(2) ?? "0",
        pnl_pct: t.pnl_percent?.toFixed(4) ?? "0",
        won: (t.pnl ?? 0) > 0,
        session: t.session ?? "CLOSED",
        notes: notesDecrypted,
      };
    })
  );

  const currentRulesConditions = currentRules.map((r) => ({
    condition: r.condition,
    action: r.action,
  }));

  const prompt = `Eres un experto en trading sistematico de XAUUSD. Analiza estos trades de paper trading y genera reglas especificas y cuantificables.

TRADES (ultimos ${tradesSample.length}):
${JSON.stringify(tradeSummary, null, 2)}

REGLAS ACTUALES:
${JSON.stringify(currentRulesConditions, null, 2)}

Genera 3-5 reglas nuevas basadas en patrones en los trades. Responde UNICAMENTE con un objeto JSON valido sin markdown ni backticks.

Schema exacto:
{
  "rules": [
    {
      "condition": "string descripcion de la condicion (ej: regime==BULL_TREND_STRONG AND confidence>0.7)",
      "action": "BUY|SELL|SKIP",
      "confidence_threshold": 0.6,
      "rationale": "string corto por que esta regla es buena"
    }
  ],
  "insights": ["insight1", "insight2"]
}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.ANTHROPIC_API_KEY}`,
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{ role: "user" as const, content: prompt }],
      }),
    });

    if (!response.ok) {
      console.error("Anthropic API error:", response.status);
      return [];
    }

    const data = (await response.json()) as { content?: Array<{ text: string }> };
    const text = data.content?.[0]?.text ?? "{}";

    // Remove markdown code blocks if present
    const cleanedText = text.replace(/```json|```/g, "").trim();
    const result: LLMExtractionResult = JSON.parse(cleanedText);

    // Convert to TradingRule format
    return (result.rules ?? []).map((r, idx) => ({
      id: `llm_${Date.now()}_${idx}`,
      condition: r.condition,
      action: r.action,
      confidenceThreshold: r.confidence_threshold,
      rationale: r.rationale,
      performanceScore: 0,
      source: "LLM" as const,
      createdAt: new Date().toISOString(),
    }));
  } catch (error) {
    console.error("LLM rule extraction error:", error);
    return [];
  }
}
