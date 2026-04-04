import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptText } from "@/lib/security/encryption";
import type { Asset } from "@/lib/news/sources";

export type LivePrice = {
  last: number;
  bid: number;
  ask: number;
  change_pct?: number;
  source: string;
  stale: boolean;
};

export type ChatContext = {
  asset: Asset;
  recentNews: { title: string; source: string; impact: string; date: string }[];
  upcomingEvents: { name: string; impact: string; date: string }[];
  latestReportSummary?: string;
  livePrice?: LivePrice;
  traderMemory: { type: string; content: string; importance: number }[];
};

const safeDecrypt = (value: string): string => {
  try {
    return decryptText(value) ?? value;
  } catch {
    return value;
  }
};

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("es-PR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

/**
 * Builds market context for the AI chat assistant.
 * Runs 5 queries in parallel to minimize latency.
 */
export const buildChatContext = async (
  supabase: SupabaseClient,
  userId: string,
  asset: Asset
): Promise<ChatContext> => {
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  // Resolve instrument ID for this asset
  const { data: instrument } = await supabase
    .from("instruments")
    .select("id")
    .eq("symbol", asset)
    .single();

  const instrumentId = instrument?.id as string | undefined;

  const [newsResult, eventsResult, reportResult, priceResult, memoryResult] =
    await Promise.all([
      // 1. Recent news (last 48h, high/medium impact)
      instrumentId
        ? supabase
            .from("terminal_news")
            .select("title, source, impact_label, timestamp_utc")
            .eq("user_id", userId)
            .eq("instrument_id", instrumentId)
            .is("deleted_at", null)
            .gte("timestamp_utc", fortyEightHoursAgo)
            .in("impact_label", ["High", "Medium"])
            .order("timestamp_utc", { ascending: false })
            .limit(10)
        : Promise.resolve({ data: [] }),

      // 2. Upcoming economic events
      instrumentId
        ? supabase
            .from("terminal_events")
            .select("name, impact, timestamp_utc")
            .eq("user_id", userId)
            .eq("instrument_id", instrumentId)
            .is("deleted_at", null)
            .gte("timestamp_utc", now)
            .order("timestamp_utc", { ascending: true })
            .limit(3)
        : Promise.resolve({ data: [] }),

      // 3. Latest evidence report (summary)
      supabase
        .from("terminal_evidence_reports")
        .select("content, created_at")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1),

      // 4. Live price
      supabase
        .from("live_market_data")
        .select("bid, ask, last, source, received_at")
        .eq("symbol", asset)
        .limit(1)
        .single(),

      // 5. Trader memory (top by importance, asset-specific or global)
      supabase
        .from("terminal_assistant_memory")
        .select("memory_type, content, importance_score")
        .eq("user_id", userId)
        .or(`asset.eq.${asset},asset.is.null`)
        .order("importance_score", { ascending: false })
        .limit(5),
    ]);

  // Process news
  const recentNews = (newsResult.data ?? []).map((item) => ({
    title: safeDecrypt(item.title as string),
    source: item.source as string ?? "Fuente oficial",
    impact: (item.impact_label as string) ?? "Medium",
    date: formatDate(item.timestamp_utc as string),
  }));

  // Process events
  const upcomingEvents = (eventsResult.data ?? []).map((item) => ({
    name: safeDecrypt(item.name as string),
    impact: (item.impact as string) ?? "Unknown",
    date: formatDate(item.timestamp_utc as string),
  }));

  // Process latest report
  let latestReportSummary: string | undefined;
  const reportData = reportResult.data?.[0];
  if (reportData?.content) {
    const decrypted = safeDecrypt(reportData.content as string);
    latestReportSummary = decrypted.slice(0, 500);
  }

  // Process live price
  let livePrice: LivePrice | undefined;
  if (priceResult.data) {
    const p = priceResult.data;
    const receivedAt = new Date(p.received_at as string).getTime();
    const stale = Date.now() - receivedAt > 15 * 60 * 1000; // >15 min = stale
    livePrice = {
      last: p.last as number,
      bid: p.bid as number,
      ask: p.ask as number,
      source: p.source as string,
      stale,
    };
  }

  // Process memory
  const traderMemory = (memoryResult.data ?? []).map((item) => ({
    type: item.memory_type as string,
    content: item.content as string,
    importance: item.importance_score as number,
  }));

  return {
    asset,
    recentNews,
    upcomingEvents,
    latestReportSummary,
    livePrice,
    traderMemory,
  };
};
