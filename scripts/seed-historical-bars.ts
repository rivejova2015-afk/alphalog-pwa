// One-shot seed: fetch Yahoo + upsert into historical_bars for the 4 TFs the
// engine v1 funnel needs. Bypasses the UI/cron entirely; uses the service
// role key. Pass a symbol as arg (default: US500).
//
// Usage:  npx tsx scripts/seed-historical-bars.ts [SYMBOL]
//         npx tsx scripts/seed-historical-bars.ts EURUSD

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fetchYahooBars } from "../src/lib/backtest/yahoo-fetcher";
import type { Bar, Timeframe } from "../src/types/backtest";

function loadEnv() {
  const text = readFileSync(path.resolve(process.cwd(), ".env.local"), "utf8");
  const env: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const LOOKBACK_BY_TF: { tf: Timeframe; days: number }[] = [
  { tf: "D1",  days: 400 },
  { tf: "H1",  days: 60 },
  { tf: "M15", days: 30 },
  { tf: "M1",  days: 6 },
];

/* eslint-disable @typescript-eslint/no-explicit-any */
async function ingest(
  sb: SupabaseClient<any, "public", "public", any, any>,
  symbol: string,
  tf: Timeframe,
  bars: Bar[],
): Promise<{ inserted: number; oldest: string | null; newest: string | null }> {
/* eslint-enable @typescript-eslint/no-explicit-any */
  if (bars.length === 0) return { inserted: 0, oldest: null, newest: null };
  const rows = bars.map((b) => ({
    symbol, timeframe: tf, ts: b.ts,
    open: b.open, high: b.high, low: b.low, close: b.close,
    volume: b.volume, spread: b.spread ?? null,
    source: "yahoo", uploaded_by: null,
  }));
  for (let i = 0; i < rows.length; i += 1000) {
    const { error } = await sb
      .from("historical_bars")
      .upsert(rows.slice(i, i + 1000), { onConflict: "symbol,timeframe,ts" });
    if (error) throw new Error(error.message);
  }
  return { inserted: rows.length, oldest: bars[0].ts, newest: bars[bars.length - 1].ts };
}

async function main() {
  const symbol = process.argv[2] ?? "US500";
  const env = loadEnv();
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL ?? "", env.SUPABASE_SERVICE_ROLE_KEY ?? "");

  console.log(`seeding historical_bars for ${symbol}`);
  console.log("─".repeat(70));
  const now = new Date();
  for (const { tf, days } of LOOKBACK_BY_TF) {
    const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
    const to = now.toISOString();
    try {
      const bars = await fetchYahooBars(symbol, tf, from, to);
      const r = await ingest(sb, symbol, tf, bars);
      console.log(`${tf.padEnd(4)} ${days.toString().padStart(4)}d  →  ${String(r.inserted).padStart(5)} bars   ${r.oldest ?? "—"}   ${r.newest ?? "—"}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`${tf.padEnd(4)} ${days.toString().padStart(4)}d  →  ERROR  ${msg}`);
    }
  }
}

main().catch((e) => { console.error("fatal:", e); process.exit(99); });
