import type { Asset } from "@/lib/news/sources";

export type ReportSection = {
  title: string;
  bullets: string[];
};

export type ReportBuild = {
  asset: Asset;
  title: string;
  summary: string;
  markdown: string;
  html: string;
  sections: ReportSection[];
  relevantItemIds: string[];
  hash: string;
};
