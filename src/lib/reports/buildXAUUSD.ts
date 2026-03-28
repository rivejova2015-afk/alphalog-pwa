import type { ScoredNewsItem } from "./buildBase";
import { buildReportBase } from "./buildBase";
import type { AIAnalysis } from "@/lib/terminal-ia/analyzeWithAI";

export const buildXAUUSDReport = (
  items: ScoredNewsItem[],
  aiAnalysis?: AIAnalysis | null
) => buildReportBase("XAUUSD", items, { aiAnalysis });
