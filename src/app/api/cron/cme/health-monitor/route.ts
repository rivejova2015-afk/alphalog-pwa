// CME health monitor — cron diario que detecta:
//  1. cme_connections.status='error' que llevan >1h sin resolverse → push.
//  2. cme_trades_propfirm con status='pending' o 'filled' sin fill_timestamp
//     en las últimas 6h → posible discrepancia con Tradovate (orden colocada
//     pero sin confirmación de fill).
//  3. Conexiones connected donde el token expira en <30min sin renew
//     reciente (heartbeat-cron debería refrescarlo, este es safety net).
//
// Dedup vía app_logs.fingerprint para no spamear.

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { logError, logInfo } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorize(req: NextRequest): boolean {
  const sent = req.headers.get("x-cron-secret");
  const expected = process.env.CRON_SECRET;
  if (!sent || !expected) return false;
  try {
    const a = Buffer.from(sent);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

interface HealthResult {
  errorConnections: number;
  pendingTradesStale: number;
  tokensExpiringSoon: number;
  alertsSent: number;
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const svc = createServiceClient();
  const result: HealthResult = {
    errorConnections: 0,
    pendingTradesStale: 0,
    tokensExpiringSoon: 0,
    alertsSent: 0,
  };

  // 1. Connections en error > 1h sin resolverse.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: errConns } = await svc
    .from("cme_connections")
    .select("id, user_id, cme_account_id, last_error, error_at")
    .eq("status", "error")
    .lt("error_at", oneHourAgo);

  for (const conn of (errConns ?? []) as { id: string; user_id: string; cme_account_id: string; last_error: string | null; error_at: string }[]) {
    result.errorConnections++;
    await emitAlert(svc, {
      userId: conn.user_id,
      fingerprint: `cme_connection_error:${conn.id}`,
      area: "CmeConnectionError",
      title: "Tradovate connection error",
      body: `Connection ${conn.id} error: ${conn.last_error ?? "unknown"} (since ${conn.error_at})`,
      meta: { connection_id: conn.id, cme_account_id: conn.cme_account_id, last_error: conn.last_error },
    });
    result.alertsSent++;
  }

  // 2. Trades 'pending' o 'filled' sin fill_timestamp en >6h.
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const { data: staleTrades } = await svc
    .from("cme_trades_propfirm")
    .select("id, user_id, contract, status, broker_order_id, created_at")
    .in("status", ["pending", "filled"])
    .is("fill_timestamp", null)
    .lt("created_at", sixHoursAgo);

  for (const t of (staleTrades ?? []) as { id: string; user_id: string; contract: string; status: string; broker_order_id: string | null; created_at: string }[]) {
    result.pendingTradesStale++;
    await emitAlert(svc, {
      userId: t.user_id,
      fingerprint: `cme_trade_stale:${t.id}`,
      area: "CmeTradeStale",
      title: "Tradovate trade reconciliation",
      body: `Trade ${t.id} (${t.contract}) status=${t.status} sin fill_timestamp en >6h. broker_order_id=${t.broker_order_id ?? "null"}`,
      meta: { trade_id: t.id, contract: t.contract, broker_order_id: t.broker_order_id, status: t.status },
    });
    result.alertsSent++;
  }

  // 3. Tokens que expiran en <30min (heartbeat debería renovarlo).
  const thirtyMinFromNow = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const { data: tokensExpiring } = await svc
    .from("cme_connections")
    .select("id, user_id, token_expires_at")
    .eq("status", "connected")
    .lt("token_expires_at", thirtyMinFromNow);

  for (const c of (tokensExpiring ?? []) as { id: string; user_id: string; token_expires_at: string }[]) {
    result.tokensExpiringSoon++;
    // Solo warn — no push. El heartbeat cron debería renovarlo.
    await svc.from("app_logs").insert({
      user_id: c.user_id,
      level: "warn",
      area: "CmeTokenExpiring",
      message: `Token de cme_connection ${c.id} expira en <30min — heartbeat debería renovarlo`,
      meta: { connection_id: c.id, expires_at: c.token_expires_at },
      fingerprint: `cme_token_expiring:${c.id}:${c.token_expires_at}`,
    });
  }

  logInfo("CmeHealthMonitor", `errors=${result.errorConnections} stale=${result.pendingTradesStale} expiring=${result.tokensExpiringSoon} alerts=${result.alertsSent}`, { component: "cron" });

  return NextResponse.json({ ok: true, ...result });
}

interface EmitAlertParams {
  userId: string;
  fingerprint: string;
  area: string;
  title: string;
  body: string;
  meta: Record<string, unknown>;
}

async function emitAlert(svc: ReturnType<typeof createServiceClient>, p: EmitAlertParams) {
  // Dedup vía app_logs.fingerprint — solo emite si no hay log no-resolved con esa fingerprint.
  const { data: existing } = await svc
    .from("app_logs")
    .select("id")
    .eq("fingerprint", p.fingerprint)
    .is("resolved_at", null)
    .limit(1)
    .maybeSingle();
  if (existing) return;

  await svc.from("app_logs").insert({
    user_id: p.userId,
    level: "error",
    area: p.area,
    message: p.body,
    meta: p.meta,
    fingerprint: p.fingerprint,
  });

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://alphalog.io";
    await fetch(`${appUrl}/api/push/notify-user`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.INTERNAL_API_SECRET}`, "Content-Type": "application/json" },
      body: JSON.stringify({ userId: p.userId, title: p.title, body: p.body, tag: p.fingerprint }),
    });
  } catch (err) {
    logError("CmeHealthMonitor", { component: "push", message: err instanceof Error ? err.message : String(err) });
  }
}

// Vercel Cron puede invocar GET o POST.
export const GET = POST;
