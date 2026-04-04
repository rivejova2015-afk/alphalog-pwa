const HAIKU_MODEL = "claude-haiku-4-5-20251001";

export type MemoryItem = {
  type: "pattern" | "preference" | "error" | "insight" | "style";
  content: string;
  importance_score: number;
  asset?: string;
};

type ClaudeResponse = {
  content?: Array<{ type: string; text?: string }>;
};

const EXTRACTION_PROMPT = `Analiza esta conversación entre un prop trader y su asistente financiero.
Extrae 2-4 insights accionables sobre el trader que sean útiles para futuras conversaciones.

Responde SOLO con un array JSON válido, sin texto adicional:
[
  {
    "type": "pattern|preference|error|insight|style",
    "content": "descripción concisa del insight (máx 120 chars)",
    "importance_score": <número 1-100>,
    "asset": "XAUUSD|US500|null"
  }
]

Tipos:
- pattern: comportamiento repetido del trader (ej. "opera mejor en sesión Londres")
- preference: preferencia de análisis (ej. "prefiere análisis macro sobre técnico")
- error: error recurrente (ej. "tiende a operar contra tendencia en días de NFP")
- insight: observación valiosa (ej. "muestra alta confianza en setups de breakout")
- style: estilo de comunicación (ej. "prefiere respuestas directas sin mucha narrativa")

Reglas:
- Solo extrae si hay evidencia real en la conversación
- importance_score: 80-100 para insights críticos, 50-79 para útiles, 1-49 para menores
- asset: null si aplica a cualquier instrumento
- Devuelve [] si no hay insights claros`;

/**
 * Extracts trader memory insights from a chat session using Claude Haiku (cost-efficient).
 * Returns 2-4 memory items or empty array if no clear insights found.
 */
export const extractMemoryFromSession = async (
  messages: { role: string; content: string }[],
  asset: string
): Promise<MemoryItem[]> => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return [];

  const relevantMessages = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-30); // last 30 messages max

  if (relevantMessages.length < 4) return [];

  const conversationText = relevantMessages
    .map((m) => `[${m.role.toUpperCase()}]: ${m.content}`)
    .join("\n\n");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: HAIKU_MODEL,
        max_tokens: 500,
        system: EXTRACTION_PROMPT,
        messages: [
          {
            role: "user",
            content: `Instrumento operado: ${asset}\n\nConversación:\n${conversationText}`,
          },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) return [];

    const data = (await response.json()) as ClaudeResponse;
    const textBlock = data.content?.find((b) => b.type === "text");
    const text = textBlock?.text ?? "";

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const raw = JSON.parse(jsonMatch[0]) as unknown[];
    if (!Array.isArray(raw)) return [];

    const validTypes = ["pattern", "preference", "error", "insight", "style"] as const;

    return raw
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      .map((item) => ({
        type: validTypes.includes(item.type as (typeof validTypes)[number])
          ? (item.type as MemoryItem["type"])
          : "insight",
        content:
          typeof item.content === "string"
            ? item.content.slice(0, 120)
            : "",
        importance_score:
          typeof item.importance_score === "number"
            ? Math.min(100, Math.max(1, Math.round(item.importance_score)))
            : 50,
        asset:
          item.asset === "XAUUSD" || item.asset === "US500"
            ? item.asset
            : undefined,
      }))
      .filter((item) => item.content.length > 0)
      .slice(0, 4);
  } catch {
    return [];
  }
};
