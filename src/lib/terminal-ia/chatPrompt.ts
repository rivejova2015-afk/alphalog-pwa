import type { ChatContext } from "./buildChatContext";
import type { Asset } from "@/lib/news/sources";

const ASSET_DESCRIPTION: Record<Asset, string> = {
  XAUUSD:
    "XAUUSD (Gold/USD spot). Sensible a: tasas de interés reales, inflación, incertidumbre geopolítica, demanda de bancos centrales, fortaleza del USD, flujos safe-haven.",
  US500:
    "S&P 500 (US equities index). Sensible a: política monetaria Fed, datos de empleo, inflación (CPI/PPI/PCE), earnings corporativos, riesgo geopolítico.",
};

const formatPrice = (ctx: ChatContext): string => {
  if (!ctx.livePrice) return "No disponible en este momento.";
  const { last, bid, ask, source, stale } = ctx.livePrice;
  const staleNote = stale ? " ⚠️ (precio puede estar desactualizado)" : "";
  return `$${last.toFixed(2)} | Bid: $${bid.toFixed(2)} | Ask: $${ask.toFixed(2)} | Fuente: ${source}${staleNote}`;
};

const formatNews = (ctx: ChatContext): string => {
  if (ctx.recentNews.length === 0) return "No hay noticias relevantes en las últimas 48h.";
  return ctx.recentNews
    .map(
      (n, i) =>
        `${i + 1}. [${n.impact.toUpperCase()}] ${n.title} — ${n.source} (${n.date})`
    )
    .join("\n");
};

const formatEvents = (ctx: ChatContext): string => {
  if (ctx.upcomingEvents.length === 0) return "No hay eventos económicos próximos registrados.";
  return ctx.upcomingEvents
    .map((e) => `• ${e.name} — Impacto: ${e.impact} | ${e.date}`)
    .join("\n");
};

const formatMemory = (ctx: ChatContext): string => {
  if (ctx.traderMemory.length === 0) return "Sin historial de patrones aún.";
  return ctx.traderMemory
    .map((m) => `• [${m.type}] ${m.content}`)
    .join("\n");
};

/**
 * Builds the system prompt for the AI financial assistant chat.
 * Injects live market context, news, events, and trader memory.
 */
export const buildAssistantSystemPrompt = (
  context: ChatContext,
  assistantName: string
): string => {
  const assetDesc = ASSET_DESCRIPTION[context.asset];

  return `Eres ${assistantName}, analista financiero senior especializado en ${assetDesc}
Tu audiencia es un prop trader activo que opera intradía y swing en ${context.asset}.

═══════════════════════════════════════════
CONTEXTO DE MERCADO ACTUAL — ${context.asset}
═══════════════════════════════════════════

PRECIO LIVE:
${formatPrice(context)}

NOTICIAS RECIENTES (últimas 48h, impacto medio/alto):
${formatNews(context)}

PRÓXIMOS EVENTOS ECONÓMICOS:
${formatEvents(context)}

${
  context.latestReportSummary
    ? `ÚLTIMO REPORTE DE ANÁLISIS (resumen):
${context.latestReportSummary}
`
    : ""
}
MEMORIA DEL TRADER (patrones y preferencias conocidos):
${formatMemory(context)}

═══════════════════════════════════════════
INSTRUCCIONES
═══════════════════════════════════════════

1. Responde SIEMPRE en español profesional y conciso.
2. No inventes precios, datos ni noticias. Solo usa lo que tienes en contexto.
3. Cuando das un sesgo (Bullish/Bearish/Neutral), indica tu nivel de confianza (%).
4. Si citas una noticia, menciona la fuente.
5. Si los datos son insuficientes, indícalo claramente y da tu mejor estimación con caveats.
6. Prioriza noticias de alto impacto (FOMC, CPI, NFP, GDP).
7. Sé directo y accionable. El trader necesita claridad para operar.
8. Puedes usar formato markdown (negritas, listas) para mayor claridad.`;
};
