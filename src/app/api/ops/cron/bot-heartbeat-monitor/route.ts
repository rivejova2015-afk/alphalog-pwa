import { NextRequest, NextResponse } from "next/server";
import { validateBearerToken } from "@/lib/security/timing";
import { createClient } from "@supabase/supabase-js";
import { getPgClient } from "@/lib/pg/client";

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

async function sendRecoveryCommand(botId: string) {
  // bot_commands is one of the 16 in-scope tables — uses the pg client, unlike
  // bot_monitor_state elsewhere in this file which stays on Supabase.
  const pg = getPgClient();
  const { data } = await pg.from("bot_commands").insert({
    bot_id: botId,
    command_type: "RESTART_LOGIC",
    target_scope: "all",
    created_by: "heartbeat-monitor",
    status: "PENDING",
    payload: { reason: "auto_recovery", triggered_by: "bot-heartbeat-monitor" },
  }).select("id").single();
  const row = data as { id: string } | null;
  return row?.id ?? null;
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
  const pg = getPgClient();
  const now = Date.now();

  // Load all instances + their bot info + current monitor state.
  // bot_instances/bot_accounts are in-scope (pg); bot_monitor_state is not
  // one of the 16 migrated tables and stays on Supabase.
  const [{ data: instancesRaw }, { data: states }, { data: accountsRaw }] = await Promise.all([
    pg.from("bot_instances").select("id, bot_account_id, last_heartbeat_at, status"),
    supabase.from("bot_monitor_state").select("*"),
    pg.from("bot_accounts").select("id, bot_id, user_id"),
  ]);
  const instances = instancesRaw as unknown as { id: string; bot_account_id: string; last_heartbeat_at: string | null; status: string }[] | null;
  const accounts = accountsRaw as unknown as { id: string; bot_id: string; user_id: string }[] | null;

  const stateMap = Object.fromEntries((states ?? []).map((s) => [s.bot_instance_id, s]));
  const accountMap = Object.fromEntries((accounts ?? []).map((a) => [a.id, a]));

  const results: { instanceId: string; action: string }[] = [];

  const RE_ALERT_MS = 10 * 60 * 1000; // re-alert every 10 min while still down

  for (const inst of instances ?? []) {
    const account = accountMap[inst.bot_account_id];
    if (!account?.user_id) continue; // skip if no user_id to push to

    const ageSec = inst.last_heartbeat_at
      ? (now - new Date(inst.last_heartbeat_at).getTime()) / 1000
      : Infinity;

    const isStale = ageSec > STALE_THRESHOLD_SEC;
    const state = stateMap[inst.id];
    const wasDown = state?.is_down ?? false;
    const nowIso = new Date().toISOString();

    // Transition: UP → DOWN
    if (isStale && !wasDown) {
      const cmdId = await sendRecoveryCommand(account.bot_id);
      await supabase.from("bot_monitor_state").upsert({
        bot_instance_id: inst.id,
        is_down: true,
        down_since: nowIso,
        last_alerted_at: nowIso,
        recovery_cmd_id: cmdId,
        updated_at: nowIso,
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
        last_alerted_at: nowIso,
        recovery_cmd_id: null,
        updated_at: nowIso,
      }, { onConflict: "bot_instance_id" });

      await sendPush(
        account.user_id,
        "✅ Bot recuperado",
        `GoldRangeBasketR volvió a enviar heartbeats. Sistema operando normalmente.`,
        `bot-up-${inst.id}`,
      );
      results.push({ instanceId: inst.id, action: "alerted_recovered" });
    }

    // Still down — re-alert every 10 min
    else if (isStale && wasDown) {
      const lastAlertMs = state?.last_alerted_at ? new Date(state.last_alerted_at).getTime() : 0;
      if (now - lastAlertMs > RE_ALERT_MS) {
        await supabase.from("bot_monitor_state")
          .update({ last_alerted_at: nowIso, updated_at: nowIso })
          .eq("bot_instance_id", inst.id);
        await sendPush(
          account.user_id,
          "⚠️ Bot sigue caído",
          `GoldRangeBasketR sin heartbeat por ${Math.round(ageSec / 60)}min. Verificar MT5.`,
          `bot-still-down-${inst.id}`,
        );
        results.push({ instanceId: inst.id, action: "re_alerted_still_down" });
      } else {
        results.push({ instanceId: inst.id, action: "still_down" });
      }
    }

    else {
      results.push({ instanceId: inst.id, action: "healthy" });
    }
  }

  return NextResponse.json({ ok: true, checked: instances?.length ?? 0, results });
}
