import type { ScoredNewsItem } from "./buildBase";
import { buildReportBase } from "./buildBase";
import type { AIAnalysis } from "@/lib/terminal-ia/analyzeWithAI";

export const buildUS500Report = (
  items: ScoredNewsItem[],
  aiAnalysis?: AIAnalysis | null
) => buildReportBase("US500", items, { aiAnalysis });
