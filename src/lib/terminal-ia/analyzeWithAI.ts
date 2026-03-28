import type { ScoredNewsItem } from "@/lib/reports/buildBase";
import type { Asset } from "@/lib/news/sources";

export type AIAnalysis = {
  market_context: string;
  sentiment_reasoning: string;
  sentiment_score: number;
  sentiment_label: "Bullish" | "Bearish" | "Neutral";
  key_drivers: string[];
  forward_outlook: string;
  trading_bias: string;
  confidence: number;
};

type ClaudeResponse = {
  content?: Array<{
    type: string;
    text?: string;
  }>;
  error?: {
    message?: string;
  };
};

const ASSET_CONTEXT: Record<Asset, string> = {
  US500: "S&P 500 (US equities index). Sensible a: política monetaria Fed, datos de empleo, inflación (CPI/PPI/PCE), earnings corporativos, riesgo geopolítico.",
  XAUUSD: "XAUUSD (Gold/USD spot). Sensible a: tasas de interés reales, inflación, incertidumbre geopolítica, demanda de bancos centrales, fortaleza del USD, flujos safe-haven.",
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const buildSystemPrompt = (asset: Asset) =>
  `Eres un analista financiero senior especializado en ${ASSET_CONTEXT[asset]}
Tu audiencia es un prop trader activo que opera intradía y swing en ${asset}.

Tu trabajo:
1. Analizar noticias oficiales (Fed, BLS, SEC, BIS, Treasury) de los últimos 7 días
2. Evaluar el impacto en ${asset} con razonamiento claro
3. Identificar drivers clave del mercado
4. Dar una perspectiva forward-looking accionable
5. Determinar un sesgo de trading (Bullish/Bearish/Neutral) con nivel de confianza

Responde SIEMPRE en JSON válido con estos campos exactos:
{
  "market_context": "Resumen de 2-3 oraciones del contexto macro actual y cómo afecta a ${asset}",
  "sentiment_reasoning": "Explicación de 2-3 oraciones de por qué el sentimiento es alcista, bajista o neutral",
  "sentiment_score": <number de -100 a 100, negativo=bearish, positivo=bullish>,
  "sentiment_label": "Bullish" | "Bearish" | "Neutral",
  "key_drivers": ["array de 3-5 drivers principales, cada uno con su impacto esperado"],
  "forward_outlook": "Perspectiva de 2-3 oraciones para los próximos 5-7 días hábiles",
  "trading_bias": "Recomendación concisa de sesgo operativo para la próxima semana",
  "confidence": <number de 0 a 100, qué tan seguro estás del análisis>
}

Reglas:
- Escribe en español profesional y conciso.
- No inventes datos ni precios. Solo analiza lo que te dan.
- Si los datos son insuficientes, indica confidence bajo (<40) y mencionalo en sentiment_reasoning.
- Prioriza noticias de alto impacto (FOMC, CPI, NFP, GDP) sobre las de medio impacto.
- Responde SOLO con el JSON, sin texto adicional.`;

/**
 * Analyzes scored news items using Claude (Anthropic API).
 * Returns null if AI is unavailable or analysis fails (caller should fall back to keyword-based).
 */
export const analyzeNewsWithAI = async (
  asset: Asset,
  items: ScoredNewsItem[],
): Promise<AIAnalysis | null> => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const relevant = items
    .filter((i) => i.impact !== "low")
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
    .slice(0, 20);

  if (relevant.length === 0) return null;

  const newsBlock = relevant
    .map(
      (item, i) =>
        `${i + 1}. [${item.impact.toUpperCase()}] ${item.title} (${item.source}, ${item.publishedAt.toISOString().split("T")[0]})`
    )
    .join("\n");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: buildSystemPrompt(asset),
        messages: [
          {
            role: "user",
            content: `Analiza estas ${relevant.length} noticias de impacto medio/alto para ${asset} de los últimos 7 días:\n\n${newsBlock}`,
          },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) return null;

    const data = (await response.json()) as ClaudeResponse;
    const textBlock = data.content?.find((block) => block.type === "text");
    const content = textBlock?.text;
    if (!content) return null;

    // Extract JSON from response (Claude may wrap in markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const raw = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    const validLabels = ["Bullish", "Bearish", "Neutral"] as const;
    const rawLabel = raw.sentiment_label;
    const label: AIAnalysis["sentiment_label"] =
      typeof rawLabel === "string" && validLabels.includes(rawLabel as AIAnalysis["sentiment_label"])
        ? (rawLabel as AIAnalysis["sentiment_label"])
        : "Neutral";

    return {
      market_context:
        typeof raw.market_context === "string" ? raw.market_context : "",
      sentiment_reasoning:
        typeof raw.sentiment_reasoning === "string"
          ? raw.sentiment_reasoning
          : "",
      sentiment_score:
        typeof raw.sentiment_score === "number"
          ? clamp(raw.sentiment_score, -100, 100)
          : 0,
      sentiment_label: label,
      key_drivers: Array.isArray(raw.key_drivers)
        ? raw.key_drivers
            .filter((d): d is string => typeof d === "string")
            .slice(0, 5)
        : [],
      forward_outlook:
        typeof raw.forward_outlook === "string" ? raw.forward_outlook : "",
      trading_bias:
        typeof raw.trading_bias === "string" ? raw.trading_bias : "",
      confidence:
        typeof raw.confidence === "number"
          ? clamp(raw.confidence, 0, 100)
          : 50,
    };
  } catch {
    return null;
  }
};
