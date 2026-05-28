// src/app/api/tradehub/reports/generate/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { decryptText, encryptText } from "@/lib/security/encryption";
import { checkAiRateLimit } from "@/lib/security/aiRateLimit";
import { logError } from "@/lib/log";

const safeDecrypt = (value?: string | null) => {
  try {
    return decryptText(value);
  } catch (err) {
    console.warn("[TradeHub] Failed to decrypt report content:", err);
    return value ?? null;
  }
};

/**
 * POST /api/tradehub/reports/generate
 * Generate weekly AlphaBrief report or return existing
 *
 * Calculates metrics from closed trades (exit_date NOT NULL) in last 7 days
 * Generates markdown summary with account breakdown
 * Returns existing report if already generated for this week
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = userData.user.id;

    // Calculate week range (UTC)
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setUTCDate(today.getUTCDate() - 7);
    weekStart.setUTCHours(0, 0, 0, 0);

    const weekEnd = new Date(today);
    weekEnd.setUTCHours(23, 59, 59, 999);

    // Convert to date strings (YYYY-MM-DD)
    const weekStartStr = weekStart.toISOString().split("T")[0];
    const weekEndStr = weekEnd.toISOString().split("T")[0];

    // Check if report already exists for this week
    const { data: existingReport } = await supabase
      .from("weekly_reports")
      .select("*")
      .eq("user_id", userId)
      .eq("week_start", weekStartStr)
      .eq("week_end", weekEndStr)
      .is("deleted_at", null)
      .maybeSingle();

    if (existingReport) {
      return NextResponse.json({
        existing: true,
        report: {
          ...existingReport,
          content_md: safeDecrypt(existingReport.content_md),
        },
      });
    }

    // Check AI rate limit (3 requests per hour) — only for new report generation
    const { allowed, retryAfterSeconds } = await checkAiRateLimit(userId, "ai-tradehub");
    if (!allowed) {
      return NextResponse.json(
        { error: "AI rate limit exceeded. Max 3 requests per hour." },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfterSeconds ?? 3600) },
        }
      );
    }

    // Fetch closed trades for the week
    const { data: trades, error: tradesError } = await supabase
      .from("trades")
      .select(
        `
        id,
        account_id,
        symbol,
        direction,
        entry_price,
        exit_price,
        quantity,
        pnl,
        exit_date,
        accounts:account_id (
          id,
          name
        )
      `
      )
      .eq("user_id", userId)
      .not("exit_date", "is", null) // Only closed trades
      .gte("exit_date", weekStartStr) // Within week range
      .lte("exit_date", weekEndStr)
      .order("exit_date", { ascending: false });

    if (tradesError) {
      logError("TradehubReportsGenerate", { component: "tradehub.reports.generate", message: "Error fetching trades:", error: tradesError instanceof Error ? tradesError.message : String(tradesError) });
      return NextResponse.json(
        { error: "Failed to fetch trades" },
        { status: 500 }
      );
    }

    // Calculate metrics
    const totalTrades = trades?.length || 0;
    const winningTrades = trades?.filter((t: any) => t.pnl > 0).length || 0;
    const totalPnL = trades?.reduce((sum: number, t: any) => sum + (t.pnl || 0), 0) || 0;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    // Account breakdown
    const accountBreakdown: {
      [key: string]: {
        name: string;
        trades: number;
        pnl: number;
        winRate: number;
      };
    } = {};

    trades?.forEach((trade: any) => {
      const accountId = trade.account_id;
      const accountName = trade.accounts?.name || "Sin nombre";

      if (!accountBreakdown[accountId]) {
        accountBreakdown[accountId] = {
          name: accountName,
          trades: 0,
          pnl: 0,
          winRate: 0,
        };
      }

      accountBreakdown[accountId].trades += 1;
      accountBreakdown[accountId].pnl += trade.pnl || 0;

      if (trade.pnl > 0) {
        accountBreakdown[accountId].winRate += 1;
      }
    });

    // Calculate win rate per account
    Object.keys(accountBreakdown).forEach((accountId) => {
      const account = accountBreakdown[accountId];
      account.winRate = account.trades > 0 ? (account.winRate / account.trades) * 100 : 0;
    });

    // Generate markdown content
    const markdownContent = generateAlphaBriefMarkdown(
      weekStartStr,
      weekEndStr,
      totalTrades,
      totalPnL,
      winRate,
      accountBreakdown,
      trades || []
    );

    const reportTitle = `AlphaBrief - Semana ${weekStartStr} a ${weekEndStr}`;

    // Insert report
    let encryptedContent: string | null = null;
    try {
      encryptedContent = encryptText(markdownContent);
    } catch (err) {
      logError("TradehubReportsGenerate", { component: "tradehub.reports.generate", message: "Error encrypting AlphaBrief report:", error: err instanceof Error ? err.message : String(err) });
      return NextResponse.json(
        { error: "Configuración de seguridad pendiente" },
        { status: 500 }
      );
    }

    const { data: newReport, error: insertError } = await supabase
      .from("weekly_reports")
      .insert({
        user_id: userId,
        week_start: weekStartStr,
        week_end: weekEndStr,
        title: reportTitle,
        content_md: encryptedContent,
        total_trades: totalTrades,
        total_pnl: totalPnL,
        win_rate: parseFloat(winRate.toFixed(2)),
      })
      .select()
      .single();

    if (insertError) {
      logError("TradehubReportsGenerate", { component: "tradehub.reports.generate", message: "Error creating report:", error: insertError instanceof Error ? insertError.message : String(insertError) });
      return NextResponse.json(
        { error: "Failed to create report" },
        { status: 500 }
      );
    }

    // Send push notification to user
    // Fire-and-forget: don't wait for push to complete
    const pushPayload = {
      userId,
      title: '📊 AlphaBrief Generado',
      body: `Reporte semanal: ${totalTrades} operaciones, P&L $${totalPnL.toFixed(2)}`,
      tag: 'alphalog-report',
      data: {
        type: 'report',
        report_id: newReport?.id || '',
      },
    };

    fetch(`${request.headers.get('origin')}/api/push/notify-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.INTERNAL_API_SECRET || ''}`,
      },
      body: JSON.stringify(pushPayload),
    }).catch((error) => {
      console.warn('Failed to send push notification:', error);
      // Don't fail the request if push fails
    });

    return NextResponse.json({
      existing: false,
      report: {
        ...newReport,
        content_md: safeDecrypt(newReport.content_md),
      },
    });
  } catch (err: unknown) {
    logError("TradehubReportsGenerate", { component: "tradehub.reports.generate", message: "Error in POST /api/tradehub/reports/generate:", error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Generate AlphaBrief markdown content
 */
function generateAlphaBriefMarkdown(
  weekStart: string,
  weekEnd: string,
  totalTrades: number,
  totalPnL: number,
  winRate: number,
  accountBreakdown: {
    [key: string]: { name: string; trades: number; pnl: number; winRate: number };
  },
  trades: any[]
): string {
  const pnlStatus = totalPnL >= 0 ? "✅ POSITIVO" : "⚠️ NEGATIVO";
  const pnlColor = totalPnL >= 0 ? "📈" : "📉";

  let md = `# AlphaBrief - Semana ${weekStart} a ${weekEnd}\n\n`;

  // Executive Summary
  md += `## 📋 Resumen Ejecutivo\n\n`;
  md += `- **Período**: ${weekStart} hasta ${weekEnd}\n`;
  md += `- **Operaciones**: ${totalTrades} cerradas\n`;
  md += `- **Resultado**: ${pnlColor} $${totalPnL.toFixed(2)} ${pnlStatus}\n`;
  md += `- **Tasa de Aciertos**: ${winRate.toFixed(1)}%\n\n`;

  // Performance Overview
  md += `## 📊 Performance General\n\n`;
  md += `| Métrica | Valor |\n`;
  md += `|---------|-------|\n`;
  md += `| Total Operaciones | ${totalTrades} |\n`;
  md += `| P&L Total | $${totalPnL.toFixed(2)} |\n`;
  md += `| Win Rate | ${winRate.toFixed(1)}% |\n`;
  md += `| P&L Promedio | $${totalTrades > 0 ? (totalPnL / totalTrades).toFixed(2) : "0.00"} |\n\n`;

  // Account Breakdown
  md += `## 💼 Desglose por Cuenta\n\n`;

  Object.entries(accountBreakdown).forEach(([accountId, stats]) => {
    const accPnLStatus = stats.pnl >= 0 ? "✅" : "⚠️";
    md += `### ${stats.name}\n`;
    md += `- **Operaciones**: ${stats.trades}\n`;
    md += `- **P&L**: ${accPnLStatus} $${stats.pnl.toFixed(2)}\n`;
    md += `- **Win Rate**: ${stats.winRate.toFixed(1)}%\n`;
    md += `- **P&L Promedio**: $${stats.trades > 0 ? (stats.pnl / stats.trades).toFixed(2) : "0.00"}\n\n`;
  });

  // Key Insights
  md += `## 🔍 Insights Clave\n\n`;

  // Find best and worst trades
  const sortedByPnL = [...trades].sort((a, b) => (b.pnl || 0) - (a.pnl || 0));
  const bestTrade = sortedByPnL[0];
  const worstTrade = sortedByPnL[sortedByPnL.length - 1];

  if (bestTrade) {
    md += `- **Mejor Operación**: ${bestTrade.symbol} (${bestTrade.direction}) → $${bestTrade.pnl.toFixed(2)}\n`;
  }

  if (worstTrade && worstTrade.pnl < 0) {
    md += `- **Peor Operación**: ${worstTrade.symbol} (${worstTrade.direction}) → $${worstTrade.pnl.toFixed(2)}\n`;
  }

  if (totalTrades > 0) {
    const avgTrade = totalPnL / totalTrades;
    md += `- **Operación Promedio**: $${avgTrade.toFixed(2)}\n`;
  }

  // Performance assessment
  if (winRate >= 60) {
    md += `- **Análisis**: Excelente tasa de aciertos 💪\n`;
  } else if (winRate >= 50) {
    md += `- **Análisis**: Tasa de aciertos positiva 👍\n`;
  } else {
    md += `- **Análisis**: Mejorar selectividad de operaciones 📌\n`;
  }

  md += `\n`;

  // Action Items
  md += `## ✅ Puntos de Acción\n\n`;
  md += `1. Revisar operaciones perdidas para identificar patrones comunes\n`;
  md += `2. Analizar cuentas con menor performance\n`;
  md += `3. Mantener disciplina en tamaño de posición y gestión de riesgo\n`;
  md += `4. Documentar lecciones aprendidas en el Evidence Vault\n\n`;

  // Footer
  md += `---\n`;
  md += `*Generado automáticamente por AlphaLog | ${new Date().toLocaleString("es-ES", { timeZone: "UTC" })} UTC*`;

  return md;
}
