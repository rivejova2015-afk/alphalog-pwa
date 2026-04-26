import { NextRequest, NextResponse } from "next/server";
import { validateBearerToken } from "@/lib/security/timing";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STALE_THRESHOLD_SEC = 120;

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function sendPush(userId: string, title: string, body: string, tag: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://alphalog.io";
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return;
  await fetch(`${appUrl}/api/push/notify-user`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
    body: JSON.stringify({ userId, title, body, tag }),
  }).catch(() => undefined);
}

async function sendRecoveryCommand(supabase: ReturnType<typeof getServiceClient>, botId: string) {
  const { data } = await supabase.from("bot_commands").insert({
    bot_id: botId,
    command_type: "RESTART_LOGIC",
    target_scope: "all",
    created_by: "heartbeat-monitor",
    status: "PENDING",
    payload: { reason: "auto_recovery", triggered_by: "bot-heartbeat-monitor" },
  }).select("id").single();
  return data?.id ?? null;
}

export async function POST(request: NextRequest) {
  const auth = validateBearerToken(
    request.headers.get("authorization"),
    process.env.CRON_SECRET,
    "CRON_SECRET",
  );
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status as number });
  }

  const supabase = getServiceClient();
  const now = Date.now();

  // Load all instances + their bot info + current monitor state
  const [{ data: instances }, { data: states }, { data: accounts }] = await Promise.all([
    supabase.from("bot_instances").select("id, bot_account_id, last_heartbeat_at, status"),
    supabase.from("bot_monitor_state").select("*"),
    supabase.from("bot_accounts").select("id, bot_id, user_id"),
  ]);

  const stateMap = Object.fromEntries((states ?? []).map((s) => [s.bot_instance_id, s]));
  const accountMap = Object.fromEntries((accounts ?? []).map((a) => [a.id, a]));

  const results: { instanceId: string; action: string }[] = [];

  for (const inst of instances ?? []) {
    const account = accountMap[inst.bot_account_id];
    if (!account) continue;

    const ageSec = inst.last_heartbeat_at
      ? (now - new Date(inst.last_heartbeat_at).getTime()) / 1000
      : Infinity;

    const isStale = ageSec > STALE_THRESHOLD_SEC;
    const state = stateMap[inst.id];
    const wasDown = state?.is_down ?? false;

    // Transition: UP → DOWN
    if (isStale && !wasDown) {
      const cmdId = await sendRecoveryCommand(supabase, account.bot_id);
      await supabase.from("bot_monitor_state").upsert({
        bot_instance_id: inst.id,
        is_down: true,
        down_since: new Date().toISOString(),
        last_alerted_at: new Date().toISOString(),
        recovery_cmd_id: cmdId,
        updated_at: new Date().toISOString(),
      }, { onConflict: "bot_instance_id" });

      await sendPush(
        account.user_id,
        "⚠️ Bot caído",
        `GoldRangeBasketR sin heartbeat por más de ${Math.round(ageSec)}s. Auto-recovery iniciado.`,
        `bot-down-${inst.id}`,
      );
      results.push({ instanceId: inst.id, action: "alerted_down" });
    }

    // Transition: DOWN → UP (recovered)
    else if (!isStale && wasDown) {
      await supabase.from("bot_monitor_state").upsert({
        bot_instance_id: inst.id,
        is_down: false,
        down_since: null,
        last_alerted_at: new Date().toISOString(),
        recovery_cmd_id: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "bot_instance_id" });

      await sendPush(
        account.user_id,
        "✅ Bot recuperado",
        `GoldRangeBasketR volvió a enviar heartbeats. Sistema operando normalmente.`,
        `bot-up-${inst.id}`,
      );
      results.push({ instanceId: inst.id, action: "alerted_recovered" });
    }

    // No transition — keep existing state
    else {
      results.push({ instanceId: inst.id, action: isStale ? "still_down" : "healthy" });
    }
  }

  return NextResponse.json({ ok: true, checked: instances?.length ?? 0, results });
}
