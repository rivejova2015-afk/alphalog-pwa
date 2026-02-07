import type { SupabaseClient } from "@supabase/supabase-js";
import type { Asset } from "@/lib/news/sources";
import { ingestNewsForAsset } from "@/lib/news/ingest";
import { dedupeNews } from "@/lib/news/dedupe";
import { scoreImpact } from "@/lib/news/impactScore";
import { buildUS500Report } from "@/lib/reports/buildUS500";
import { buildXAUUSDReport } from "@/lib/reports/buildXAUUSD";
import { saveReportEvidence } from "@/lib/evidence/saveReport";
import { reportLog } from "@/lib/logging/reportLogs";
import type { ScoredNewsItem } from "@/lib/reports/buildBase";
import type { ReportBuild } from "@/lib/reports/types";

type RunReportInput = {
  supabase: SupabaseClient;
  userId: string;
  asset: Asset;
  lookbackDays: number;
};

export type RunReportOutcome = "done" | "done_no_changes" | "failed";

export type RunReportResult = {
  asset: Asset;
  outcome: RunReportOutcome;
  reportId?: string;
  relevantCount: number;
  newCount: number;
  incomplete?: boolean;
  incompleteReasons?: string[];
};

const buildReport = (asset: Asset, items: ScoredNewsItem[]): ReportBuild => {
  if (asset === "US500") return buildUS500Report(items);
  return buildXAUUSDReport(items);
};

const getInstrumentId = async (
  supabase: SupabaseClient,
  symbol: Asset
): Promise<string | null> => {
  const { data, error } = await supabase
    .from("instruments")
    .select("id")
    .eq("symbol", symbol)
    .single();

  if (error || !data) {
    return null;
  }
  return data.id as string;
};

const toArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(String) : [];

export const runReportPipeline = async ({
  supabase,
  userId,
  asset,
  lookbackDays,
}: RunReportInput): Promise<RunReportResult> => {
  reportLog.start(`Inicio reporte ${asset}`, { asset, userId });

  try {
    const { items, failures } = await ingestNewsForAsset(asset);
    if (failures.length > 0) {
      reportLog.failure(`Fuentes fallidas ${asset}`, new Error("Sources failed"), {
        failures: failures.map((f) => `${f.source.name}: ${f.reason}`),
      });
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - lookbackDays);

    const filtered = items.filter((item) => item.publishedAt >= cutoff);
    const deduped = dedupeNews(filtered);
    const scored: ScoredNewsItem[] = deduped.map((item) => ({
      ...item,
      impact: scoreImpact(asset, item).label,
    }));

    const relevant = scored.filter((item) => item.impact !== "low");
    const relevantIds = relevant.map((item) => item.id);

    const { data: state } = await supabase
      .from("terminal_report_state")
      .select("id, last_item_ids")
      .eq("user_id", userId)
      .eq("asset", asset)
      .maybeSingle();

    const previousIds = toArray(state?.last_item_ids);
    const previousSet = new Set(previousIds);
    const newItems = relevantIds.filter((id) => !previousSet.has(id));

    if (newItems.length === 0) {
      await supabase
        .from("terminal_report_state")
        .upsert({
          user_id: userId,
          asset,
          last_item_ids: previousIds,
          last_checked_at: new Date().toISOString(),
        });

      reportLog.noChanges(`Sin cambios relevantes ${asset}`, {
        asset,
        relevantCount: relevantIds.length,
      });

      return {
        asset,
        outcome: "done_no_changes",
        relevantCount: relevantIds.length,
        newCount: 0,
        incomplete: false,
        incompleteReasons: [],
      };
    }

    const report = buildReport(asset, scored);
    const instrumentId = await getInstrumentId(supabase, asset);
    const { reportId } = await saveReportEvidence({
      userId,
      instrumentId,
      report,
    });

    await supabase
      .from("terminal_report_state")
      .upsert({
        user_id: userId,
        asset,
        last_item_ids: report.relevantItemIds,
        last_hash: report.hash,
        last_report_at: new Date().toISOString(),
        last_checked_at: new Date().toISOString(),
      });

    reportLog.success(`Reporte guardado ${asset}`, {
      reportId,
      relevantCount: report.relevantItemIds.length,
    });

    return {
      asset,
      outcome: "done",
      reportId,
      relevantCount: report.relevantItemIds.length,
      newCount: newItems.length,
      incomplete: report.incomplete,
      incompleteReasons: report.incompleteReasons,
    };
  } catch (error) {
    reportLog.failure(`Fallo reporte ${asset}`, error, { asset, userId });
    return {
      asset,
      outcome: "failed",
      relevantCount: 0,
      newCount: 0,
      incomplete: false,
      incompleteReasons: [],
    };
  }
};
