import { createHash } from "crypto";
import type { Asset } from "@/lib/news/sources";
import type { NewsItem } from "@/lib/news/ingest";
import type { ImpactLabel } from "@/lib/news/impactScore";
import type { ReportBuild, ReportSection } from "./types";

export type ScoredNewsItem = NewsItem & { impact: ImpactLabel };

const formatDate = (date: Date) =>
  date.toLocaleDateString("es-PR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const pickBias = (items: ScoredNewsItem[]) => {
  const text = items.map((item) => item.title.toLowerCase()).join(" ");
  if (text.includes("rate hike") || text.includes("inflation") || text.includes("cpi")) {
    return "sesgo restrictivo";
  }
  if (text.includes("rate cut") || text.includes("stimulus") || text.includes("easing")) {
    return "sesgo expansivo";
  }
  return "sesgo neutral";
};

const buildSections = (items: ScoredNewsItem[]): ReportSection[] => {
  const sorted = [...items].sort(
    (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime()
  );
  const bullets = sorted.map((item) => {
    const impactLabel = item.impact === "high" ? "Alto" : "Medio";
    return `${item.title} (${impactLabel}, ${item.source}, ${formatDate(item.publishedAt)})`;
  });

  return [
    {
      title: "Pasado (últimos 7 días)",
      bullets: bullets.length > 0 ? bullets : ["Sin eventos medio/alto en los últimos 7 días."],
    },
    {
      title: "Ahora",
      bullets: [
        `Se detectaron ${sorted.length} eventos de impacto medio/alto en el lookback.`,
        `Sesgo estimado: ${pickBias(sorted)}.`,
      ],
    },
    {
      title: "Próximo",
      bullets: [
        "No se detectaron eventos futuros en el dataset de 7 días.",
        "Mantener monitoreo de calendario macro y comunicados oficiales.",
      ],
    },
  ];
};

export const buildReportBase = (asset: Asset, items: ScoredNewsItem[]): ReportBuild => {
  const relevantItems = items.filter((item) => item.impact !== "low");
  const relevantItemIds = relevantItems.map((item) => item.id).sort();
  const hash = createHash("sha256")
    .update(relevantItemIds.join("|"))
    .digest("hex");

  const title = `Reporte Terminal ${asset} - ${formatDate(new Date())}`;
  const sections = buildSections(relevantItems);
  const summary = `Resumen: ${relevantItems.length} eventos de impacto medio/alto en los últimos 7 días.`;

  const markdownSections = sections
    .map((section) => {
      const bullets = section.bullets.map((bullet) => `- ${bullet}`).join("\n");
      return `## ${section.title}\n${bullets}`;
    })
    .join("\n\n");

  const markdown = `# ${title}\n\n${summary}\n\n${markdownSections}\n`;

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
  };
};
