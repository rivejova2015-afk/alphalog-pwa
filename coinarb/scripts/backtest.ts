/**
 * Coinarb backtest — replay the SMC pipeline against N days of historical candles.
 *
 * Two modes:
 *   1. `--dryrun`        Single snapshot evaluation (default). Loads the
 *                        latest window per TF and reports per-symbol "would
 *                        enter right now?" verdict — useful for tuning.
 *   2. `--days=30`       Rolling replay over the last N days. Walks the
 *                        timeline in 15-minute steps, calling the same SMC
 *                        gates the live loop calls. For each hypothetical
 *                        entry, looks forward up to 4h of 5m bars to score
 *                        TP/SL outcome and aggregate PnL.
 *
 * The replay uses the canonical fetchExchangeCandles pagination so 30d × 1m =
 * 43,200 candles per symbol is no problem (capped at 10,080 = 7d for 1m to
 * keep one symbol's fetch under ~30s and stay inside Coinbase rate limits).
 *
 * Usage:
 *   cd coinarb && npx tsx scripts/backtest.ts                # snapshot
 *   cd coinarb && npx tsx scripts/backtest.ts --days=30      # 30-day replay
 */

import 'dotenv/config';
import {
  SYMBOLS, TIMEFRAMES, MTF_CONFIDENCE_MIN, ARB_GAP_MIN_PCT, RR_MIN,
  type Symbol, type Timeframe,
} from '../src/core/config.js';
import {
  loadHistoricalCandles,
  loadHistoricalCandlesForDays,
  type Candle,
} from '../src/analysis/candle-builder.js';
import { analyzeMtf } from '../src/analysis/mtf-analyzer.js';
import {
  evaluatePremiumDiscount,
  detectLiquiditySweep,
  validateChochDisplacement,
  evaluateConfluence,
  type SmcBias,
} from '../src/analysis/smc-detector.js';
import { scoreOutcome, STOP_PCT, FORWARD_HORIZON_5M_BARS } from '../src/backtest/scoring.js';

const args = process.argv.slice(2);
const daysArg = args.find(a => a.startsWith('--days='));
const DAYS = daysArg ? Math.max(1, Math.min(30, Number(daysArg.split('=')[1] ?? '30'))) : null;
const STEP_MIN = 15;                              // simulate one decision per 15 minutes
// When --json is passed, the script prints a machine-readable JSON summary on
// stdout AFTER the human-readable logs. CI quality gate scripts read this.
const JSON_OUTPUT = args.includes('--json');

// ─── Snapshot mode (legacy default) ──────────────────────────────────────────

interface SymbolReport {
  symbol: Symbol;
  candleCounts: Record<string, number>;
  mtfBias: SmcBias;
  mtfConfidence: number;
  mtfPasses: boolean;
  pdAllowed: boolean;
  pdReason: string;
  sweepDetected: boolean;
  chochConfirmed: boolean;
  chochReason: string;
  confluenceGrade: string;
  wouldEnter: boolean;
  blockedAt: string | null;
}

async function snapshotSymbol(symbol: Symbol): Promise<SymbolReport> {
  const candlesByTf = await loadHistoricalCandles(symbol, TIMEFRAMES);
  const candleCounts: Record<string, number> = {};
  for (const tf of TIMEFRAMES) candleCounts[tf] = candlesByTf.get(tf)?.length ?? 0;

  const result = evaluatePipeline(candlesByTf);
  return { symbol, candleCounts, ...result };
}

function printSnapshot(r: SymbolReport): void {
  console.log(`\n=== ${r.symbol} ===`);
  console.log(`  candles: ${Object.entries(r.candleCounts).map(([tf, n]) => `${tf}=${n}`).join(' ')}`);
  console.log(`  MTF: bias=${r.mtfBias} conf=${r.mtfConfidence.toFixed(3)} (>= ${MTF_CONFIDENCE_MIN.toFixed(2)} ? ${r.mtfPasses ? 'YES' : 'no'})`);
  console.log(`  PD:        ${r.pdAllowed ? 'YES' : 'no'} — ${r.pdReason}`);
  console.log(`  Sweep:     ${r.sweepDetected ? 'YES' : 'no'}`);
  console.log(`  CHOCH:     ${r.chochConfirmed ? 'YES' : 'no'} — ${r.chochReason}`);
  console.log(`  Confluence: ${r.confluenceGrade}`);
  console.log(`  Arb gap min: ${ARB_GAP_MIN_PCT[r.symbol]} (skipped — no live Binance feed)`);
  console.log(`  → ${r.wouldEnter ? 'WOULD ENTER' : `BLOCKED at ${r.blockedAt}`}`);
}

// ─── Replay mode (30d rolling) ───────────────────────────────────────────────

interface ReplayResult {
  symbol: Symbol;
  windowDays: number;
  ticks: number;
  blockedBy: Record<string, number>;
  entries: { ts: number; direction: 'BUY' | 'SELL'; entryPrice: number; outcome: 'TP' | 'SL' | 'TIMEOUT'; pnlR: number }[];
  totalPnlR: number;
  winRate: number;
  bestRun: number;   // largest consecutive wins
  worstRun: number;  // largest consecutive losses
}

async function replaySymbol(symbol: Symbol, days: number): Promise<ReplayResult> {
  console.log(`\n[replay] ${symbol} — fetching ${days}d of historical data…`);
  const fullByTf = await loadHistoricalCandlesForDays(symbol, TIMEFRAMES, days);

  // Need the 5m series as our master timeline + forward-pricing engine.
  const allFive = fullByTf.get('5M') ?? [];
  if (allFive.length < 100) {
    return emptyReplay(symbol, days);
  }

  // Skip the first ~24h so the SMC has zones/swings to detect against.
  const warmupBars = Math.min(288, Math.floor(allFive.length * 0.1));
  const startIdx = warmupBars;
  const endIdx = allFive.length - 1;
  // Step in STEP_MIN minute increments (3 × 5m bars).
  const stepBars = Math.max(1, Math.floor(STEP_MIN / 5));

  let ticks = 0;
  const blockedBy: Record<string, number> = {};
  const entries: ReplayResult['entries'] = [];

  for (let i = startIdx; i <= endIdx; i += stepBars) {
    ticks++;
    const ts = allFive[i].openTs;
    const windowed = sliceByTf(fullByTf, ts);

    const verdict = evaluatePipeline(windowed);

    if (!verdict.wouldEnter) {
      const key = verdict.blockedAt ?? 'unknown';
      blockedBy[key] = (blockedBy[key] ?? 0) + 1;
      continue;
    }

    const direction = (verdict.mtfBias === 'BUY' ? 'BUY' : 'SELL') as 'BUY' | 'SELL';
    const entryPrice = allFive[i].close;
    const outcome = scoreOutcome(allFive, i + 1, direction, entryPrice);
    const pnlR =
      outcome === 'TP'   ?  RR_MIN :
      outcome === 'SL'   ? -1 :
      /* TIMEOUT */         0;
    entries.push({ ts, direction, entryPrice, outcome, pnlR });
  }

  // Aggregate stats
  let totalPnlR = 0;
  let bestRun = 0, worstRun = 0;
  let curW = 0, curL = 0;
  for (const e of entries) {
    totalPnlR += e.pnlR;
    if (e.outcome === 'TP')      { curW++; curL = 0; bestRun  = Math.max(bestRun, curW); }
    else if (e.outcome === 'SL') { curL++; curW = 0; worstRun = Math.max(worstRun, curL); }
    else                         { curW = 0; curL = 0; }
  }
  const wins = entries.filter(e => e.outcome === 'TP').length;
  const winRate = entries.length > 0 ? wins / entries.length : 0;

  return { symbol, windowDays: days, ticks, blockedBy, entries, totalPnlR, winRate, bestRun, worstRun };
}

function emptyReplay(symbol: Symbol, days: number): ReplayResult {
  return { symbol, windowDays: days, ticks: 0, blockedBy: {}, entries: [], totalPnlR: 0, winRate: 0, bestRun: 0, worstRun: 0 };
}

/**
 * Build a candlesByTf map containing only candles closing strictly before `asOfTs`.
 * Mirrors what the live loop sees mid-tick when the most recent bar is in progress.
 */
function sliceByTf(full: Map<Timeframe, Candle[]>, asOfTs: number): Map<Timeframe, Candle[]> {
  const out = new Map<Timeframe, Candle[]>();
  for (const tf of TIMEFRAMES) {
    const arr = full.get(tf) ?? [];
    // Binary-search-friendly linear scan is fine here; arrays are sorted.
    let lo = 0, hi = arr.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (arr[mid].openTs <= asOfTs) lo = mid + 1;
      else hi = mid;
    }
    out.set(tf, arr.slice(0, lo));
  }
  return out;
}

function printReplay(r: ReplayResult): void {
  console.log(`\n=== ${r.symbol} (${r.windowDays}d, ${r.ticks} ticks) ===`);
  console.log(`  Entries:    ${r.entries.length}`);
  if (r.entries.length > 0) {
    const tp = r.entries.filter(e => e.outcome === 'TP').length;
    const sl = r.entries.filter(e => e.outcome === 'SL').length;
    const to = r.entries.filter(e => e.outcome === 'TIMEOUT').length;
    console.log(`    TP=${tp} SL=${sl} TIMEOUT=${to}`);
    console.log(`  Win rate:   ${(r.winRate * 100).toFixed(1)}%`);
    console.log(`  Total PnL:  ${r.totalPnlR.toFixed(2)}R  (${r.totalPnlR >= 0 ? '+' : ''}${(r.totalPnlR * 100).toFixed(0)}% on 1R risk)`);
    console.log(`  Streaks:    best ${r.bestRun}W · worst ${r.worstRun}L`);
  }
  const totalBlocked = Object.values(r.blockedBy).reduce((a, b) => a + b, 0);
  console.log(`  Blocked:    ${totalBlocked}/${r.ticks} ticks`);
  for (const [k, v] of Object.entries(r.blockedBy).sort((a, b) => b[1] - a[1]).slice(0, 5)) {
    console.log(`    ${k.padEnd(20)} ${v}`);
  }
}

// ─── Shared pipeline ─────────────────────────────────────────────────────────

interface PipelineResult {
  mtfBias: SmcBias;
  mtfConfidence: number;
  mtfPasses: boolean;
  pdAllowed: boolean;
  pdReason: string;
  sweepDetected: boolean;
  chochConfirmed: boolean;
  chochReason: string;
  confluenceGrade: string;
  wouldEnter: boolean;
  blockedAt: string | null;
}

function evaluatePipeline(candlesByTf: Map<Timeframe, Candle[]>): PipelineResult {
  const mtf = analyzeMtf(candlesByTf);
  const mtfPasses = mtf.bias !== 'NEUTRAL' && mtf.confidence >= MTF_CONFIDENCE_MIN;

  const last5m = candlesByTf.get('5M')?.slice(-1)[0];
  const currentPrice = last5m?.close ?? 0;

  const bias = (mtf.bias === 'NEUTRAL' ? 'BUY' : mtf.bias) as SmcBias;
  const sig15m = mtf.perTimeframe.get('15M')!;
  const sig5m  = mtf.perTimeframe.get('5M')!;
  const sig1m  = mtf.perTimeframe.get('1M')!;

  const pd = evaluatePremiumDiscount(
    currentPrice,
    candlesByTf.get('1D') ?? [],
    candlesByTf.get('5M') ?? [],
    bias,
    sig1m,
  );
  const sweep = detectLiquiditySweep(
    candlesByTf.get('5M') ?? [],
    candlesByTf.get('1M') ?? [],
    sig5m,
  );
  const choch = validateChochDisplacement(
    sig15m, sig5m, sig1m, bias, candlesByTf.get('1M') ?? [],
  );
  const confluence = evaluateConfluence(sig15m, bias, 0);

  let blockedAt: string | null = null;
  if (!mtfPasses) blockedAt = 'mtf';
  else if (!pd.allowed) blockedAt = 'premium-discount';
  else if (!sweep.detected) blockedAt = 'liquidity-sweep';
  else if (!choch.confirmed) blockedAt = 'choch-displacement';
  else if (confluence.grade === 'NONE') blockedAt = 'confluence';

  return {
    mtfBias: mtf.bias,
    mtfConfidence: mtf.confidence,
    mtfPasses,
    pdAllowed: pd.allowed,
    pdReason: pd.reason ?? `${pd.macroZone}/${pd.microZone}`,
    sweepDetected: sweep.detected,
    chochConfirmed: choch.confirmed,
    chochReason: choch.reason ?? 'ok',
    confluenceGrade: confluence.grade,
    wouldEnter: blockedAt === null,
    blockedAt,
  };
}

// ─── Entrypoint ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (DAYS) {
    console.log(`Coinarb backtest replay — ${DAYS} days, MTF_CONFIDENCE_MIN=${MTF_CONFIDENCE_MIN}, R:R=${RR_MIN}`);
    console.log(`Step = ${STEP_MIN}min · Horizon = ${FORWARD_HORIZON_5M_BARS * 5}min · Stop ±${STOP_PCT * 100}%\n`);

    const results: ReplayResult[] = [];
    for (const symbol of SYMBOLS) {
      const r = await replaySymbol(symbol, DAYS);
      results.push(r);
      printReplay(r);
    }

    const totalEntries = results.reduce((s, r) => s + r.entries.length, 0);
    const totalPnlR    = results.reduce((s, r) => s + r.totalPnlR, 0);
    console.log(`\n=== AGGREGATE (${DAYS}d) ===`);
    console.log(`  Total entries:  ${totalEntries} across ${SYMBOLS.length} symbols`);
    console.log(`  Combined PnL:   ${totalPnlR.toFixed(2)}R`);

    if (JSON_OUTPUT) {
      const wins = results.reduce((s, r) => s + r.entries.filter(e => e.outcome === 'TP').length, 0);
      const aggregateWinRate = totalEntries > 0 ? wins / totalEntries : 0;
      // JSON shape consumed by scripts/check-backtest-threshold.ts
      const summary = {
        mode: 'replay' as const,
        windowDays: DAYS,
        mtfConfidenceMin: MTF_CONFIDENCE_MIN,
        rrMin: RR_MIN,
        aggregate: {
          totalEntries,
          totalPnlR,
          winRate: aggregateWinRate,
        },
        symbols: results.map(r => ({
          symbol: r.symbol,
          entries: r.entries.length,
          winRate: r.winRate,
          totalPnlR: r.totalPnlR,
          bestRun: r.bestRun,
          worstRun: r.worstRun,
          blockedBy: r.blockedBy,
        })),
      };
      process.stdout.write('\n--- JSON ---\n' + JSON.stringify(summary) + '\n');
    }
  } else {
    console.log(`Coinarb backtest snapshot — MTF_CONFIDENCE_MIN=${MTF_CONFIDENCE_MIN}, symbols=${SYMBOLS.join(',')}\n`);
    const reports: SymbolReport[] = [];
    for (const symbol of SYMBOLS) {
      const r = await snapshotSymbol(symbol);
      reports.push(r);
      printSnapshot(r);
    }
    const wouldEnter = reports.filter(r => r.wouldEnter).length;
    const blockedBy: Record<string, number> = {};
    for (const r of reports) {
      if (r.blockedAt) blockedBy[r.blockedAt] = (blockedBy[r.blockedAt] ?? 0) + 1;
    }
    console.log(`\n=== SUMMARY ===`);
    console.log(`  Would enter: ${wouldEnter}/${reports.length}`);
    console.log(`  Blocked by:  ${Object.entries(blockedBy).map(([k, v]) => `${k}=${v}`).join(', ') || 'none'}`);

    if (JSON_OUTPUT) {
      const summary = {
        mode: 'snapshot' as const,
        mtfConfidenceMin: MTF_CONFIDENCE_MIN,
        wouldEnter,
        total: reports.length,
        blockedBy,
        symbols: reports.map(r => ({ symbol: r.symbol, wouldEnter: r.wouldEnter, blockedAt: r.blockedAt })),
      };
      process.stdout.write('\n--- JSON ---\n' + JSON.stringify(summary) + '\n');
    }
  }
}

main().catch(err => { console.error('[backtest] fatal:', err); process.exit(1); });
