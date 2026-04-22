import type { SizerParams, PositionResult, RecentTrade } from "./types";

// pip value XAUUSD por lote estándar:
// 1 pip = $0.01, contrato estándar = 100 oz → $1 por pip por lote
const PIP_VALUE_XAUUSD = 1.0;

// ─────────────────────────────────────────────────────────────────────────────
// Estadísticas de trading a partir de los últimos N trades cerrados
// ─────────────────────────────────────────────────────────────────────────────
function computeTradeStats(trades: RecentTrade[]): {
  winRate: number;
  avgRR: number;
} {
  if (trades.length === 0) {
    return { winRate: 0.5, avgRR: 1.5 }; // valores conservadores por defecto
  }

  const winners = trades.filter((t) => t.pnl > 0);
  const losers = trades.filter((t) => t.pnl < 0);

  const winRate = winners.length / trades.length;

  const avgWin =
    winners.length > 0
      ? winners.reduce((a, t) => a + t.pnl, 0) / winners.length
      : 0;
  const avgLoss =
    losers.length > 0
      ? Math.abs(losers.reduce((a, t) => a + t.pnl, 0)) / losers.length
      : 0;

  // Reward/Risk ratio: ganancia media sobre pérdida media
  // Si no hay pérdidas históricas, usar ratio conservador de 1
  const avgRR = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? 1.5 : 1.0;

  return {
    winRate: Math.max(0.01, Math.min(0.99, winRate)),
    avgRR: Math.max(0.1, avgRR),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Kelly fraccionado + Vol-Targeting combinado para XAUUSD
// ─────────────────────────────────────────────────────────────────────────────
// Fórmula Kelly: f* = (p·b - q) / b
//   p = win_rate, q = 1 - p, b = avg_rr
// Usamos 25% del Kelly óptimo (fracción conservadora estándar).
// Vol-Targeting ajusta el tamaño para que el riesgo por trade
// se mantenga proporcional a la volatilidad realizada vs el target.
export function calculatePositionSize(params: SizerParams): PositionResult {
  const {
    currentEquity,
    dailyPnlPct,
    signal,
    recentTrades,
    currentVol15m,
    volTarget,
    stopLossPips = 50,
  } = params;

  // ── 1. CIRCUIT BREAKER ───────────────────────────────────────────────────
  if (dailyPnlPct <= -0.25) {
    return {
      lots: 0,
      blocked: true,
      reason: "CIRCUIT_BREAKER_25PCT",
      kellyFraction: 0,
      volScalar: 0,
      riskPct: 0,
    };
  }

  // ── 2. KELLY FRACCIONADO ─────────────────────────────────────────────────
  const { winRate, avgRR } = computeTradeStats(recentTrades);

  const kellyFull =
    (winRate * avgRR - (1 - winRate)) / Math.max(avgRR, 0.01);
  const kellyRaw = kellyFull * 0.25; // 25% del Kelly óptimo

  // Clamp: nunca menos de 0.1% ni más de 5% del equity por trade
  const kellyFraction = Math.max(0.001, Math.min(kellyRaw, 0.05));

  // ── 3. VOL-TARGETING ─────────────────────────────────────────────────────
  const safeVol = Math.max(currentVol15m, 1e-6);
  const volScalarRaw = volTarget / safeVol;

  // No escalar más de 2x ni menos de 0.5x
  const volScalar = Math.max(0.5, Math.min(volScalarRaw, 2.0));

  // ── 4. SIZE FINAL ────────────────────────────────────────────────────────
  let riskPct = kellyFraction * volScalar;

  // Reducir size proporcionalmente a la confianza de la señal
  riskPct *= signal.confidence;

  // Modelo de sizing en lotes para XAUUSD:
  // lots = (equity × riskPct) / (stopLossPips × pip_value_por_lote)
  const riskDollars = currentEquity * riskPct;
  const stopLossValue = stopLossPips * PIP_VALUE_XAUUSD;

  let lots = stopLossValue > 0 ? riskDollars / stopLossValue : 0.01;

  // Redondear a 2 decimales y aplicar límites absolutos
  lots = Math.round(lots * 100) / 100;
  lots = Math.max(0.01, Math.min(lots, 5.0));

  return {
    lots,
    blocked: false,
    kellyFraction,
    volScalar,
    riskPct,
  };
}
