#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

function loadEnvFile(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const [key, inline] = token.slice(2).split("=");
    if (inline !== undefined) {
      out[key] = inline;
      continue;
    }
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      out[key] = "true";
      continue;
    }
    out[key] = next;
    i += 1;
  }
  return out;
}

function isoNow() {
  return new Date().toISOString();
}

function boolArg(value, fallback = false) {
  if (value === undefined) return fallback;
  return String(value).toLowerCase() === "true";
}

async function safeDelete(supabase, table, filter) {
  let q = supabase.from(table).delete();
  for (const [k, v] of Object.entries(filter)) {
    q = q.eq(k, v);
  }
  const { error } = await q;
  if (error) throw new Error(`${table} delete failed: ${error.message}`);
}

async function countRows(supabase, table, filter) {
  let q = supabase.from(table).select("id", { count: "exact", head: true });
  for (const [k, v] of Object.entries(filter)) {
    q = q.eq(k, v);
  }
  const { count, error } = await q;
  if (error) throw new Error(`${table} count failed: ${error.message}`);
  return count || 0;
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function requiredChecksPassed(report) {
  const checks = report.checks;
  return (
    checks.settingsEffective?.ok &&
    checks.commands?.ok &&
    checks.ack?.ok &&
    checks.telemetry?.ok &&
    checks.negativeMissingHeaders?.okExpected401 &&
    checks.negativeBadSecret?.okExpected401 &&
    checks.webhookMissingSignature?.okExpected401
  );
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const env = { ...process.env, ...loadEnvFile(path.join(process.cwd(), ".env.local")) };
  const baseUrl = args.baseUrl || "https://www.alphalog.io";
  const output =
    args.output ||
    path.join(process.cwd(), "docs", "reports", `bot-control-plane-smoke-${Date.now()}.json`);
  const webhookSecret = env.MT5_WEBHOOK_SECRET;
  const skipSignedWebhook = boolArg(args.skipSignedWebhook, false);

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const fnBase = new URL(supabaseUrl).origin.replace(".supabase.co", ".functions.supabase.co");
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const tag = `QA_BOT_${Date.now()}`;
  const symbol = `TESTSIG_${String(Date.now()).slice(-6)}`;
  const ids = {
    user_id: null,
    category_id: null,
    app_account_id: null,
    bot_id: null,
    bot_account_id: null,
    bot_instance_id: null,
    command_id: null,
    instance_id: `inst_${tag}`,
    instance_secret: crypto.randomBytes(24).toString("hex"),
  };

  const report = {
    startedAt: isoNow(),
    endedAt: null,
    baseUrl,
    tag,
    created: {},
    checks: {},
    cleanup: {
      ok: false,
      residuals: {},
      errors: [],
    },
    status: "CHECK_REQUIRED",
  };

  const cleanup = async () => {
    try {
      if (ids.bot_account_id) {
        await safeDelete(supabase, "bot_command_status", { bot_account_id: ids.bot_account_id });
        await safeDelete(supabase, "bot_telemetry", { bot_account_id: ids.bot_account_id });
      }
      if (ids.bot_id) {
        await safeDelete(supabase, "bot_commands", { bot_id: ids.bot_id });
        await safeDelete(supabase, "bot_settings_global", { bot_id: ids.bot_id });
      }
      if (ids.bot_instance_id) await safeDelete(supabase, "bot_instances", { id: ids.bot_instance_id });
      if (ids.bot_account_id) await safeDelete(supabase, "bot_accounts", { id: ids.bot_account_id });
      if (ids.bot_id) await safeDelete(supabase, "bots", { id: ids.bot_id });
      if (ids.app_account_id) await safeDelete(supabase, "accounts", { id: ids.app_account_id });
      if (ids.category_id) await safeDelete(supabase, "account_categories", { id: ids.category_id });
      await safeDelete(supabase, "live_market_data", { symbol });

      report.cleanup.residuals = {
        bot_command_status: ids.bot_account_id
          ? await countRows(supabase, "bot_command_status", { bot_account_id: ids.bot_account_id })
          : 0,
        bot_commands: ids.bot_id
          ? await countRows(supabase, "bot_commands", { bot_id: ids.bot_id })
          : 0,
        bot_telemetry: ids.bot_account_id
          ? await countRows(supabase, "bot_telemetry", { bot_account_id: ids.bot_account_id })
          : 0,
        bot_instances: ids.bot_instance_id
          ? await countRows(supabase, "bot_instances", { id: ids.bot_instance_id })
          : 0,
        bot_accounts: ids.bot_account_id
          ? await countRows(supabase, "bot_accounts", { id: ids.bot_account_id })
          : 0,
        bots: ids.bot_id ? await countRows(supabase, "bots", { id: ids.bot_id }) : 0,
        accounts: ids.app_account_id
          ? await countRows(supabase, "accounts", { id: ids.app_account_id })
          : 0,
        account_categories: ids.category_id
          ? await countRows(supabase, "account_categories", { id: ids.category_id })
          : 0,
        live_market_data: await countRows(supabase, "live_market_data", { symbol }),
      };

      report.cleanup.ok = Object.values(report.cleanup.residuals).every((n) => Number(n) === 0);
    } catch (error) {
      report.cleanup.errors.push(error instanceof Error ? error.message : String(error));
    }
  };

  try {
    const { data: userRows, error: userErr } = await supabase
      .from("bot_accounts")
      .select("user_id,id")
      .order("created_at", { ascending: false })
      .limit(1);
    if (userErr) throw userErr;
    if (!userRows || userRows.length === 0) {
      throw new Error("No bot_accounts available to derive a valid user_id for smoke run");
    }
    ids.user_id = userRows[0].user_id;

    const { data: categoryRows, error: categoryErr } = await supabase
      .from("account_categories")
      .insert({ user_id: ids.user_id, name: tag, sort_index: 0 })
      .select("id")
      .single();
    if (categoryErr) throw categoryErr;
    ids.category_id = categoryRows.id;

    const { data: appAccountRows, error: appAccountErr } = await supabase
      .from("accounts")
      .insert({
        user_id: ids.user_id,
        name: `${tag}_ACCOUNT`,
        category_id: ids.category_id,
        account_size: 25000,
        current_balance: 25200,
        operation_state: "Active",
        role: "Real",
      })
      .select("id")
      .single();
    if (appAccountErr) throw appAccountErr;
    ids.app_account_id = appAccountRows.id;

    const { data: botRows, error: botErr } = await supabase
      .from("bots")
      .insert({ user_id: ids.user_id, name: `${tag}_BOT` })
      .select("id")
      .single();
    if (botErr) throw botErr;
    ids.bot_id = botRows.id;

    const { data: botAccountRows, error: botAccountErr } = await supabase
      .from("bot_accounts")
      .insert({
        user_id: ids.user_id,
        bot_id: ids.bot_id,
        account_id: `MT5_${tag}`,
        label: tag,
        app_account_id: ids.app_account_id,
      })
      .select("id")
      .single();
    if (botAccountErr) throw botAccountErr;
    ids.bot_account_id = botAccountRows.id;

    const { data: botInstanceRows, error: botInstanceErr } = await supabase
      .from("bot_instances")
      .insert({
        bot_account_id: ids.bot_account_id,
        instance_id: ids.instance_id,
        instance_secret: ids.instance_secret,
        status: "ACTIVE",
      })
      .select("id")
      .single();
    if (botInstanceErr) throw botInstanceErr;
    ids.bot_instance_id = botInstanceRows.id;

    await supabase.from("bot_settings_global").insert({
      bot_id: ids.bot_id,
      settings: { LotsFixed: 0.02, RiskPct: 1.1 },
      updated_by: ids.user_id,
    });

    const { data: commandRows, error: commandErr } = await supabase
      .from("bot_commands")
      .insert({
        bot_id: ids.bot_id,
        command_type: "START",
        payload: { qaTag: tag },
        target_scope: "all",
        created_by: ids.user_id,
        status: "PENDING",
      })
      .select("id")
      .single();
    if (commandErr) throw commandErr;
    ids.command_id = commandRows.id;

    const { error: statusErr } = await supabase.from("bot_command_status").insert({
      command_id: ids.command_id,
      bot_account_id: ids.bot_account_id,
      status: "PENDING",
    });
    if (statusErr) throw statusErr;

    report.created = {
      user_id: ids.user_id,
      bot_id: ids.bot_id,
      bot_account_id: ids.bot_account_id,
      bot_instance_id: ids.bot_instance_id,
      instance_id: ids.instance_id,
      command_id: ids.command_id,
      symbol,
    };

    const settingsRes = await fetch(`${fnBase}/bot-settings-effective`, {
      method: "GET",
      headers: {
        "x-instance-id": ids.instance_id,
        "x-instance-secret": ids.instance_secret,
      },
    });
    report.checks.settingsEffective = {
      status: settingsRes.status,
      ok: settingsRes.ok,
      body: await settingsRes.json().catch(() => ({})),
    };

    const commandsRes = await fetch(`${fnBase}/bot-commands`, {
      method: "GET",
      headers: {
        "x-instance-id": ids.instance_id,
        "x-instance-secret": ids.instance_secret,
      },
    });
    const commandsBody = await commandsRes.json().catch(() => ({}));
    report.checks.commands = {
      status: commandsRes.status,
      ok: commandsRes.ok,
      pendingCount: Array.isArray(commandsBody.commands) ? commandsBody.commands.length : null,
    };

    const ackRes = await fetch(`${fnBase}/bot-ack`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        instance_id: ids.instance_id,
        instance_secret: ids.instance_secret,
        command_id: ids.command_id,
        status: "APPLIED",
        message: `${tag}-ack`,
      }),
    });
    report.checks.ack = {
      status: ackRes.status,
      ok: ackRes.ok,
      body: await ackRes.json().catch(() => ({})),
    };

    const [{ data: ackStatusRows }, { data: commandStateRows }] = await Promise.all([
      supabase
        .from("bot_command_status")
        .select("status, acked_at")
        .eq("command_id", ids.command_id)
        .eq("bot_account_id", ids.bot_account_id)
        .limit(1),
      supabase.from("bot_commands").select("status").eq("id", ids.command_id).limit(1),
    ]);
    report.checks.ackPersisted = {
      statusRow: (ackStatusRows && ackStatusRows[0]) || null,
      commandRow: (commandStateRows && commandStateRows[0]) || null,
    };

    const telemetryRes = await fetch(`${fnBase}/bot-telemetry`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        instance_id: ids.instance_id,
        instance_secret: ids.instance_secret,
        telemetry: {
          equity: 25333.5,
          balance: 25222.2,
          positions_total: 1,
          positions_buy: 1,
          positions_sell: 0,
          basket_r: 1.1,
          tier: "QA",
          last_signal_text: tag,
          last_heartbeat_ts: isoNow(),
        },
      }),
    });
    report.checks.telemetry = {
      status: telemetryRes.status,
      ok: telemetryRes.ok,
      body: await telemetryRes.json().catch(() => ({})),
    };

    const [{ data: heartbeatRows }, { data: telemetryRows }] = await Promise.all([
      supabase.from("bot_instances").select("last_heartbeat_at").eq("id", ids.bot_instance_id).limit(1),
      supabase
        .from("bot_telemetry")
        .select("equity,last_heartbeat_ts,updated_at")
        .eq("bot_account_id", ids.bot_account_id)
        .limit(1),
    ]);
    report.checks.telemetryPersisted = {
      instance: (heartbeatRows && heartbeatRows[0]) || null,
      telemetry: (telemetryRows && telemetryRows[0]) || null,
    };

    const missingHeadersRes = await fetch(`${fnBase}/bot-settings-effective`);
    report.checks.negativeMissingHeaders = {
      status: missingHeadersRes.status,
      okExpected401: missingHeadersRes.status === 401,
    };

    const badSecretRes = await fetch(`${fnBase}/bot-settings-effective`, {
      headers: { "x-instance-id": ids.instance_id, "x-instance-secret": "wrong_secret" },
    });
    report.checks.negativeBadSecret = {
      status: badSecretRes.status,
      okExpected401: badSecretRes.status === 401,
    };

    const webhookNoSigRes = await fetch(`${baseUrl}/api/webhooks/mt5`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        symbol,
        bid: 2000.1,
        ask: 2000.4,
        last: 2000.2,
        timestamp: Date.now(),
      }),
    });
    report.checks.webhookMissingSignature = {
      status: webhookNoSigRes.status,
      okExpected401: webhookNoSigRes.status === 401,
    };

    if (!skipSignedWebhook && webhookSecret) {
      const webhookPayload = {
        symbol,
        bid: 3210.1,
        ask: 3210.4,
        last: 3210.2,
        timestamp: Date.now(),
      };
      const raw = JSON.stringify(webhookPayload);
      const ts = String(Date.now());
      const sig = crypto.createHmac("sha256", webhookSecret).update(`${ts}.${raw}`).digest("hex");

      const signedRes = await fetch(`${baseUrl}/api/webhooks/mt5`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-mt5-timestamp": ts,
          "x-mt5-signature": sig,
        },
        body: raw,
      });
      report.checks.webhookSigned = {
        status: signedRes.status,
        ok: signedRes.ok,
        body: await signedRes.json().catch(() => ({})),
      };

      const { data: marketRows, error: marketErr } = await supabase
        .from("live_market_data")
        .select("symbol,last,updated_at")
        .eq("symbol", symbol)
        .limit(1);
      report.checks.marketDataPersisted = {
        row: marketRows && marketRows[0] ? marketRows[0] : null,
        error: marketErr?.message || null,
      };
    } else {
      report.checks.webhookSigned = {
        skipped: true,
        reason: !webhookSecret
          ? "MT5_WEBHOOK_SECRET unavailable"
          : "skipSignedWebhook=true",
      };
    }
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
  } finally {
    await cleanup();
    report.endedAt = isoNow();
  }

  report.status =
    !report.error &&
    requiredChecksPassed(report) &&
    report.cleanup.ok &&
    report.cleanup.errors.length === 0
      ? "PASS"
      : "CHECK_REQUIRED";

  ensureDir(path.dirname(output));
  fs.writeFileSync(output, JSON.stringify(report, null, 2), "utf8");
  console.log(`[bot-control-plane-smoke] report: ${output}`);
  console.log(`[bot-control-plane-smoke] status: ${report.status}`);

  if (report.status !== "PASS") {
    process.exitCode = 2;
  }
}

run().catch((error) => {
  console.error("[bot-control-plane-smoke] fatal:", error instanceof Error ? error.message : error);
  process.exit(1);
});

