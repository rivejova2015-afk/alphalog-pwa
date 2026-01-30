import { createHash } from "crypto";
import type { Asset, NewsSource } from "./sources";
import { getSourcesForAsset } from "./sources";

export type NewsItem = {
  id: string;
  title: string;
  url?: string;
  source: string;
  publishedAt: Date;
  asset: Asset;
};

type IngestResult = {
  items: NewsItem[];
  failures: { source: NewsSource; reason: string }[];
};

const decodeEntities = (value: string) =>
  value
    .replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

const extractTag = (block: string, tag: string) => {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = block.match(regex);
  return match ? decodeEntities(match[1].trim()) : "";
};

const extractAtomLink = (block: string) => {
  const linkMatch =
    block.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i) ||
    block.match(/<link[^>]*>(.*?)<\/link>/i);
  if (!linkMatch) return "";
  return decodeEntities(linkMatch[1].trim());
};

const parseFeed = (xml: string, source: NewsSource, asset: Asset) => {
  const isAtom = /<feed[\s>]/i.test(xml);
  const entries = isAtom
    ? xml.match(/<entry[\s\S]*?<\/entry>/gi)
    : xml.match(/<item[\s\S]*?<\/item>/gi);

  if (!entries) return [];

  return entries
    .map((entry) => {
      const title = extractTag(entry, "title");
      const url = isAtom ? extractAtomLink(entry) : extractTag(entry, "link");
      const publishedRaw =
        extractTag(entry, "pubDate") ||
        extractTag(entry, "published") ||
        extractTag(entry, "updated");
      const publishedAt = publishedRaw ? new Date(publishedRaw) : new Date();
      const safePublishedAt = Number.isNaN(publishedAt.getTime())
        ? new Date()
        : publishedAt;
      const idSeed = `${source.id}:${url || title}:${safePublishedAt.toISOString()}`;
      const id = createHash("sha1").update(idSeed).digest("hex");

      return {
        id,
        title: title || "Sin título",
        url: url || undefined,
        source: source.name,
        publishedAt: safePublishedAt,
        asset,
      } satisfies NewsItem;
    })
    .filter((item) => item.title);
};

export const ingestNewsForAsset = async (asset: Asset): Promise<IngestResult> => {
  const sources = getSourcesForAsset(asset);
  const items: NewsItem[] = [];
  const failures: IngestResult["failures"] = [];

  for (const source of sources) {
    try {
      const response = await fetch(source.url, {
        cache: "no-store",
      });
      if (!response.ok) {
        failures.push({
          source,
          reason: `HTTP ${response.status}`,
        });
        continue;
      }
      const xml = await response.text();
      items.push(...parseFeed(xml, source, asset));
    } catch (error) {
      failures.push({
        source,
        reason: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return { items, failures };
};
