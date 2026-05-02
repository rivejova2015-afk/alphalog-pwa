import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { safeCompareTokens } from "@/lib/security/timing";
import { logAuditFromRequest } from "@/lib/security/auditLog";
import { logError, logInfo } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tradeSchema = z.object({
  algorithmId: z.string().uuid(),
  userId:      z.string().uuid(),
  symbol:      z.string().min(1).max(20),
  direction:   z.enum(["BUY", "SELL"]),
  lots:        z.number().positive().optional(),
  entryPrice:  z.number().positive().optional(),
  exitPrice:   z.number().positive().optional(),
  pnl:         z.number().optional(),
  closeReason: z.string().optional(),
  timestamp:   z.string().datetime().optional(),
});

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-mt5-secret") ?? "";
  if (!process.env.MT5_WEBHOOK_SECRET || !safeCompareTokens(secret, process.env.MT5_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = tradeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

  const d = parsed.data;
  const svc = createServiceClient();

  // Verify algorithm exists and belongs to userId
  const { data: algo } = await svc
    .from("trading_algorithms")
    .select("id, status")
    .eq("id", d.algorithmId)
    .eq("user_id", d.userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!algo) return NextResponse.json({ error: "Algorithm not found" }, { status: 404 });

  // Only route to paper trades if algo is in paper mode
  if (algo.status === "paper") {
    const { error } = await svc.from("algo_paper_trades").insert({
      user_id:     d.userId,
      algorithm_id: d.algorithmId,
      symbol:      d.symbol,
      direction:   d.direction,
      quantity:    d.lots ?? 1,
      entry_price: d.entryPrice,
      exit_price:  d.exitPrice,
      pnl:         d.pnl,
      status:      d.exitPrice != null ? "closed" : "open",
      source:      "webhook",
      opened_at:   d.timestamp ?? new Date().toISOString(),
      closed_at:   d.exitPrice != null ? (d.timestamp ?? new Date().toISOString()) : null,
    });

    if (error) {
      logError("AlgoTradeWebhook", { component: "POST /api/webhooks/algo-trade", message: error.message });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    logInfo("AlgoTradeWebhook", `Paper trade recorded for algo ${d.algorithmId}`, {
      component: "webhook", meta: { algorithmId: d.algorithmId, symbol: d.symbol, pnl: d.pnl },
    });
  }

  await logAuditFromRequest(
    {
      userId: d.userId,
      action: "api_call",
      resourceType: "trade",
      resourceId: d.algorithmId,
      status: "success",
      changes: { symbol: d.symbol, direction: d.direction, pnl: d.pnl, algoStatus: algo.status },
    },
    req
  );

  return NextResponse.json({ ok: true, routed: algo.status === "paper" ? "paper_trade" : "ignored" });
}
