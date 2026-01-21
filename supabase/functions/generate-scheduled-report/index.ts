/**
 * Supabase Edge Function: generate-scheduled-report
 * POST /functions/v1/generate-scheduled-report
 * 
 * Genera reportes semanales AlphaBrief agregando datos de trades, noticias, eventos
 * Integrable con IA (OpenAI) para generar análisis
 */

// Use Deno.serve at runtime; TypeScript won't complain about the https:// URL
type ServeHandler = (req: Request) => Response | Promise<Response>;
const serve: (handler: ServeHandler) => void =
  (globalThis as any).Deno?.serve ??
  ((_: ServeHandler) => {
    throw new Error("Deno.serve is not available in this runtime");
  });

interface ReportRequest {
  userId?: string;
  weekStart?: string;
  weekEnd?: string;
  includeAI?: boolean;
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("OK", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = (await req.json()) as ReportRequest;
    const now = new Date();
    const weekStart = body.weekStart || new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const weekEnd = body.weekEnd || now.toISOString().split("T")[0];

    console.log(`[generate-scheduled-report] Generating report for ${weekStart} to ${weekEnd}`);

    // TODO: In production, use Supabase client to:
    // 1. Fetch trades, news, events, terminal_evidence_reports from database
    // 2. Aggregate metrics (totalTrades, totalPnL, winRate, etc.)
    // 3. Call OpenAI API if includeAI=true
    // 4. Generate markdown report
    // 5. Insert into weekly_reports table

    // For now, return stub response
    const stubReport = `# AlphaBrief - Semana ${weekStart} a ${weekEnd}

## 📋 Resumen Ejecutivo
- Período: ${weekStart} a ${weekEnd}
- Operaciones: 5
- Resultado: +$1,250 USD (P&L)
- Tasa de Aciertos: 60%

## 📊 Performance General
| Métrica | Valor |
|---------|-------|
| Total de Trades | 5 |
| Operaciones Cerradas | 5 |
| Operaciones Ganadoras | 3 |
| Tasa de Acierto | 60% |
| P&L Total | +$1,250 |
| P&L Promedio | +$250 |

## 💼 Desglose por Cuenta
### Cuenta Propfirm Forex
- Operaciones: 5
- P&L: +$1,250
- Win Rate: 60%
- Promedio: +$250

## 🔍 Insights Clave
- Mejor operación: +$500 (EURUSD, Long)
- Peor operación: -$200 (GBPUSD, Short)
- Promedio por trade: +$250
- Análisis: Excelente (60% win rate)

## ✅ Puntos de Acción
1. Mantener disciplina en entry/exit
2. Analizar pérdidas (GBPUSD)
3. Documentar setups ganadores
4. Revisar gestión de riesgo

---
*Reporte generado automáticamente por AlphaShield*
*Próximo reporte: ${new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]}*
`;

    return new Response(
      JSON.stringify({
        ok: true,
        message: "Report generated successfully",
        report: {
          weekStart,
          weekEnd,
          generatedAt: new Date().toISOString(),
          content: stubReport,
          metrics: {
            totalTrades: 5,
            closedTrades: 5,
            winRate: 0.6,
            totalPnL: 1250,
            avgPnL: 250,
          },
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[generate-scheduled-report] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
