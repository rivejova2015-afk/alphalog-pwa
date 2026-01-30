import type { NewsItem } from "./ingest";

const normalizeTitle = (value: string) =>
  value
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const dedupeNews = (items: NewsItem[]) => {
  const seen = new Set<string>();
  const result: NewsItem[] = [];

  for (const item of items) {
    const key =
      (item.url ? `url:${item.url}` : null) ??
      `title:${normalizeTitle(item.title)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
};

export const getNormalizedTitle = normalizeTitle;
