/**
 * Supabase Edge Function: generate-scheduled-report
 * POST /functions/v1/generate-scheduled-report
 *
 * Genera reportes semanales AlphaBrief agregando datos reales de trades.
 * Persiste en la tabla weekly_reports con versionado.
 * Integrable con IA (OpenAI) si OPENAI_API_KEY esta disponible.
 */

// Use Deno.serve at runtime; TypeScript won't complain about the https:// URL
type ServeHandler = (req: Request) => Response | Promise<Response>;
const serve: (handler: ServeHandler) => void =
  (globalThis as any).Deno?.serve ??
  ((_: ServeHandler) => {
    throw new Error("Deno.serve is not available in this runtime");
  });

// @ts-ignore: Deno URL imports
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// @ts-ignore: Deno global
declare const Deno: { env: { get(k: string): string | undefined } };

interface ReportRequest {
  userId?: string;
  weekStart?: string;
  weekEnd?: string;
  includeAI?: boolean;
}

interface TradeRow {
  id: string;
  pnl: number;
  pnl_percent: number;
  status: string;
  entry_date: string;
  exit_date: string | null;
  symbol: string;
  direction: string;
  account_id: string;
}

function getSupabaseClient(authHeader?: string) {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
  });
}

function buildMarkdownReport(params: {
  weekStart: string;
  weekEnd: string;
  totalTrades: number;
  closedTrades: number;
  winningTrades: number;
  totalPnl: number;
  avgPnl: number;
  winRate: number;
  bestTrade: TradeRow | null;
  worstTrade: TradeRow | null;
  generatedAt: string;
}): string {
  const {
    weekStart, weekEnd, totalTrades, closedTrades,
    winningTrades, totalPnl, avgPnl, winRate,
    bestTrade, worstTrade, generatedAt,
  } = params;

  const pnlSign = totalPnl >= 0 ? "+" : "";
  const winRateStr = (winRate * 100).toFixed(1);

  return `# AlphaBrief - Semana ${weekStart} a ${weekEnd}

## Resumen Ejecutivo
- Período: ${weekStart} a ${weekEnd}
- Operaciones totales: ${totalTrades}
- Operaciones cerradas: ${closedTrades}
- Resultado: ${pnlSign}$${totalPnl.toFixed(2)} USD
- Tasa de Aciertos: ${winRateStr}%

## Performance General
| Métrica | Valor |
|---------|-------|
| Total de Trades | ${totalTrades} |
| Operaciones Cerradas | ${closedTrades} |
| Operaciones Ganadoras | ${winningTrades} |
| Tasa de Acierto | ${winRateStr}% |
| P&L Total | ${pnlSign}$${totalPnl.toFixed(2)} |
| P&L Promedio | ${avgPnl >= 0 ? "+" : ""}$${avgPnl.toFixed(2)} |

## Highlights
${bestTrade ? `- Mejor operación: +$${bestTrade.pnl.toFixed(2)} (${bestTrade.symbol}, ${bestTrade.direction})` : "- Sin operaciones ganadoras"}
${worstTrade ? `- Peor operación: $${worstTrade.pnl.toFixed(2)} (${worstTrade.symbol}, ${worstTrade.direction})` : "- Sin operaciones perdedoras"}

## Puntos de Acción
${winRate >= 0.6 ? "1. Mantener la disciplina — win rate sobre 60%" : "1. Revisar gestión de riesgo — win rate por debajo del objetivo"}
2. Documentar los setups ganadores de la semana
3. Analizar las operaciones perdedoras para identificar patrones

---
*Reporte generado automáticamente por AlphaShield el ${generatedAt}*
`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("OK", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") || undefined;
    const supabase = getSupabaseClient(authHeader);

    const body = (await req.json()) as ReportRequest;
    const now = new Date();

    // Resolve week range
    const weekEnd = body.weekEnd || now.toISOString().split("T")[0];
    const weekStart = body.weekStart || new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const generatedAt = now.toISOString();

    // Resolve user ID from JWT or body
    let userId = body.userId;
    if (!userId) {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized — provide userId or valid JWT" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      userId = userData.user.id;
    }

    console.log(`[generate-scheduled-report] Generating report for user ${userId}, ${weekStart} to ${weekEnd}`);

    // Fetch trades for the week
    const { data: trades, error: tradesError } = await supabase
      .from("trades")
      .select("id,pnl,pnl_percent,status,entry_date,exit_date,symbol,direction,account_id")
      .eq("user_id", userId)
      .gte("entry_date", `${weekStart}T00:00:00Z`)
      .lte("entry_date", `${weekEnd}T23:59:59Z`)
      .is("deleted_at", null) as { data: TradeRow[] | null; error: unknown };

    if (tradesError) {
      console.error("[generate-scheduled-report] Trades fetch error:", tradesError);
      return new Response(JSON.stringify({ error: "Failed to fetch trades" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const allTrades = trades ?? [];
    const closedTrades = allTrades.filter((t) => t.status === "closed" || t.exit_date !== null);
    const winningTrades = closedTrades.filter((t) => t.pnl > 0);
    const losingTrades = closedTrades.filter((t) => t.pnl < 0);

    const totalPnl = closedTrades.reduce((sum, t) => sum + Number(t.pnl), 0);
    const avgPnl = closedTrades.length > 0 ? totalPnl / closedTrades.length : 0;
    const winRate = closedTrades.length > 0 ? winningTrades.length / closedTrades.length : 0;

    const bestTrade = winningTrades.length > 0
      ? winningTrades.reduce((a, b) => a.pnl > b.pnl ? a : b)
      : null;
    const worstTrade = losingTrades.length > 0
      ? losingTrades.reduce((a, b) => a.pnl < b.pnl ? a : b)
      : null;

    const metrics = {
      totalTrades: allTrades.length,
      closedTrades: closedTrades.length,
      winningTrades: winningTrades.length,
      winRate: parseFloat(winRate.toFixed(4)),
      totalPnL: parseFloat(totalPnl.toFixed(2)),
      avgPnL: parseFloat(avgPnl.toFixed(2)),
    };

    const contentMd = buildMarkdownReport({
      weekStart,
      weekEnd,
      totalTrades: metrics.totalTrades,
      closedTrades: metrics.closedTrades,
      winningTrades: metrics.winningTrades,
      totalPnl: metrics.totalPnL,
      avgPnl: metrics.avgPnL,
      winRate,
      bestTrade,
      worstTrade,
      generatedAt,
    });

    // Determine next version number
    const { data: existingVersions } = await supabase
      .from("weekly_reports")
      .select("version")
      .eq("user_id", userId)
      .eq("week_start", weekStart)
      .eq("week_end", weekEnd)
      .is("deleted_at", null)
      .order("version", { ascending: false })
      .limit(1);

    const nextVersion = existingVersions && existingVersions.length > 0
      ? existingVersions[0].version + 1
      : 1;

    // Persist report
    const { data: insertedReport, error: insertError } = await supabase
      .from("weekly_reports")
      .insert({
        user_id: userId,
        week_start: weekStart,
        week_end: weekEnd,
        version: nextVersion,
        title: `AlphaBrief - Semana ${weekStart}`,
        content_md: contentMd,
        total_trades: metrics.totalTrades,
        total_pnl: metrics.totalPnL,
        win_rate: metrics.winRate,
      })
      .select("id,version")
      .single();

    if (insertError) {
      console.error("[generate-scheduled-report] Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to persist report" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`[generate-scheduled-report] Persisted report v${nextVersion} for user ${userId}`);

    return new Response(
      JSON.stringify({
        ok: true,
        message: "Report generated successfully",
        report: {
          id: insertedReport?.id,
          version: nextVersion,
          weekStart,
          weekEnd,
          generatedAt,
          content: contentMd,
          metrics,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[generate-scheduled-report] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
