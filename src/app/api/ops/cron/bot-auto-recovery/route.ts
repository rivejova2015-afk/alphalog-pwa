import { NextRequest, NextResponse } from "next/server";
import { validateBearerToken } from "@/lib/security/timing";
import { createClient } from "@supabase/supabase-js";
import { getPgClient } from "@/lib/pg/client";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEARTBEAT_THRESHOLD_SEC = 120;
const COOLDOWN_MIN = 30;

function validateCronSecret(request: NextRequest) {
  return validateBearerToken(
    request.headers.get("authorization"),
    process.env.CRON_SECRET,
    "CRON_SECRET",
  );
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase service role credentials");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// Intentionally MT5-only (forex/futuros). Crypto (coinarb-50x) bots never
// match here \u2014 and that's deliberate, not an oversight (Wave 3 item 7):
// the remediation this endpoint performs is `bot_commands` with
// command_type='RESTART_LOGIC', which only the MT5 EA polls for. Coinarb's
// command-poller only handles pause/resume/update_parameters \u2014 there is no
// wired mechanism to remote-restart a Fly-hosted bot process today (that
// would require a Fly Machines API integration, out of scope here). Faking
// a RESTART_LOGIC dispatch for coinarb would silently no-op and give false
// confidence that recovery was attempted. Crypto staleness detection today
// is alert-only, via /api/ops/cron/coinarb-heartbeat (push notification,
// no auto-remediation) \u2014 see also bot-daily-verify, which DOES audit crypto
// heartbeat (read-only, no restart action needed for that).
function resolveProfile(name: string): "forex" | "futuros" | null {
  const n = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (n.includes("forex")) return "forex";
  if (n.includes("futuro")) return "futuros";
  return null;
}

export async function POST(request: NextRequest) {
  const auth = validateCronSecret(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status as number });
  }

  try {
    const supabase = getServiceClient();
    const pg = getPgClient();
    const nowMs = Date.now();
    const nowIso = new Date().toISOString();

    // bots is NOT one of the 16 in-scope tables and stays on Supabase.
    // bot_accounts / bot_instances are in-scope (pg client).
    const [
      { data: bots, error: botsErr },
      { data: botAccountsRaw, error: accountsErr },
      { data: instancesRaw, error: instancesErr },
    ] = await Promise.all([
      supabase.from("bots").select("id,name"),
      pg.from("bot_accounts").select("id,bot_id"),
      pg.from("bot_instances").select("id,bot_account_id,status,last_heartbeat_at"),
    ]);

    if (botsErr) throw botsErr;
    if (accountsErr) throw accountsErr;
    if (instancesErr) throw instancesErr;

    const botAccounts = botAccountsRaw as unknown as { id: string; bot_id: string }[] | null;
    const instances = instancesRaw as unknown as { id: string; bot_account_id: string; status: string; last_heartbeat_at: string | null }[] | null;

    const report = { actions: [] as unknown[], skipped: [] as unknown[], errors: [] as string[] };

    for (const bot of bots ?? []) {
      const profile = resolveProfile(bot.name);
      if (!profile) continue;

      // Check if any instance for this bot is stale
      const botAccountIds = (botAccounts ?? [])
        .filter((a) => a.bot_id === bot.id)
        .map((a) => a.id);
      if (botAccountIds.length === 0) {
        report.skipped.push({ bot_id: bot.id, reason: "no_bot_accounts" });
        continue;
      }

      const staleInstances = (instances ?? []).filter((inst) => {
        if (!botAccountIds.includes(inst.bot_account_id)) return false;
        if (!inst.last_heartbeat_at) return true;
        return (nowMs - new Date(inst.last_heartbeat_at).getTime()) / 1000 > HEARTBEAT_THRESHOLD_SEC * 2.5;
      });

      if (staleInstances.length === 0) {
        report.skipped.push({ bot_id: bot.id, reason: "healthy" });
        continue;
      }

      // Cooldown check. bot_commands is in-scope (pg client), which has no
      // `.gte()`/`.limit()` — fetch matches for this bot+type and filter/check
      // the age cutoff in JS instead (behaviorally equivalent).
      const cooldownIso = new Date(nowMs - COOLDOWN_MIN * 60 * 1000).toISOString();
      const { data: recentCmdsRaw } = await pg
        .from("bot_commands")
        .select("id,created_at")
        .eq("bot_id", bot.id)
        .eq("command_type", "RESTART_LOGIC");
      const recentCmds = ((recentCmdsRaw as unknown as { id: string; created_at: string }[] | null) ?? [])
        .filter((c) => c.created_at >= cooldownIso);

      if (recentCmds.length > 0) {
        report.skipped.push({ bot_id: bot.id, reason: "cooldown_active", profile });
        continue;
      }

      // Issue RESTART_LOGIC command
      const { data: cmdRaw, error: cmdErr } = await pg
        .from("bot_commands")
        .insert({
          bot_id: bot.id,
          command_type: "RESTART_LOGIC",
          payload: { source: "vercel-cron-auto-recovery", profile, generated_at: nowIso },
          target_scope: "all",
          status: "PENDING",
        })
        .select("id")
        .single();
      const cmd = cmdRaw as { id: string } | null;

      if (cmdErr || !cmd) {
        report.errors.push(`Failed to insert command for bot ${bot.id}: ${cmdErr?.message ?? "no row returned"}`);
        continue;
      }

      // Insert status rows per account
      const statusRows = botAccountIds.map((accountId) => ({
        command_id: cmd.id,
        bot_account_id: accountId,
        status: "PENDING",
      }));
      await pg.from("bot_command_status").insert(statusRows);

      // Record event
      await pg.from("bot_events").insert({
        bot_id: bot.id,
        event_type: "AUTO_RECOVERY_TRIGGERED",
        payload: { source: "vercel-cron-auto-recovery", profile, command_id: cmd.id, generated_at: nowIso },
      });

      report.actions.push({ bot_id: bot.id, profile, command_id: cmd.id, command_type: "RESTART_LOGIC" });
    }

    return NextResponse.json({ ok: true, report });
  } catch (error) {
    logError("BotAutoRecovery", { component: "ops.cron.bot-auto-recovery", message: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
