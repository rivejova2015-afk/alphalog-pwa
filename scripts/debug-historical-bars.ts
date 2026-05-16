// One-shot diagnostic: what's actually in historical_bars?
// Reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import path from "node:path";

function loadEnv() {
  const text = readFileSync(path.resolve(process.cwd(), ".env.local"), "utf8");
  const env: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) { console.error("Missing SUPABASE_URL or SERVICE_ROLE_KEY"); process.exit(1); }

  const sb = createClient(url, key);

  // Fetch all bars (could be huge — limit to head/tail per symbol/tf via window).
  // Use raw select since postgrest doesn't aggregate well.
  const { data, error } = await sb
    .from("historical_bars")
    .select("symbol, timeframe, ts")
    .order("ts", { ascending: true })
    .limit(50000);

  if (error) { console.error("query error:", error); process.exit(2); }
  if (!data || data.length === 0) {
    console.log("historical_bars is EMPTY.");
    process.exit(0);
  }

  const buckets = new Map<string, { count: number; min: string; max: string }>();
  for (const row of data as { symbol: string; timeframe: string; ts: string }[]) {
    const key = `${row.symbol}|${row.timeframe}`;
    const b = buckets.get(key);
    if (!b) buckets.set(key, { count: 1, min: row.ts, max: row.ts });
    else { b.count++; if (row.ts < b.min) b.min = row.ts; if (row.ts > b.max) b.max = row.ts; }
  }

  console.log(`historical_bars rows scanned: ${data.length}`);
  console.log("");
  console.log(`${"symbol".padEnd(10)} ${"tf".padEnd(5)} ${"count".padStart(7)}   oldest                       newest`);
  console.log("─".repeat(90));
  const rows = [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b));
  for (const [k, b] of rows) {
    const [sym, tf] = k.split("|");
    console.log(`${sym.padEnd(10)} ${tf.padEnd(5)} ${String(b.count).padStart(7)}   ${b.min}   ${b.max}`);
  }
}

main().catch((e) => { console.error("fatal:", e); process.exit(99); });
