// Bulk MT5 → historical_bars importer. Scans a folder for *.csv, auto-detects
// symbol + timeframe from filename (see mt5-csv-parser.ts FILENAME_RE), parses,
// and upserts using the service role key from .env.local.
//
// Usage:
//   npx tsx scripts/import-mt5-bars.ts <folder> [--tz-offset N] [--dry-run]
//
// Examples:
//   npx tsx scripts/import-mt5-bars.ts ./mt5-export
//   npx tsx scripts/import-mt5-bars.ts ./mt5-export --tz-offset 120
//   npx tsx scripts/import-mt5-bars.ts ./mt5-export --dry-run

import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { parseMt5Csv, detectSymbolTfFromFilename } from "../src/lib/backtest/mt5-csv-parser";

const UPSERT_CHUNK = 1000;

function loadEnv() {
  const text = readFileSync(path.resolve(process.cwd(), ".env.local"), "utf8");
  const env: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

function parseArgs(argv: string[]) {
  const folder = argv[2];
  if (!folder) { console.error("Usage: npx tsx scripts/import-mt5-bars.ts <folder> [--tz-offset N] [--dry-run]"); process.exit(1); }
  let tzOffsetMinutes = 0;
  let dryRun = false;
  for (let i = 3; i < argv.length; i++) {
    if (argv[i] === "--tz-offset") tzOffsetMinutes = Number(argv[++i]) || 0;
    else if (argv[i] === "--dry-run") dryRun = true;
  }
  return { folder, tzOffsetMinutes, dryRun };
}

async function main() {
  const { folder, tzOffsetMinutes, dryRun } = parseArgs(process.argv);
  const env = loadEnv();
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL ?? "", env.SUPABASE_SERVICE_ROLE_KEY ?? "");

  const abs = path.resolve(process.cwd(), folder);
  if (!statSync(abs).isDirectory()) { console.error(`Not a directory: ${abs}`); process.exit(1); }

  const files = readdirSync(abs).filter((f) => f.toLowerCase().endsWith(".csv"));
  if (files.length === 0) { console.error(`No .csv files in ${abs}`); process.exit(0); }

  console.log(`MT5 import from ${abs}${dryRun ? "  [DRY RUN]" : ""}`);
  console.log(`tz offset: ${tzOffsetMinutes} min  |  files: ${files.length}`);
  console.log("─".repeat(90));
  console.log(`${"file".padEnd(40)} ${"sym".padEnd(8)} ${"tf".padEnd(4)} ${"bars".padStart(7)}   from → to`);
  console.log("─".repeat(90));

  let totalBars = 0;
  let totalErrors = 0;

  for (const file of files) {
    const filePath = path.join(abs, file);
    const detected = detectSymbolTfFromFilename(file);
    if (!detected) {
      console.log(`${file.padEnd(40)}   skip (filename doesn't match SYMBOL_TF.csv)`);
      continue;
    }
    const { symbol, tf } = detected;
    const text = readFileSync(filePath, "utf8");
    const parsed = parseMt5Csv(text, { tzOffsetMinutes });
    if (parsed.bars.length === 0) {
      console.log(`${file.padEnd(40)} ${symbol.padEnd(8)} ${tf.padEnd(4)}        no valid bars (${parsed.errors.length} errs)`);
      totalErrors += parsed.errors.length;
      continue;
    }

    const from = parsed.bars[0].ts;
    const to = parsed.bars[parsed.bars.length - 1].ts;

    if (!dryRun) {
      const rows = parsed.bars.map((b) => ({
        symbol, timeframe: tf, ts: b.ts,
        open: b.open, high: b.high, low: b.low, close: b.close,
        volume: b.volume, spread: b.spread,
        source: "mt5", uploaded_by: null,
      }));
      for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
        const { error } = await sb
          .from("historical_bars")
          .upsert(rows.slice(i, i + UPSERT_CHUNK), { onConflict: "symbol,timeframe,ts" });
        if (error) {
          console.error(`  upsert error at offset ${i}: ${error.message}`);
          totalErrors++;
          break;
        }
      }
    }

    console.log(`${file.padEnd(40)} ${symbol.padEnd(8)} ${tf.padEnd(4)} ${String(parsed.bars.length).padStart(7)}   ${from.slice(0, 10)} → ${to.slice(0, 10)}`);
    totalBars += parsed.bars.length;
    totalErrors += parsed.errors.length;
  }

  console.log("─".repeat(90));
  console.log(`total bars ${dryRun ? "would-insert" : "inserted"}: ${totalBars}${totalErrors > 0 ? `  (${totalErrors} row errors)` : ""}`);
}

main().catch((e) => { console.error("fatal:", e); process.exit(99); });
