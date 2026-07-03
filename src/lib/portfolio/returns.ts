// Carga series de retornos diarios reales por algoritmo, normalizados a %
// sobre el capital de referencia de cada uno — necesario para que HRP
// compare volatilidades de forma justa entre cuentas de distinto tamaño
// (una cuenta de $500 con PnL de $50/día no es "menos volátil" que una de
// $50k con PnL de $500/día; en % son idénticas).
//
// Tres fuentes según market_type:
//   - futures (CME/Tradovate): cme_trades_propfirm.algorithm_id (FK directo).
//     Capital de referencia: algo_cme_accounts.funded_amount.
//   - forex (MT5): trades NO tiene algorithm_id — se resuelve indirectamente
//     vía algorithm_deployments (activo) → bot_accounts.app_account_id →
//     accounts.account_size.
//   - crypto (coinarb): coinarb_daily_stats ya está pre-agregada por día
//     (agent_id = algorithms.id directamente — Coinarb vive como un algo
//     más desde la unificación Fase A). capital_start_usd por fila.
//   - options: sin path de ejecución real todavía → [].

import type { SupabaseClient } from "@supabase/supabase-js";

export interface DailyReturn {
  date: string; // YYYY-MM-DD
  returnPct: number;
}

export interface AlgorithmForReturns {
  id: string;
  market_type: string | null;
  parameters: Record<string, unknown> | null;
}

function cutoffDate(lookbackDays: number): string {
  return new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function aggregateByDay<T>(
  rows: T[],
  getDate: (row: T) => string,
  getPnl: (row: T) => number,
  capital: number,
): DailyReturn[] {
  if (capital <= 0) return [];
  const byDay = new Map<string, number>();
  for (const row of rows) {
    const day = getDate(row).slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + getPnl(row));
  }
  return Array.from(byDay.entries()).map(([date, pnl]) => ({
    date,
    returnPct: pnl / capital,
  }));
}

async function loadCmeReturns(
  svc: SupabaseClient,
  algorithmId: string,
  cmeAccountId: string,
  lookbackDays: number,
): Promise<DailyReturn[]> {
  const { data: account } = await svc
    .from("algo_cme_accounts")
    .select("funded_amount")
    .eq("id", cmeAccountId)
    .maybeSingle();
  const capital = Number(account?.funded_amount ?? 0);
  if (!capital) return [];

  const cutoff = new Date(cutoffDate(lookbackDays)).toISOString();
  const { data: trades } = await svc
    .from("cme_trades_propfirm")
    .select("pnl_usd, commission_usd, fill_timestamp")
    .eq("algorithm_id", algorithmId)
    .not("pnl_usd", "is", null)
    .gte("fill_timestamp", cutoff);

  const rows = (trades ?? []) as { pnl_usd: number; commission_usd: number | null; fill_timestamp: string }[];
  return aggregateByDay(
    rows,
    (r) => r.fill_timestamp,
    (r) => Number(r.pnl_usd ?? 0) - Number(r.commission_usd ?? 0),
    capital,
  );
}

async function loadForexReturns(
  svc: SupabaseClient,
  algorithmId: string,
  lookbackDays: number,
): Promise<DailyReturn[]> {
  const { data: deployment } = await svc
    .from("algorithm_deployments")
    .select("bot_account_id")
    .eq("algorithm_id", algorithmId)
    .eq("status", "active")
    .maybeSingle();
  if (!deployment?.bot_account_id) return [];

  const { data: botAccount } = await svc
    .from("bot_accounts")
    .select("app_account_id")
    .eq("id", deployment.bot_account_id)
    .maybeSingle();
  const accountId = botAccount?.app_account_id as string | null | undefined;
  if (!accountId) return [];

  const { data: account } = await svc
    .from("accounts")
    .select("account_size")
    .eq("id", accountId)
    .maybeSingle();
  const capital = Number(account?.account_size ?? 0);
  if (!capital) return [];

  const cutoff = cutoffDate(lookbackDays);
  const { data: trades } = await svc
    .from("trades")
    .select("pnl, exit_date")
    .eq("account_id", accountId)
    .is("deleted_at", null)
    .not("exit_date", "is", null)
    .gte("exit_date", cutoff);

  const rows = (trades ?? []) as { pnl: number | null; exit_date: string }[];
  return aggregateByDay(rows, (r) => r.exit_date, (r) => Number(r.pnl ?? 0), capital);
}

async function loadCryptoReturns(
  svc: SupabaseClient,
  algorithmId: string,
  lookbackDays: number,
): Promise<DailyReturn[]> {
  const cutoff = cutoffDate(lookbackDays);
  const { data: rows } = await svc
    .from("coinarb_daily_stats")
    .select("day_utc, total_pnl_usd, capital_start_usd")
    .eq("agent_id", algorithmId)
    .gte("day_utc", cutoff);

  return ((rows ?? []) as { day_utc: string; total_pnl_usd: number; capital_start_usd: number }[])
    .map((r) => {
      const capital = Number(r.capital_start_usd ?? 0);
      return {
        date: String(r.day_utc).slice(0, 10),
        returnPct: capital > 0 ? Number(r.total_pnl_usd ?? 0) / capital : 0,
      };
    })
    .filter((r) => Number.isFinite(r.returnPct));
}

/** Selecciona el loader correcto según market_type. [] si no hay path de datos. */
export async function loadAlgorithmReturns(
  svc: SupabaseClient,
  algo: AlgorithmForReturns,
  lookbackDays: number,
): Promise<DailyReturn[]> {
  if (algo.market_type === "crypto") {
    return loadCryptoReturns(svc, algo.id, lookbackDays);
  }
  if (algo.market_type === "futures") {
    const cmeAccountId = typeof algo.parameters?.cme_account_id === "string" ? algo.parameters.cme_account_id : null;
    if (!cmeAccountId) return [];
    return loadCmeReturns(svc, algo.id, cmeAccountId, lookbackDays);
  }
  if (algo.market_type === "forex") {
    return loadForexReturns(svc, algo.id, lookbackDays);
  }
  return [];
}

/** Calendario de `lookbackDays` días YYYY-MM-DD, del más viejo al más nuevo (hoy). */
export function buildCalendar(lookbackDays: number): string[] {
  const days: string[] = [];
  for (let i = lookbackDays - 1; i >= 0; i--) {
    days.push(new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  }
  return days;
}

/** Mapea una serie sparse de retornos a un calendario fijo — días sin trade
 *  cuentan como retorno 0 (supuesto razonable: un algo sistemático que no
 *  operó ese día ni ganó ni perdió). Necesario para que HRP compare series
 *  de igual longitud entre algoritmos con distinta frecuencia de trading. */
export function alignReturnsToCalendar(returns: DailyReturn[], calendar: string[]): number[] {
  const byDate = new Map(returns.map((r) => [r.date, r.returnPct]));
  return calendar.map((d) => byDate.get(d) ?? 0);
}

/** Cuántos días de la serie tienen actividad real (retorno != 0) — usado
 *  para filtrar algoritmos sin suficiente historial antes de correr HRP. */
export function countActiveDays(returns: DailyReturn[]): number {
  return returns.filter((r) => r.returnPct !== 0).length;
}
