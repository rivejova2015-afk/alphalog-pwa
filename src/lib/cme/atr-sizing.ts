// SL/TP sizing basado en ATR para Tradovate dispatcher.
//
// Reemplaza los defaults hardcoded (20/40 ticks) cuando el algo tiene
// parameters.atr_sl_multiplier / atr_tp_multiplier configurados. Cargá el
// ATR del símbolo desde historical_bars (última ventana de 14 barras del
// timeframe del algo) y multiplicá por los factors del usuario.
//
// Si el algo no tiene multipliers configurados o no hay bars suficientes,
// fallback a los defaults — el shadow log captura el comportamiento.

import type { SupabaseClient } from "@supabase/supabase-js";
import { atr } from "@/lib/backtest/indicators";

/** Tick sizes para los futuros CME más comunes. Convierte ATR(points) → ticks. */
const TICK_SIZE_BY_SYMBOL: Record<string, number> = {
  ES: 0.25, MES: 0.25,
  NQ: 0.25, MNQ: 0.25,
  YM: 1.0,  MYM: 1.0,
  RTY: 0.1, M2K: 0.1,
  GC: 0.1,  MGC: 0.1,
  SI: 0.005,
  CL: 0.01, MCL: 0.01,
  NG: 0.001,
  ZB: 0.03125, ZN: 0.015625, ZF: 0.0078125,
};

/** Limpia el ticker (`ESH4`, `ES H4`, `ESH4!`) al root (`ES`). */
function rootSymbol(contract: string): string {
  return contract.toUpperCase().replace(/[^A-Z]/g, "").replace(/(M?\w{2})[FGHJKMNQUVXZ]\d*$/, "$1");
}

export function tickSizeForContract(contract: string): number {
  const root = rootSymbol(contract);
  return TICK_SIZE_BY_SYMBOL[root] ?? 0.01;
}

export interface AtrTickResult {
  /** Si ambos null, el caller usa los defaults. */
  slTicks: number | null;
  tpTicks: number | null;
  /** ATR observado en points (informativo, para audit log). */
  atrPoints: number | null;
  /** Source — útil para debug. */
  source: "atr" | "no_multipliers" | "no_bars" | "atr_nan";
}

export interface AtrParams {
  atr_sl_multiplier?: number | null;
  atr_tp_multiplier?: number | null;
  atr_period?: number | null;
  atr_timeframe?: string | null;
}

/** Computa SL/TP ticks desde ATR de las últimas N barras del símbolo. */
export async function computeAtrSlTpTicks(
  svc: SupabaseClient,
  contract: string,
  params: AtrParams,
): Promise<AtrTickResult> {
  const slMul = num(params.atr_sl_multiplier);
  const tpMul = num(params.atr_tp_multiplier);
  if (slMul == null && tpMul == null) {
    return { slTicks: null, tpTicks: null, atrPoints: null, source: "no_multipliers" };
  }

  const period = Math.max(1, Math.round(num(params.atr_period) ?? 14));
  const timeframe = (params.atr_timeframe as string | null) ?? "M15";
  const lookback = period + 5;

  const { data: bars } = await svc
    .from("historical_bars")
    .select("ts, open, high, low, close, volume")
    .eq("symbol", contract)
    .eq("timeframe", timeframe)
    .order("ts", { ascending: false })
    .limit(lookback);

  if (!bars || bars.length < period + 1) {
    return { slTicks: null, tpTicks: null, atrPoints: null, source: "no_bars" };
  }

  // ordered ASC para el helper de indicators (espera cronológico).
  const ordered = [...(bars as { high: number | string; low: number; close: number; ts: string; open: number; volume: number }[])]
    .reverse()
    .map((b) => ({
      ts: b.ts,
      open: Number(b.open),
      high: Number(b.high),
      low: Number(b.low),
      close: Number(b.close),
      volume: Number(b.volume),
    }));

  const series = atr(ordered, period);
  const atrPoints = series[series.length - 1];
  if (!Number.isFinite(atrPoints) || atrPoints <= 0) {
    return { slTicks: null, tpTicks: null, atrPoints: null, source: "atr_nan" };
  }

  const tickSize = tickSizeForContract(contract);
  const atrTicks = atrPoints / tickSize;
  const slTicks = slMul != null ? Math.max(1, Math.round(atrTicks * slMul)) : null;
  const tpTicks = tpMul != null ? Math.max(1, Math.round(atrTicks * tpMul)) : null;

  return { slTicks, tpTicks, atrPoints, source: "atr" };
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}
