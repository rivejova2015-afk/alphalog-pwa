import type { Asset } from "@/lib/news/sources";

export type ReportSection = {
  title: string;
  bullets: string[];
};

export type SentimentLabel = "Buy" | "Sell" | "Neutral";

export type ReportBuild = {
  asset: Asset;
  title: string;
  summary: string;
  markdown: string;
  html: string;
  sections: ReportSection[];
  relevantItemIds: string[];
  hash: string;
  sentimentScore: number;
  sentimentLabel: SentimentLabel;
  incomplete: boolean;
  incompleteReasons: string[];
};
