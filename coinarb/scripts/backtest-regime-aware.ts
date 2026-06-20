/**
 * Coinarb regime backtest — replay the regime classifier over N days of
 * historical 1H candles and report what fraction of time each symbol spent
 * in each regime.
 *
 * Why: the current SMC pipeline only fits TRENDING_HIGH / RANGE_HIGH markets.
 * Strategy B (PR #36) addresses TRENDING_HIGH at runtime. Mean-reversion and
 * momentum-breakout (Phases 3/4) target RANGE_LOW / TRENDING_LOW. Before we
 * invest in those strategies, we need to know: how much of the time is the
 * market actually in each regime? If it's 90% RANGE_LOW, the plan is
 * justified. If it's 90% TRENDING_HIGH, we should fix SMC instead.
 *
 * This script reuses the loader from backtest.ts but does NOT replay SMC —
 * it only computes the regime distribution. Strategy-level replay comes when
 * Phases 3/4 ship the actual `Strategy` interface.
 *
 * Usage:
 *   cd coinarb && npx tsx scripts/backtest-regime-aware.ts --days=30
 *   cd coinarb && npx tsx scripts/backtest-regime-aware.ts --days=30 --json
 *   cd coinarb && npx tsx scripts/backtest-regime-aware.ts --symbol=BTC-USD --days=14
 */

import 'dotenv/config';
import { SYMBOLS, type Symbol } from '../src/core/config.js';
import { loadHistoricalCandlesForDays, type Candle } from '../src/analysis/candle-builder.js';
import {
  classifyRegime,
  DEFAULT_THRESHOLDS,
  type Regime,
  type RegimeResult,
} from '../src/analysis/regime-detector.js';

const args = process.argv.slice(2);
const daysArg = args.find((a) => a.startsWith('--days='));
const symbolArg = args.find((a) => a.startsWith('--symbol='));
const JSON_OUTPUT = args.includes('--json');

const DAYS = daysArg ? Math.max(1, Math.min(30, Number(daysArg.split('=')[1] ?? '30'))) : 14;
const SYMBOLS_TO_RUN: readonly Symbol[] = symbolArg
  ? [symbolArg.split('=')[1] as Symbol]
  : SYMBOLS;

interface PerRegimeStat {
  hoursInRegime: number;
  pct: number;
  avgConfidence: number;
  avgAtrNorm: number;
  avgAdx: number;
}

interface SymbolReport {
  symbol: Symbol;
  windowDays: number;
  totalHoursAnalyzed: number;
  transitions: number;
  distribution: Record<Regime, PerRegimeStat>;
}

const EMPTY_STAT: PerRegimeStat = {
  hoursInRegime: 0,
  pct: 0,
  avgConfidence: 0,
  avgAtrNorm: 0,
  avgAdx: 0,
};

const REGIME_LIST: readonly Regime[] = [
  'TRENDING_HIGH',
  'TRENDING_LOW',
  'RANGE_HIGH',
  'RANGE_LOW',
  'DEAD',
];

/** Walks the 1H series and classifies regime at each step. Pure, testable. */
export function regimeReplay(candles1H: Candle[], days: number, symbol: Symbol): SymbolReport {
  const distribution: Record<Regime, PerRegimeStat> = {
    TRENDING_HIGH: { ...EMPTY_STAT },
    TRENDING_LOW:  { ...EMPTY_STAT },
    RANGE_HIGH:    { ...EMPTY_STAT },
    RANGE_LOW:     { ...EMPTY_STAT },
    DEAD:          { ...EMPTY_STAT },
  };

  // Need at least baselineCandlesMin (200) to compute atrNorm. Skip warmup.
  const warmupIdx = DEFAULT_THRESHOLDS.baselineCandlesMin;
  if (candles1H.length <= warmupIdx) {
    return {
      symbol,
      windowDays: days,
      totalHoursAnalyzed: 0,
      transitions: 0,
      distribution,
    };
  }

  let prevRegime: Regime | undefined;
  let transitions = 0;
  let totalAnalyzed = 0;

  const sums: Record<Regime, { confidence: number; atrNorm: number; adx: number }> = {
    TRENDING_HIGH: { confidence: 0, atrNorm: 0, adx: 0 },
    TRENDING_LOW:  { confidence: 0, atrNorm: 0, adx: 0 },
    RANGE_HIGH:    { confidence: 0, atrNorm: 0, adx: 0 },
    RANGE_LOW:     { confidence: 0, atrNorm: 0, adx: 0 },
    DEAD:          { confidence: 0, atrNorm: 0, adx: 0 },
  };

  for (let i = warmupIdx; i < candles1H.length; i++) {
    const window = candles1H.slice(0, i + 1);
    const result: RegimeResult = classifyRegime(window, DEFAULT_THRESHOLDS, prevRegime);

    distribution[result.regime].hoursInRegime++;
    sums[result.regime].confidence += result.confidence;
    sums[result.regime].atrNorm += result.atrNorm;
    sums[result.regime].adx += result.adx;
    totalAnalyzed++;

    if (prevRegime !== undefined && prevRegime !== result.regime) transitions++;
    prevRegime = result.regime;
  }

  for (const regime of REGIME_LIST) {
    const stat = distribution[regime];
    if (stat.hoursInRegime > 0 && totalAnalyzed > 0) {
      stat.pct = stat.hoursInRegime / totalAnalyzed;
      stat.avgConfidence = sums[regime].confidence / stat.hoursInRegime;
      stat.avgAtrNorm = sums[regime].atrNorm / stat.hoursInRegime;
      stat.avgAdx = sums[regime].adx / stat.hoursInRegime;
    }
  }

  return {
    symbol,
    windowDays: days,
    totalHoursAnalyzed: totalAnalyzed,
    transitions,
    distribution,
  };
}

function printSymbolReport(report: SymbolReport): void {
  console.log(`\n=== ${report.symbol} ===`);
  console.log(`  window:        ${report.windowDays}d`);
  console.log(`  hours scored:  ${report.totalHoursAnalyzed}`);
  console.log(`  transitions:   ${report.transitions}`);
  console.log(`  distribution:`);
  for (const regime of REGIME_LIST) {
    const s = report.distribution[regime];
    const pctStr = (s.pct * 100).toFixed(1).padStart(5);
    const hoursStr = s.hoursInRegime.toString().padStart(4);
    const conf = s.avgConfidence.toFixed(2);
    const atr = s.avgAtrNorm.toFixed(2);
    const adx = s.avgAdx.toFixed(1);
    console.log(
      `    ${regime.padEnd(14)} ${pctStr}%  ${hoursStr}h  ` +
      `(conf=${conf}, atrNorm=${atr}, adx=${adx})`,
    );
  }
}

async function main(): Promise<void> {
  if (!JSON_OUTPUT) {
    console.log(`[regime-backtest] symbols=${SYMBOLS_TO_RUN.join(',')} days=${DAYS}`);
  }
  const reports: SymbolReport[] = [];
  for (const symbol of SYMBOLS_TO_RUN) {
    if (!JSON_OUTPUT) console.log(`\n[regime-backtest] ${symbol} — loading ${DAYS}d 1H candles…`);
    const byTf = await loadHistoricalCandlesForDays(symbol, ['1H'], DAYS);
    const candles = byTf.get('1H') ?? [];
    if (!JSON_OUTPUT) console.log(`  loaded ${candles.length} 1H candles`);
    const report = regimeReplay(candles, DAYS, symbol);
    reports.push(report);
    if (!JSON_OUTPUT) printSymbolReport(report);
  }

  if (JSON_OUTPUT) {
    console.log(JSON.stringify({ days: DAYS, reports }, null, 2));
  } else {
    console.log(`\n[regime-backtest] done. ${reports.length} symbol(s) analyzed.`);
  }
}

// Only run when invoked directly — keep importable for tests.
// import.meta.url ends with the file path when this is the entrypoint.
const invokedDirectly = import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) {
  main().catch((err) => {
    console.error('[regime-backtest] failed:', err);
    process.exit(1);
  });
}
