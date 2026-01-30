import type { Asset } from "./sources";
import type { NewsItem } from "./ingest";

export type ImpactLabel = "low" | "medium" | "high";

const KEYWORDS: Record<Asset, { high: string[]; medium: string[] }> = {
  US500: {
    high: [
      "fomc",
      "fed",
      "interest rate",
      "rate hike",
      "rate cut",
      "cpi",
      "inflation",
      "pce",
      "nonfarm",
      "employment situation",
      "unemployment",
      "gdp",
      "recession",
      "downgrade",
      "bank stress",
    ],
    medium: [
      "ppi",
      "retail sales",
      "consumer confidence",
      "auction",
      "treasury",
      "sec",
      "earnings",
      "guidance",
      "risk",
    ],
  },
  XAUUSD: {
    high: [
      "gold",
      "bullion",
      "fed",
      "interest rate",
      "rate hike",
      "rate cut",
      "inflation",
      "cpi",
      "pce",
      "central bank",
      "yield",
      "recession",
    ],
    medium: [
      "ppi",
      "auction",
      "treasury",
      "employment",
      "usd",
      "liquidity",
      "risk",
    ],
  },
};

const containsKeyword = (text: string, keywords: string[]) =>
  keywords.some((keyword) => text.includes(keyword));

export const scoreImpact = (asset: Asset, item: NewsItem) => {
  const text = `${item.title} ${item.source ?? ""}`.toLowerCase();
  const keywords = KEYWORDS[asset];

  if (containsKeyword(text, keywords.high)) {
    return { label: "high" as ImpactLabel, score: 3 };
  }
  if (containsKeyword(text, keywords.medium)) {
    return { label: "medium" as ImpactLabel, score: 2 };
  }
  return { label: "low" as ImpactLabel, score: 1 };
};
