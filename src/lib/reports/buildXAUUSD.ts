import type { ScoredNewsItem } from "./buildBase";
import { buildReportBase } from "./buildBase";

export const buildXAUUSDReport = (items: ScoredNewsItem[]) =>
  buildReportBase("XAUUSD", items);
