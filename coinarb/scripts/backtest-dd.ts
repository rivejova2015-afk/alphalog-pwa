/**
 * Backtest específico de Strategy DD (Daily Direction Scalper) sobre datos
 * históricos reales de Coinbase — reemplaza la validación "dejar correr en
 * paper y observar 2-3 días" por una respuesta inmediata.
 *
 * Camina la serie 1m candle-a-candle llamando al MISMO `detectDdSignal` que
 * usa el bot en vivo (cero duplicación de lógica), simula el fill con las
 * comisiones reales de Coinbase (0.6%/lado) y reporta P&L neto, win rate,
 * y breakdown de exit reasons.
 *
 * Uso:
 *   cd coinarb && npx tsx scripts/backtest-dd.ts --days=7
 *   cd coinarb && npx tsx scripts/backtest-dd.ts --days=7 --json
 *   cd coinarb && npx tsx scripts/backtest-dd.ts --days=30 --timeframe=5M --horizonHours=12
 */

import 'dotenv/config';
import { SYMBOLS, type Symbol, type Timeframe } from '../src/core/config.js';
import { loadHistoricalCandlesForDays, type Candle } from '../src/analysis/candle-builder.js';
import {
  DEFAULT_DD_CONFIG,
  detectDdSignal,
  getDailyDirection,
  getDailyOpenFromCandles,
  type DdDirection,
} from '../src/strategies/dd-daily-scalper.js';

const args = process.argv.slice(2);

// Fase A (rediseño de timeframe): detectDdSignal es agnóstico al timeframe
// — solo depende de la forma de las candles, no de su granularidad. Permite
// testear 1M/5M/15M sin tocar el detector, solo cambiando qué TF le pasamos.
const timeframeArg = args.find((a) => a.startsWith('--timeframe='));
const TIMEFRAME: Timeframe = (timeframeArg?.split('=')[1] as Timeframe) ?? '1M';
// loadHistoricalCandlesForDays cappea 1M a 7d (rate limits); en TFs más
// anchos (5M/15M) hay margen para ventanas más largas.
const MAX_DAYS = TIMEFRAME === '1M' ? 7 : 30;
const daysArg = args.find((a) => a.startsWith('--days='));
const DAYS = daysArg ? Math.max(1, Math.min(MAX_DAYS, Number(daysArg.split('=')[1] ?? String(MAX_DAYS)))) : (TIMEFRAME === '1M' ? 7 : 14);
const JSON_OUTPUT = args.includes('--json');
// Cooldowns escalan con el timeframe: en 1m, 3min post-trade = 3 velas; en
// 5m eso sería <1 vela (inútil), así que expresamos los cooldowns como
// múltiplos de N velas del TF elegido, no como minutos fijos.
const TF_MS: Record<Timeframe, number> = {
  '1D': 86_400_000, '4H': 14_400_000, '1H': 3_600_000,
  '30M': 1_800_000, '15M': 900_000, '5M': 300_000, '1M': 60_000,
};
const POST_TRADE_COOLDOWN_CANDLES = 3;
const FLIP_COOLDOWN_CANDLES = 10;
const horizonHoursArg = args.find((a) => a.startsWith('--horizonHours='));
const HORIZON_HOURS = horizonHoursArg ? Number(horizonHoursArg.split('=')[1]) : 4;

// Overrides para iteración rápida de tuning (Fase 2b) sin editar el archivo.
const directionThresholdArg = args.find((a) => a.startsWith('--directionThreshold='));
const minAtrPctArg = args.find((a) => a.startsWith('--minAtrPct='));
const minTpPctArg = args.find((a) => a.startsWith('--minTpPct='));
const rrTargetArg = args.find((a) => a.startsWith('--rrTarget='));
const slAtrMultArg = args.find((a) => a.startsWith('--slAtrMult='));
const CFG_OVERRIDES: Partial<typeof DEFAULT_DD_CONFIG> = {};
if (directionThresholdArg) CFG_OVERRIDES.directionThreshold = Number(directionThresholdArg.split('=')[1]);
if (minAtrPctArg) CFG_OVERRIDES.minAtrPct = Number(minAtrPctArg.split('=')[1]);
if (minTpPctArg) CFG_OVERRIDES.minTpPct = Number(minTpPctArg.split('=')[1]);
if (rrTargetArg) CFG_OVERRIDES.rrTarget = Number(rrTargetArg.split('=')[1]);
if (slAtrMultArg) CFG_OVERRIDES.slAtrMult = Number(slAtrMultArg.split('=')[1]);
const CFG = { ...DEFAULT_DD_CONFIG, ...CFG_OVERRIDES };

const TAKER_FEE_BPS = 60; // 0.60%/lado, igual que paper-spot-broker.ts
const POST_TRADE_COOLDOWN_MS = POST_TRADE_COOLDOWN_CANDLES * TF_MS[TIMEFRAME];
const FLIP_COOLDOWN_MS = FLIP_COOLDOWN_CANDLES * TF_MS[TIMEFRAME];

interface Trade {
  ts: number;
  symbol: Symbol;
  direction: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number;
  exitReason: 'TP' | 'SL' | 'TIMEOUT';
  grossPnlUsd: number;
  feeUsd: number;
  netPnlUsd: number;
  sizeUsd: number;
}

interface SymbolResult {
  symbol: Symbol;
  candlesWalked: number;
  skippedByReason: Record<string, number>;
  trades: Trade[];
}

/** Réplica minimal del sizing del runner en vivo: cap a 1× equity. */
function computeSizeUsd(equity: number, entryPrice: number, slPrice: number): number {
  const riskUsd = equity * 0.04;
  const slPct = Math.abs(slPrice - entryPrice) / entryPrice;
  if (!Number.isFinite(slPct) || slPct <= 0) return 0;
  return Math.min(riskUsd / slPct, equity);
}

async function backtestSymbol(symbol: Symbol, startingEquity: number): Promise<SymbolResult> {
  const hist = await loadHistoricalCandlesForDays(symbol, [TIMEFRAME], DAYS);
  const candles1m = hist.get(TIMEFRAME) ?? [];

  const skippedByReason: Record<string, number> = {};
  const trades: Trade[] = [];
  let equity = startingEquity;

  let lastDirection: DdDirection | undefined;
  let flipCooldownUntil = 0;
  let postTradeCooldownUntil = 0;

  // Warmup mínimo (igual al detector: emaPeriod/atrPeriod + margen).
  const warmup = Math.max(CFG.emaPeriod, CFG.atrPeriod + 1) + 5;

  for (let i = warmup; i < candles1m.length; i++) {
    const windowEnd = i + 1;
    const window = candles1m.slice(0, windowEnd);
    const now = candles1m[i].closeTs;

    // Flip detection (misma lógica que DdRunner.evaluateSymbol).
    const dailyOpen = getDailyOpenFromCandles(window, now);
    if (dailyOpen !== null) {
      const lastClose = window[window.length - 1].close;
      const currentDirection = getDailyDirection(lastClose, dailyOpen, CFG.directionThreshold);
      if (lastDirection !== undefined && lastDirection !== currentDirection) {
        flipCooldownUntil = now + FLIP_COOLDOWN_MS;
        lastDirection = currentDirection;
        skippedByReason['direction flip'] = (skippedByReason['direction flip'] ?? 0) + 1;
        continue;
      }
      lastDirection = currentDirection;
    }

    if (now < flipCooldownUntil) {
      skippedByReason['flip cooldown'] = (skippedByReason['flip cooldown'] ?? 0) + 1;
      continue;
    }
    if (now < postTradeCooldownUntil) {
      skippedByReason['post-trade cooldown'] = (skippedByReason['post-trade cooldown'] ?? 0) + 1;
      continue;
    }

    const signal = detectDdSignal(window, now, CFG);
    if (signal.side === null) {
      // Normalizar números a "#" para agrupar reasons por patrón (no por valor exacto).
      const key = signal.reason.replace(/[-+]?\d+\.?\d*/g, '#').trim();
      skippedByReason[key] = (skippedByReason[key] ?? 0) + 1;
      continue;
    }

    const sizeUsd = computeSizeUsd(equity, signal.entryPrice, signal.sl);
    if (sizeUsd < 5) {
      skippedByReason['position size below $5'] = (skippedByReason['position size below $5'] ?? 0) + 1;
      continue;
    }

    // Forward-walk desde i+1 buscando TP/SL. Horizonte fijo en horas
    // (no en cantidad de velas) para que sea comparable entre timeframes:
    // 4h en 1m son 240 velas, en 5m son 48, en 15m son 16.
    const HORIZON = Math.ceil((HORIZON_HOURS * 3_600_000) / TF_MS[TIMEFRAME]);
    const lastIdx = Math.min(candles1m.length - 1, i + HORIZON);
    let exitPrice = candles1m[lastIdx].close;
    let exitReason: 'TP' | 'SL' | 'TIMEOUT' = 'TIMEOUT';
    for (let j = i + 1; j <= lastIdx; j++) {
      const c = candles1m[j];
      if (signal.side === 'BUY') {
        if (c.low <= signal.sl) { exitPrice = signal.sl; exitReason = 'SL'; break; }
        if (c.high >= signal.tp) { exitPrice = signal.tp; exitReason = 'TP'; break; }
      } else {
        if (c.high >= signal.sl) { exitPrice = signal.sl; exitReason = 'SL'; break; }
        if (c.low <= signal.tp) { exitPrice = signal.tp; exitReason = 'TP'; break; }
      }
    }

    const grossPnl = signal.side === 'BUY'
      ? (exitPrice - signal.entryPrice) / signal.entryPrice * sizeUsd
      : (signal.entryPrice - exitPrice) / signal.entryPrice * sizeUsd;
    // Fee ida + vuelta, igual que paper-spot-broker + spot-positions.
    const feeUsd = (sizeUsd * TAKER_FEE_BPS) / 10_000 * 2;
    const netPnl = grossPnl - feeUsd;

    equity = Math.max(0, equity + netPnl);
    trades.push({
      ts: now, symbol, direction: signal.side, entryPrice: signal.entryPrice,
      exitPrice, exitReason, grossPnlUsd: grossPnl, feeUsd, netPnlUsd: netPnl, sizeUsd,
    });

    postTradeCooldownUntil = now + POST_TRADE_COOLDOWN_MS;
  }

  return { symbol, candlesWalked: candles1m.length - warmup, skippedByReason, trades };
}

function summarize(results: SymbolResult[]): void {
  const allTrades = results.flatMap((r) => r.trades);
  const totalNet = allTrades.reduce((s, t) => s + t.netPnlUsd, 0);
  const totalFees = allTrades.reduce((s, t) => s + t.feeUsd, 0);
  const wins = allTrades.filter((t) => t.netPnlUsd > 0).length;
  const winRate = allTrades.length > 0 ? (wins / allTrades.length) * 100 : 0;
  const tpCount = allTrades.filter((t) => t.exitReason === 'TP').length;
  const slCount = allTrades.filter((t) => t.exitReason === 'SL').length;
  const timeoutCount = allTrades.filter((t) => t.exitReason === 'TIMEOUT').length;
  const tradesPerDay = allTrades.length / DAYS;

  if (JSON_OUTPUT) {
    console.log(JSON.stringify({
      days: DAYS,
      totalTrades: allTrades.length,
      tradesPerDay: Number(tradesPerDay.toFixed(2)),
      winRate: Number(winRate.toFixed(2)),
      totalNetPnlUsd: Number(totalNet.toFixed(2)),
      totalFeesUsd: Number(totalFees.toFixed(2)),
      exitBreakdown: { TP: tpCount, SL: slCount, TIMEOUT: timeoutCount },
      bySymbol: results.map((r) => ({
        symbol: r.symbol,
        trades: r.trades.length,
        netPnlUsd: Number(r.trades.reduce((s, t) => s + t.netPnlUsd, 0).toFixed(2)),
        skippedByReason: r.skippedByReason,
      })),
    }, null, 2));
    return;
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`DD BACKTEST — ${DAYS}d histórico, ${SYMBOLS.length} símbolos`);
  console.log('='.repeat(60));
  console.log(`Total trades:     ${allTrades.length} (${tradesPerDay.toFixed(1)}/día)`);
  console.log(`Win rate:         ${winRate.toFixed(1)}%`);
  console.log(`P&L neto:         $${totalNet.toFixed(2)}`);
  console.log(`Fees pagados:     $${totalFees.toFixed(2)}`);
  console.log(`Exits: TP=${tpCount} SL=${slCount} TIMEOUT=${timeoutCount}`);
  console.log('');
  for (const r of results) {
    const symNet = r.trades.reduce((s, t) => s + t.netPnlUsd, 0);
    console.log(`--- ${r.symbol} ---`);
    console.log(`  trades=${r.trades.length} netPnl=$${symNet.toFixed(2)}`);
    const topSkips = Object.entries(r.skippedByReason).sort((a, b) => b[1] - a[1]).slice(0, 5);
    for (const [reason, count] of topSkips) {
      console.log(`  skip[${count}]: ${reason}`);
    }
  }
  console.log(`\n${'='.repeat(60)}`);
  console.log(totalNet > 0 ? '✅ RENTABLE en el histórico probado' : '❌ NO rentable en el histórico probado');
  console.log('='.repeat(60));
}

async function main(): Promise<void> {
  const STARTING_EQUITY = 100;
  const results: SymbolResult[] = [];
  for (const symbol of SYMBOLS) {
    if (!JSON_OUTPUT) console.log(`[backtest-dd] cargando ${DAYS}d de 1m candles para ${symbol}...`);
    const r = await backtestSymbol(symbol, STARTING_EQUITY);
    results.push(r);
  }
  summarize(results);
}

main().catch((err) => {
  console.error('[backtest-dd] failed:', err);
  process.exit(1);
});
