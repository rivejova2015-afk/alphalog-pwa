import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getCoinarbAgent } from '@/lib/coinarb/agent';
import { getPgClient } from '@/lib/pg/client';
import { dayStartUtc, safeNumber } from '@/lib/coinarb/queries';

const MAX_SYMBOLS = 6;
const WINDOW_DAYS = 14;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const agent = await getCoinarbAgent(supabase, user.id);
  if (!agent) {
    return NextResponse.json({ window: `${WINDOW_DAYS}d`, symbols: [], matrix: [] });
  }

  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const sinceMs = new Date(since).getTime();

  // coinarb_positions is in-scope (own Postgres); the shim has no
  // `.not(col,'is',null)` / `.gte()` / `.limit()`. Fetch ordered rows and
  // apply the not-null + since-cutoff filter and the cap in JS. Both sides
  // of the date comparison go through `new Date(...).getTime()` — the pg
  // driver auto-parses `closed_at` (timestamptz) into a Date at runtime, and
  // a bare `Date >= string` comparison silently always evaluates false.
  const pg = getPgClient();
  const { data: rawRows, error } = await pg
    .from('coinarb_positions')
    .select('symbol, pnl_usd, closed_at')
    .eq('user_id', user.id)
    .eq('agent_id', agent.id)
    .is('deleted_at', null)
    .order('closed_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const data = ((rawRows ?? []) as unknown as {
    symbol: string | null; pnl_usd: number | string | null; closed_at: string | Date | null;
  }[])
    .filter((p) => p.closed_at !== null && new Date(p.closed_at).getTime() >= sinceMs)
    .slice(0, 2000);

  // Group daily pnl per symbol. Spot-only bot — symbol is the underlying coin already.
  const perSymbol = new Map<string, Map<string, number>>(); // symbol → day → pnl
  const counts = new Map<string, number>();

  for (const p of data) {
    const symbol = (typeof p.symbol === 'string' && p.symbol) ? p.symbol.replace(/-(USD|USDT)$/, '') : 'unknown';
    const pnl = safeNumber(p.pnl_usd) ?? 0;
    const closedAt = p.closed_at ? new Date(p.closed_at).getTime() : NaN;
    if (!Number.isFinite(closedAt)) continue;

    const day = dayStartUtc(new Date(closedAt)).toISOString().slice(0, 10);
    counts.set(symbol, (counts.get(symbol) ?? 0) + 1);
    const sym = perSymbol.get(symbol) ?? new Map<string, number>();
    sym.set(day, (sym.get(day) ?? 0) + pnl);
    perSymbol.set(symbol, sym);
  }

  const symbols = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_SYMBOLS)
    .map(([s]) => s);

  const allDays = new Set<string>();
  for (const sym of symbols) {
    for (const day of perSymbol.get(sym)?.keys() ?? []) allDays.add(day);
  }
  const days = Array.from(allDays).sort();

  const vectors = new Map<string, number[]>();
  for (const sym of symbols) {
    const inner = perSymbol.get(sym) ?? new Map<string, number>();
    vectors.set(sym, days.map(d => inner.get(d) ?? 0));
  }

  const matrix: Array<Array<number>> = [];
  for (const a of symbols) {
    const row: number[] = [];
    for (const b of symbols) {
      row.push(round(pearson(vectors.get(a) ?? [], vectors.get(b) ?? []), 3));
    }
    matrix.push(row);
  }

  return NextResponse.json(
    { window: `${WINDOW_DAYS}d`, symbols, matrix, days: days.length },
    { headers: { 'Cache-Control': 'private, max-age=300' } },
  );
}

function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  let sa = 0, sb = 0;
  for (let i = 0; i < n; i++) { sa += a[i]; sb += b[i]; }
  const ma = sa / n, mb = sb / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma;
    const y = b[i] - mb;
    num += x * y;
    da += x * x;
    db += y * y;
  }
  const denom = Math.sqrt(da * db);
  return denom > 0 ? num / denom : 0;
}

function round(n: number, dp: number): number {
  const k = 10 ** dp;
  return Math.round(n * k) / k;
}
