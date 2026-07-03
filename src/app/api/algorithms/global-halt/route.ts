// Kill-switch global — POST activa, DELETE reanuda, GET consulta estado.
//
// Fan-out de comandos 'pause'/'resume' a TODOS los bots con deployments
// activos del usuario, reusando bot_commands (el mismo canal que ya usa
// /api/algorithms/[id]/control) — no requiere tocar código del bot MT5 ni
// de coinarb. Mientras `halted=true`, /api/algorithms/[id]/signal y
// /api/algorithms/[id]/deploy rechazan nuevas entradas/despliegues.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";
import { logAuditFromRequest } from "@/lib/security/auditLog";
import { checkAiRateLimit } from "@/lib/security/aiRateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const haltSchema = z.object({
  reason: z.string().max(300).optional(),
});

interface DeploymentRow {
  bot_accounts: { bot_id: string | null } | { bot_id: string | null }[] | null;
}

/** Enumera los bot_id únicos con al menos un deployment activo del user. */
async function collectActiveBotIds(
  svc: ReturnType<typeof createServiceClient>,
  userId: string,
): Promise<string[]> {
  const { data, error } = await svc
    .from("algorithm_deployments")
    .select("bot_accounts(bot_id), algorithms!inner(user_id)")
    .eq("status", "active")
    .eq("algorithms.user_id", userId);

  if (error || !data) return [];

  const botIds = new Set<string>();
  for (const row of data as unknown as DeploymentRow[]) {
    const acc = Array.isArray(row.bot_accounts) ? row.bot_accounts[0] : row.bot_accounts;
    if (acc?.bot_id) botIds.add(acc.bot_id);
  }
  return Array.from(botIds);
}

async function dispatchToAllBots(
  svc: ReturnType<typeof createServiceClient>,
  userId: string,
  action: "pause" | "resume",
  reason: string | undefined,
): Promise<number> {
  const botIds = await collectActiveBotIds(svc, userId);
  if (botIds.length === 0) return 0;

  const rows = botIds.map((bot_id) => ({
    bot_id,
    command_type: action,
    payload: { source: "global-halt", reason: reason ?? null },
    target_scope: "all",
    created_by: userId,
    status: "pending",
  }));

  const { error } = await svc.from("bot_commands").insert(rows);
  if (error) {
    logError("Algorithms", { component: "global-halt dispatch", message: error.message });
    return 0;
  }
  return botIds.length;
}

// GET /api/algorithms/global-halt — estado actual
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data } = await supabase
      .from("global_trading_halt")
      .select("halted, halted_at, reason")
      .eq("user_id", user.id)
      .maybeSingle();

    return NextResponse.json({
      halted: data?.halted ?? false,
      halted_at: data?.halted_at ?? null,
      reason: data?.reason ?? null,
    });
  } catch (err) {
    logError("Algorithms", { component: "GET /api/algorithms/global-halt", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/algorithms/global-halt — activa el kill-switch
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Sin límite estricto — un kill-switch de emergencia no debe poder
    // quedar bloqueado por rate limit en el peor momento. Límite generoso
    // solo para frenar loops accidentales del cliente.
    const rl = await checkAiRateLimit(user.id, "algo-global-halt", 20);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSeconds ?? 60), "X-RateLimit-Limit": "20" },
      });
    }

    let body: unknown = {};
    try { body = await request.json(); } catch { /* empty body allowed */ }
    const parsed = haltSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

    const svc = createServiceClient();
    const { error: upsertErr } = await svc
      .from("global_trading_halt")
      .upsert({
        user_id: user.id,
        halted: true,
        halted_at: new Date().toISOString(),
        halted_by: user.id,
        reason: parsed.data.reason ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (upsertErr) {
      logError("Algorithms", { component: "POST global-halt", message: upsertErr.message });
      return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    }

    const dispatchedCount = await dispatchToAllBots(svc, user.id, "pause", parsed.data.reason);

    await logAuditFromRequest(
      {
        userId: user.id, action: "update", resourceType: "algorithm",
        resourceId: "global-halt", status: "success",
        changes: { global_halt: true, bots_paused: dispatchedCount, reason: parsed.data.reason ?? null },
      },
      request,
    );

    return NextResponse.json({
      ok: true,
      halted: true,
      bots_paused: dispatchedCount,
      message: `Kill-switch activado — ${dispatchedCount} bot(s) recibirán pause en ≤30s`,
    });
  } catch (err) {
    logError("Algorithms", { component: "POST /api/algorithms/global-halt", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/algorithms/global-halt — desactiva el kill-switch
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const svc = createServiceClient();
    const { error: updErr } = await svc
      .from("global_trading_halt")
      .update({
        halted: false,
        resumed_at: new Date().toISOString(),
        resumed_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (updErr) {
      logError("Algorithms", { component: "DELETE global-halt", message: updErr.message });
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    // Resume NO es automático — cada bot vuelve a operar recién cuando el
    // usuario lo reanude explícitamente por-algoritmo (/control resume).
    // El fan-out global solo pausó; reanudar todo de golpe sin revisión
    // sería tan riesgoso como el incidente que motivó el halt.
    await logAuditFromRequest(
      {
        userId: user.id, action: "update", resourceType: "algorithm",
        resourceId: "global-halt", status: "success",
        changes: { global_halt: false },
      },
      request,
    );

    return NextResponse.json({
      ok: true,
      halted: false,
      message: "Kill-switch desactivado. Los bots pausados NO se reanudan automáticamente — usá /control por algoritmo.",
    });
  } catch (err) {
    logError("Algorithms", { component: "DELETE /api/algorithms/global-halt", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
