import { createHash } from "crypto";
import type { Asset } from "@/lib/news/sources";
import type { NewsItem } from "@/lib/news/ingest";
import type { ImpactLabel } from "@/lib/news/impactScore";
import type { ReportBuild, ReportSection, SentimentLabel } from "./types";

export type ScoredNewsItem = NewsItem & { impact: ImpactLabel };

const formatDate = (date: Date, timeZone = "America/Puerto_Rico") =>
  date.toLocaleDateString("es-PR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone,
  });

const formatDateUtc = (date: Date) => formatDate(date, "UTC");

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const containsAny = (text: string, keywords: string[]) =>
  keywords.some((keyword) => text.includes(keyword));

const SENTIMENT_KEYWORDS: Record<Asset, { positive: string[]; negative: string[] }> = {
  US500: {
    positive: [
      "rate cut",
      "easing",
      "stimulus",
      "cooling inflation",
      "disinflation",
      "soft landing",
      "growth",
      "expansion",
      "lower yields",
    ],
    negative: [
      "rate hike",
      "tightening",
      "inflation",
      "recession",
      "downgrade",
      "bank stress",
      "risk",
      "higher yields",
      "slowdown",
    ],
  },
  XAUUSD: {
    positive: [
      "rate cut",
      "easing",
      "inflation",
      "uncertainty",
      "geopolitical",
      "central bank",
      "safe haven",
      "risk",
    ],
    negative: [
      "rate hike",
      "tightening",
      "strong dollar",
      "higher yields",
      "risk-on",
    ],
  },
};

const TOPIC_HINTS: Array<{ keywords: string[]; bullet: string }> = [
  {
    keywords: ["fomc", "fed", "rate", "monetary", "policy"],
    bullet: "La politica monetaria y comunicados del Fed dominaron el tono.",
  },
  {
    keywords: ["inflation", "cpi", "ppi", "pce", "prices"],
    bullet: "Datos de inflacion marcaron expectativas para el periodo.",
  },
  {
    keywords: ["employment", "jobs", "nonfarm", "unemployment"],
    bullet: "Indicadores de empleo influyeron en el sesgo de crecimiento.",
  },
  {
    keywords: ["treasury", "auction", "yield", "bond"],
    bullet: "Subastas del Tesoro y rendimientos ajustaron el apetito por riesgo.",
  },
  {
    keywords: ["sec", "regulatory", "compliance"],
    bullet: "Noticias regulatorias agregaron cautela en el mercado.",
  },
  {
    keywords: ["bank", "stress", "liquidity"],
    bullet: "Senales de liquidez o estres financiero impactaron el sentimiento.",
  },
];

const getYesterdayRangeUtc = () => {
  const now = new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1, 0, 0, 0, 0)
  );
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1, 23, 59, 59, 999)
  );
  return { start, end, label: formatDateUtc(start) };
};

const computeSentiment = (asset: Asset, items: ScoredNewsItem[]) => {
  const text = items.map((item) => item.title.toLowerCase()).join(" ");
  const keywords = SENTIMENT_KEYWORDS[asset];
  const positiveCount = keywords.positive.filter((keyword) => text.includes(keyword)).length;
  const negativeCount = keywords.negative.filter((keyword) => text.includes(keyword)).length;
  const rawScore = (positiveCount - negativeCount) * 20;
  const score = clamp(rawScore, -100, 100);
  const label: SentimentLabel =
    score > 15 ? "Buy" : score < -15 ? "Sell" : "Neutral";
  return { score, label };
};

const buildExplanationBullets = (
  items: ScoredNewsItem[],
  sentimentScore: number,
  sentimentLabel: SentimentLabel
) => {
  const text = items.map((item) => item.title.toLowerCase()).join(" ");
  const bullets: string[] = [];

  bullets.push(
    `sentiment_score: ${sentimentScore} | sentiment_label: ${sentimentLabel}.`
  );

  TOPIC_HINTS.forEach((hint) => {
    if (containsAny(text, hint.keywords)) {
      bullets.push(hint.bullet);
    }
  });

  const fallbacks = [
    `Se revisaron ${items.length} comunicados oficiales en los ultimos 7 dias.`,
    "Mantener monitoreo de comunicados oficiales y calendario macro.",
    "El sesgo puede cambiar con nuevas publicaciones oficiales.",
  ];

  for (const fallback of fallbacks) {
    if (bullets.length >= 3) break;
    bullets.push(fallback);
  }

  return bullets.slice(0, 5);
};

const buildYesterdaySection = (
  items: ScoredNewsItem[],
  sentimentScore: number,
  sentimentLabel: SentimentLabel,
  incompleteReasons: string[]
): ReportSection => {
  const { start, end, label } = getYesterdayRangeUtc();
  const yesterdayItems = items.filter(
    (item) => item.publishedAt >= start && item.publishedAt <= end
  );

  const recapKeywords = ["recap", "close", "closed", "ended", "session", "market"];
  const recapItems = yesterdayItems.filter((item) =>
    containsAny(item.title.toLowerCase(), recapKeywords)
  );

  if (recapItems.length === 0) {
    incompleteReasons.push("Sin recaps oficiales del dia anterior (UTC).");
    return {
      title: "Ayer en precio (segun recaps/noticias, UTC)",
      bullets: [
        "Informe incompleto: no hay recaps oficiales del dia anterior en las fuentes consultadas.",
      ],
    };
  }

  const focus = recapItems.slice(0, 3).map((item) => item.title);
  return {
    title: "Ayer en precio (segun recaps/noticias, UTC)",
    bullets: [
      `Segun recaps/noticias oficiales del ${label}, el foco estuvo en: ${focus.join("; ")}.`,
      `Sesgo informativo del dia: ${sentimentLabel} (score ${sentimentScore}).`,
    ],
  };
};

const buildSections = (
  allItems: ScoredNewsItem[],
  relevantItems: ScoredNewsItem[],
  sentimentScore: number,
  sentimentLabel: SentimentLabel,
  incompleteReasons: string[]
): ReportSection[] => {
  const sorted = [...relevantItems].sort(
    (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime()
  );
  const bullets = sorted.map((item) => {
    const impactLabel = item.impact === "high" ? "Alto" : "Medio";
    return `${item.title} (${impactLabel}, ${item.source}, ${formatDate(item.publishedAt)})`;
  });

  return [
    buildYesterdaySection(allItems, sentimentScore, sentimentLabel, incompleteReasons),
    {
      title: "Ultimos 7 dias (news-only)",
      bullets:
        bullets.length > 0
          ? bullets
          : ["Sin eventos medio/alto en los ultimos 7 dias."],
    },
    {
      title: "Sentimiento y sesgo",
      bullets: buildExplanationBullets(relevantItems, sentimentScore, sentimentLabel),
    },
    {
      title: "Proximo",
      bullets: [
        "No se detectaron eventos futuros en el dataset de 7 dias.",
        "Mantener monitoreo de calendario macro y comunicados oficiales.",
      ],
    },
  ];
};

type BuildOptions = {
  titleOverride?: string;
};

export const buildReportBase = (
  asset: Asset,
  items: ScoredNewsItem[],
  options: BuildOptions = {}
): ReportBuild => {
  const relevantItems = items.filter((item) => item.impact !== "low");
  const relevantItemIds = relevantItems.map((item) => item.id).sort();
  const hash = createHash("sha256")
    .update(relevantItemIds.join("|"))
    .digest("hex");

  const sentiment = computeSentiment(asset, relevantItems);
  const incompleteReasons: string[] = [];

  if (relevantItems.length === 0) {
    incompleteReasons.push("Sin eventos de impacto medio/alto en los ultimos 7 dias.");
  }

  const sections = buildSections(
    items,
    relevantItems,
    sentiment.score,
    sentiment.label,
    incompleteReasons
  );
  const incomplete = incompleteReasons.length > 0;

  const titleRaw = options.titleOverride?.trim();
  const title =
    titleRaw && titleRaw.length > 0
      ? titleRaw
      : `Reporte Terminal ${asset} - ${formatDateUtc(new Date())}`;

  const summaryParts = [
    `${incomplete ? "Informe incompleto" : "Informe completo"}: ${relevantItems.length} eventos de impacto medio/alto en los ultimos 7 dias.`,
    `sentiment_score: ${sentiment.score} | sentiment_label: ${sentiment.label}.`,
  ];

  if (incomplete) {
    summaryParts.push(`Motivos: ${incompleteReasons.join(" | ")}`);
  }

  const summary = summaryParts.join(" ");

  const markdownSections = sections
    .map((section) => {
      const bullets = section.bullets.map((bullet) => `- ${bullet}`).join("\n");
      return `## ${section.title}\n${bullets}`;
    })
    .join("\n\n");

  const statusNote = incomplete
    ? "\n\nEstado: Informe incompleto. Reintentar cuando haya nuevos comunicados oficiales.\n"
    : "\n";

  const markdown = `# ${title}\n\n${summary}${statusNote}\n${markdownSections}\n`;

  const htmlSections = sections
    .map(
      (section) =>
        `<h2>${section.title}</h2><ul>${section.bullets
          .map((bullet) => `<li>${bullet}</li>`)
          .join("")}</ul>`
    )
    .join("");

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8" /><title>${title}</title></head><body><h1>${title}</h1><p>${summary}</p>${htmlSections}</body></html>`;

  return {
    asset,
    title,
    summary,
    markdown,
    html,
    sections,
    relevantItemIds,
    hash,
    sentimentScore: sentiment.score,
    sentimentLabel: sentiment.label,
    incomplete,
    incompleteReasons,
  };
};
