/**
 * Coinarb backtest — dry-run of the SMC pipeline against historical candles.
 *
 * Loads up to 200 candles per timeframe per symbol from Coinbase Exchange (no
 * credentials required), then runs the same gates the live loop runs and prints
 * a per-symbol verdict: bias, confidence, premium-discount, liquidity sweep,
 * CHoCH displacement, confluence.
 *
 * NOTE: full 30-day rolling backtest requires extending fetchExchangeCandles in
 * candle-builder.ts to paginate (Coinbase REST returns max 300 candles per
 * request). This script uses the same window the live bot sees, so it answers
 * "would the bot enter right now?" — useful for tuning thresholds without a
 * deploy cycle.
 *
 * Usage: cd coinarb && npx tsx scripts/backtest.ts
 */

import 'dotenv/config';
import { SYMBOLS, TIMEFRAMES, MTF_CONFIDENCE_MIN, ARB_GAP_MIN_PCT, type Symbol } from '../src/core/config.js';
import { loadHistoricalCandles } from '../src/analysis/candle-builder.js';
import { analyzeMtf } from '../src/analysis/mtf-analyzer.js';
import {
  evaluatePremiumDiscount,
  detectLiquiditySweep,
  validateChochDisplacement,
  evaluateConfluence,
  type SmcBias,
} from '../src/analysis/smc-detector.js';

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

async function backtestSymbol(symbol: Symbol): Promise<SymbolReport> {
  const candlesByTf = await loadHistoricalCandles(symbol, TIMEFRAMES);
  const candleCounts: Record<string, number> = {};
  for (const tf of TIMEFRAMES) candleCounts[tf] = candlesByTf.get(tf)?.length ?? 0;

  const mtf = analyzeMtf(candlesByTf);
  const mtfPasses = mtf.bias !== 'NEUTRAL' && mtf.confidence >= MTF_CONFIDENCE_MIN;

  // Use the latest 5m close as the "current" price for the validators.
  const last5m = candlesByTf.get('5M')?.slice(-1)[0];
  const currentPrice = last5m?.close ?? 0;

  const bias = (mtf.bias === 'NEUTRAL' ? 'BUY' : mtf.bias) as SmcBias;
  const pd = evaluatePremiumDiscount(
    currentPrice,
    candlesByTf.get('1D') ?? [],
    candlesByTf.get('5M') ?? [],
    bias,
  );

  const sig15m = mtf.perTimeframe.get('15M')!;
  const sig5m = mtf.perTimeframe.get('5M')!;
  const sig1m = mtf.perTimeframe.get('1M')!;

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
    symbol,
    candleCounts,
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

function printReport(r: SymbolReport): void {
  console.log(`\n=== ${r.symbol} ===`);
  console.log(`  candles: ${Object.entries(r.candleCounts).map(([tf, n]) => `${tf}=${n}`).join(' ')}`);
  console.log(`  MTF: bias=${r.mtfBias} conf=${r.mtfConfidence.toFixed(3)} (>= ${MTF_CONFIDENCE_MIN.toFixed(2)} ? ${r.mtfPasses ? 'YES' : 'no'})`);
  console.log(`  PD:        ${r.pdAllowed ? 'YES' : 'no'} — ${r.pdReason}`);
  console.log(`  Sweep:     ${r.sweepDetected ? 'YES' : 'no'}`);
  console.log(`  CHOCH:     ${r.chochConfirmed ? 'YES' : 'no'} — ${r.chochReason}`);
  console.log(`  Confluence: ${r.confluenceGrade}`);
  console.log(`  Arb gap min: ${ARB_GAP_MIN_PCT[r.symbol]} (skipped — backtest has no live Binance feed)`);
  console.log(`  → ${r.wouldEnter ? 'WOULD ENTER' : `BLOCKED at ${r.blockedAt}`}`);
}

async function main(): Promise<void> {
  console.log(`Coinarb backtest — MTF_CONFIDENCE_MIN=${MTF_CONFIDENCE_MIN}, symbols=${SYMBOLS.join(',')}\n`);
  const reports: SymbolReport[] = [];
  for (const symbol of SYMBOLS) {
    const r = await backtestSymbol(symbol);
    reports.push(r);
    printReport(r);
  }

  const wouldEnter = reports.filter(r => r.wouldEnter).length;
  const blockedBy: Record<string, number> = {};
  for (const r of reports) {
    if (r.blockedAt) blockedBy[r.blockedAt] = (blockedBy[r.blockedAt] ?? 0) + 1;
  }
  console.log(`\n=== SUMMARY ===`);
  console.log(`  Would enter: ${wouldEnter}/${reports.length}`);
  console.log(`  Blocked by: ${Object.entries(blockedBy).map(([k, v]) => `${k}=${v}`).join(', ') || 'none'}`);
}

main().catch(err => { console.error('[backtest] fatal:', err); process.exit(1); });
