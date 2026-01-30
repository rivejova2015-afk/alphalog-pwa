import type { ScoredNewsItem } from "./buildBase";
import { buildReportBase } from "./buildBase";

export const buildUS500Report = (items: ScoredNewsItem[]) =>
  buildReportBase("US500", items);
