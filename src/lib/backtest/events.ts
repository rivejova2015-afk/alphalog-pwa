// Event-aware filter: skip bars near high-impact economic events.
// Reads from `terminal_events` (already populated by the news ingest).

import type { SupabaseClient } from "@supabase/supabase-js";

export interface EventWindow {
  ts: string;
  impact: "low" | "medium" | "high";
  name: string;
}

export interface EventFilterParams {
  bufferMinutesBefore: number;
  bufferMinutesAfter: number;
  minImpact: "low" | "medium" | "high";
}

export async function loadEventWindows(
  supabase: SupabaseClient,
  userId: string,
  symbol: string,
  fromIso: string,
  toIso: string,
): Promise<EventWindow[]> {
  const { data: instrument } = await supabase
    .from("instruments")
    .select("id")
    .eq("symbol", symbol.toUpperCase())
    .maybeSingle();

  let q = supabase
    .from("terminal_events")
    .select("name, impact, timestamp_utc")
    .eq("user_id", userId)
    .gte("timestamp_utc", fromIso)
    .lte("timestamp_utc", toIso)
    .is("deleted_at", null);
  if (instrument?.id) q = q.eq("instrument_id", instrument.id);

  const { data } = await q;
  if (!data) return [];

  return data.map((e) => ({
    ts: e.timestamp_utc as string,
    impact: (e.impact as "low" | "medium" | "high") ?? "low",
    name: e.name as string,
  }));
}

const IMPACT_RANK: Record<EventWindow["impact"], number> = { low: 1, medium: 2, high: 3 };

export function isInEventWindow(
  barIso: string,
  events: EventWindow[],
  params: EventFilterParams,
): { blocked: boolean; reason?: string } {
  const minRank = IMPACT_RANK[params.minImpact];
  const t = new Date(barIso).getTime();
  for (const e of events) {
    if (IMPACT_RANK[e.impact] < minRank) continue;
    const et = new Date(e.ts).getTime();
    const before = et - params.bufferMinutesBefore * 60_000;
    const after = et + params.bufferMinutesAfter * 60_000;
    if (t >= before && t <= after) return { blocked: true, reason: `${e.name} (${e.impact})` };
  }
  return { blocked: false };
}
