import { NextRequest, NextResponse } from "next/server";
import { validateBearerToken } from "@/lib/security/timing";
import { createClient } from "@supabase/supabase-js";
import { getPgClient } from "@/lib/pg/client";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEARTBEAT_THRESHOLD_SEC = 120;
const ACK_THRESHOLD_SEC = 60;

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

function resolveProfile(name: string): "forex" | "futuros" | null {
  const n = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (n.includes("forex")) return "forex";
  if (n.includes("futuro")) return "futuros";
  return null;
}

function severityLabel(s: string): number {
  return s === "S1" ? 3 : s === "S2" ? 2 : s === "S3" ? 1 : 0;
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
    const generatedAt = new Date().toISOString();

    // bots is NOT one of the 16 in-scope tables and stays on Supabase.
    // bot_accounts / bot_instances / bot_command_status are in-scope (pg client).
    const [
      { data: bots, error: botsErr },
      { data: botAccounts, error: accountsErr },
      { data: instances, error: instancesErr },
      { data: pendingCmds, error: cmdsErr },
      { data: cryptoAlgos, error: cryptoAlgosErr },
    ] = await Promise.all([
      supabase.from("bots").select("id,name,user_id"),
      supabase.from("bot_accounts").select("id,bot_id"),
      supabase.from("bot_instances").select("id,bot_account_id,status,last_heartbeat_at"),
      supabase.from("bot_command_status").select("id,bot_account_id,status,created_at").eq("status", "PENDING"),
      // Crypto bots (coinarb) don't populate bot_instances and their bot name
      // ('coinarb-50x') doesn't match resolveProfile()'s forex/futuros keywords —
      // identify them via algorithms.market_type='crypto' instead.
      supabase.from("algorithms").select("id,linked_bot_account_id").eq("market_type", "crypto").is("deleted_at", null),
    ]);

    if (botsErr) throw botsErr;
    if (accountsErr) throw accountsErr;
    if (instancesErr) throw instancesErr;
    if (cmdsErr) throw cmdsErr;
    if (cryptoAlgosErr) throw cryptoAlgosErr;

    const cryptoAlgoByBotAccountId = new Map(
      (cryptoAlgos ?? [])
        .filter((a): a is { id: string; linked_bot_account_id: string } => Boolean(a.linked_bot_account_id))
        .map((a) => [a.linked_bot_account_id, a.id]),
    );

    const botAccounts = botAccountsRaw as unknown as { id: string; bot_id: string }[] | null;
    const instances = instancesRaw as unknown as { id: string; bot_account_id: string; status: string; last_heartbeat_at: string | null }[] | null;
    const pendingCmds = pendingCmdsRaw as unknown as { id: string; bot_account_id: string; status: string; created_at: string }[] | null;

    const results: {
      profile: "forex" | "futuros" | "crypto";
      botId: string;
      userId: string;
      overallStatus: string;
      severity: string;
      checks: { code: string; severity: string; detail: string }[];
      recommendations: string[];
    }[] = [];

    for (const bot of bots ?? []) {
      const accountIds = (botAccounts ?? []).filter((a) => a.bot_id === bot.id).map((a) => a.id);
      const cryptoAlgoId = accountIds.map((id) => cryptoAlgoByBotAccountId.get(id)).find(Boolean) ?? null;
      const profile = cryptoAlgoId ? "crypto" : resolveProfile(bot.name);
      if (!profile) continue;

      const botInstances = (instances ?? []).filter((i) => accountIds.includes(i.bot_account_id));
      const botPendingCmds = (pendingCmds ?? []).filter((c) => accountIds.includes(c.bot_account_id));

      const checks: { code: string; severity: string; detail: string }[] = [];

      if (profile === "crypto") {
        // Heartbeat lives in coinarb_telemetry (keyed by algorithm id), not bot_instances.
        const { data: tele } = await supabase
          .from("coinarb_telemetry")
          .select("last_heartbeat_at")
          .eq("agent_id", cryptoAlgoId as string)
          .order("last_heartbeat_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!tele?.last_heartbeat_at) {
          checks.push({ code: "NO_HEARTBEAT", severity: "S2", detail: `Agent ${cryptoAlgoId} never sent heartbeat` });
        } else {
          const ageSec = (nowMs - new Date(tele.last_heartbeat_at).getTime()) / 1000;
          if (ageSec > HEARTBEAT_THRESHOLD_SEC) {
            checks.push({ code: "STALE_HEARTBEAT", severity: ageSec > 300 ? "S1" : "S2", detail: `Heartbeat stale for ${Math.round(ageSec)}s` });
          }
        }
      } else {
        // Health: heartbeat (MT5 — bot_instances)
        for (const inst of botInstances) {
          if (!inst.last_heartbeat_at) {
            checks.push({ code: "NO_HEARTBEAT", severity: "S2", detail: `Instance ${inst.id} never sent heartbeat` });
          } else {
            const ageSec = (nowMs - new Date(inst.last_heartbeat_at).getTime()) / 1000;
            if (ageSec > HEARTBEAT_THRESHOLD_SEC) {
              checks.push({ code: "STALE_HEARTBEAT", severity: ageSec > 300 ? "S1" : "S2", detail: `Instance stale for ${Math.round(ageSec)}s` });
            }
          }
          if (inst.status !== "ACTIVE") {
            checks.push({ code: "NOT_ACTIVE", severity: "S3", detail: `Instance status is ${inst.status}` });
          }
        }
      }

      // SLO: pending commands (bot_command_status — applies to both MT5 and crypto)
      for (const cmd of botPendingCmds) {
        const ageSec = (nowMs - new Date(cmd.created_at).getTime()) / 1000;
        if (ageSec > ACK_THRESHOLD_SEC) {
          checks.push({ code: "COMMAND_UNACKED", severity: "S2", detail: `Command pending ${Math.round(ageSec)}s` });
        }
      }

      let severity = "NONE";
      for (const c of checks) {
        if (severityLabel(c.severity) > severityLabel(severity)) severity = c.severity;
      }
      const overallStatus = severity === "S1" ? "FAIL" : severity === "S2" ? "DEGRADED" : checks.length > 0 ? "DEGRADED" : "PASS";

      const recommendations: string[] = [];
      if (severity === "S1") recommendations.push("Intervención inmediata requerida");
      if (severity === "S2") recommendations.push("Revisar estado del bot en el panel");
      if (overallStatus === "PASS") recommendations.push("Sistema operando normalmente");

      results.push({ profile, botId: bot.id, userId: bot.user_id, overallStatus, severity, checks, recommendations });
    }

    // Persist to bot_events per bot
    const savedCount = { success: 0, failed: 0 };
    for (const res of results) {
      const { error: insertErr } = await pg.from("bot_events").insert({
        bot_id: res.botId,
        event_type: "DAILY_VERIFICATION",
        payload: {
          profile: res.profile,
          generatedAt,
          overallStatus: res.overallStatus,
          marketPolicy: "auto",
          severity: res.severity,
          recommendations: res.recommendations,
          health: { checks: res.checks },
          sloSummary: { checks: res.checks.length, severity: res.severity },
          source: "vercel-cron",
        },
      });
      if (insertErr) {
        logError("BotDailyVerify", { component: "ops.cron.bot-daily-verify.persist", message: `Failed to persist for bot ${res.botId}: ${insertErr.message}`, botId: res.botId });
        savedCount.failed++;
      } else {
        savedCount.success++;
      }
    }

    return NextResponse.json({ ok: true, generatedAt, results: results.length, saved: savedCount });
  } catch (error) {
    logError("BotDailyVerify", { component: "ops.cron.bot-daily-verify", message: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
