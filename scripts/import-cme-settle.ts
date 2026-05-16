// Bulk CME settlement importer. Scans a folder for `settle.YYYYMMDD.s.csv`
// files (the daily settlement files CME publishes free on their FTP), parses
// each, and upserts into historical_bars with source='cme'. Uses the service
// role key from .env.local so it bypasses RLS like the other seed scripts.
//
// Usage:
//   npx tsx scripts/import-cme-settle.ts <folder> [--symbol ES] [--dry-run]
//
// Examples:
//   # Import only ES contracts from a folder of settle files
//   npx tsx scripts/import-cme-settle.ts ./cme-data --symbol ES
//
//   # Preview what would be inserted, no DB writes
//   npx tsx scripts/import-cme-settle.ts ./cme-data --symbol NQ --dry-run
//
//   # Import everything (every product in every file)
//   npx tsx scripts/import-cme-settle.ts ./cme-data

import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { parseCmeCsv } from "../src/lib/backtest/cme-csv-parser";

const UPSERT_CHUNK = 1000;
const FILENAME_RE = /^settle\.\d{8}\.s\.csv$/i;

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
  if (!folder) {
    console.error("Usage: npx tsx scripts/import-cme-settle.ts <folder> [--symbol ES] [--dry-run]");
    process.exit(1);
  }
  let symbol: string | undefined;
  let dryRun = false;
  for (let i = 3; i < argv.length; i++) {
    if (argv[i] === "--symbol") symbol = argv[++i]?.toUpperCase();
    else if (argv[i] === "--dry-run") dryRun = true;
  }
  return { folder, symbol, dryRun };
}

async function main() {
  const { folder, symbol, dryRun } = parseArgs(process.argv);
  const env = loadEnv();
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL ?? "", env.SUPABASE_SERVICE_ROLE_KEY ?? "");

  const abs = path.resolve(process.cwd(), folder);
  if (!statSync(abs).isDirectory()) { console.error(`Not a directory: ${abs}`); process.exit(1); }

  const files = readdirSync(abs).filter((f) => FILENAME_RE.test(f));
  if (files.length === 0) {
    console.error(`No settle.*.s.csv files in ${abs}`);
    process.exit(0);
  }

  console.log(`CME settlement import from ${abs}${dryRun ? "  [DRY RUN]" : ""}`);
  console.log(`filter: symbol=${symbol ?? "(all)"}  |  files: ${files.length}`);
  console.log("─".repeat(90));
  console.log(`${"file".padEnd(28)} ${"contracts".padEnd(40)} ${"bars".padStart(7)}   range`);
  console.log("─".repeat(90));

  let totalBars = 0;
  let totalErrors = 0;
  const allContracts = new Set<string>();

  for (const file of files) {
    const text = readFileSync(path.join(abs, file), "utf8");
    const parsed = parseCmeCsv(text, { filterSymbol: symbol });

    parsed.contractsSeen.forEach((c) => allContracts.add(c));

    if (parsed.bars.length === 0) {
      const note = symbol
        ? `no rows for ${symbol} (seen: ${parsed.contractsSeen.slice(0, 6).join(",")}${parsed.contractsSeen.length > 6 ? "…" : ""})`
        : `no valid bars (${parsed.errors.length} errs)`;
      console.log(`${file.padEnd(28)} ${"".padEnd(40)}        ${note}`);
      totalErrors += parsed.errors.length;
      continue;
    }

    const from = parsed.bars[0].ts.slice(0, 10);
    const to   = parsed.bars[parsed.bars.length - 1].ts.slice(0, 10);
    const sym  = symbol ?? "(multi)";

    if (!dryRun) {
      // Group bars by the symbol we'll persist them under. When --symbol is
      // set, everything goes to that symbol. Without --symbol, we use each
      // contract's SubProductSymbol (already reflected in contractsSeen).
      // For the multi-symbol case we'd need per-contract parsing — for
      // simplicity, this script requires --symbol.
      if (!symbol) {
        console.log(`${file.padEnd(28)} ${parsed.contractsSeen.join(",").slice(0, 40).padEnd(40)} ${String(parsed.bars.length).padStart(7)}   skip — pass --symbol to persist`);
        continue;
      }
      const rows = parsed.bars.map((b) => ({
        symbol, timeframe: "D1" as const, ts: b.ts,
        open: b.open, high: b.high, low: b.low, close: b.close,
        volume: b.volume, spread: b.spread,
        source: "cme" as const,
        uploaded_by: null,
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

    const contractDisplay = parsed.contractsSeen.join(",").slice(0, 40);
    console.log(`${file.padEnd(28)} ${contractDisplay.padEnd(40)} ${String(parsed.bars.length).padStart(7)}   ${from} → ${to}${dryRun ? "  [dry]" : `  → ${sym}`}`);
    totalBars += parsed.bars.length;
    totalErrors += parsed.errors.length;
  }

  console.log("─".repeat(90));
  console.log(`total bars ${dryRun ? "would-insert" : "inserted"}: ${totalBars}${totalErrors > 0 ? `  (${totalErrors} row errors)` : ""}`);
  console.log(`distinct contracts seen across all files: ${Array.from(allContracts).sort().join(", ")}`);
  if (!symbol && !dryRun) {
    console.log("\nNote: pass --symbol <CODE> to persist a specific product (e.g. --symbol ES).");
  }
}

main().catch((e) => { console.error("fatal:", e); process.exit(99); });
