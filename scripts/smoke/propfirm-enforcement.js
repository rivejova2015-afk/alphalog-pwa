#!/usr/bin/env node
// Smoke test end-to-end del enforcement propfirm (Fase 2 + A2).
//
// Ejercita los 4 paths que el risk-manager bloquea según provider_name:
//   1. Apex pre-cutoff (16:50 ET) → allowed
//   2. Apex past-cutoff (17:00 ET) → propfirm_overnight_cutoff
//   3. MFFU + terminal_events impact='high' en ventana → propfirm_news_blackout
//   4. Apex $25K + 1 posición de 2 contracts + nueva orden de 1 → propfirm_max_contracts
//
// Uso:
//   npm run smoke:propfirm-enforcement
//
// Env requeridos (carga desde .env.local + .env):
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   CRON_SECRET (autoriza el debug endpoint)
//   BOT_OPS_USER_ID
//   NEXT_PUBLIC_APP_URL (default https://alphalog.io)

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(path.resolve(__dirname, "../../.env.local"));
loadEnvFile(path.resolve(__dirname, "../../.env"));

function envOrFail(key) {
  const v = process.env[key];
  if (!v) {
    console.error(`Missing env var: ${key}`);
    process.exit(2);
  }
  return v;
}

const results = [];

function record(step, ok, detail, durationMs) {
  results.push({ step, ok, detail, durationMs });
}

function printResults() {
  console.log("\n=== Smoke test del enforcement propfirm ===\n");
  for (const r of results) {
    const mark = r.ok ? "✓" : "✗";
    console.log(`${mark} ${r.step.padEnd(56)} ${(r.durationMs + "ms").padStart(7)}`);
    if (r.detail) console.log(`    ${r.detail}`);
  }
  const allOk = results.every((r) => r.ok);
  console.log(`\n${allOk ? "✓ ALL PASS" : "✗ FAILED"}\n`);
  process.exit(allOk ? 0 : 1);
}

async function step(label, fn) {
  const start = Date.now();
  try {
    const detail = await fn();
    record(label, true, detail ?? "", Date.now() - start);
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    record(label, false, msg, Date.now() - start);
    printResults();
  }
}

async function riskCheck(appUrl, cronSecret, payload) {
  const res = await fetch(`${appUrl}/api/debug/cme/risk-check`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cronSecret}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  }
  return res.json();
}

async function main() {
  const supabaseUrl = envOrFail("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = envOrFail("SUPABASE_SERVICE_ROLE_KEY");
  const userId = envOrFail("BOT_OPS_USER_ID");
  const cronSecret = envOrFail("CRON_SECRET");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://alphalog.io";

  const svc = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const suffix = crypto.randomBytes(4).toString("hex");

  let cmeAccountId = null;
  let connectionId = null;
  let riskConfigId = null;
  let positionId = null;
  let eventId = null;

  // Junio 2026 está en DST. 16:50 ET = 20:50 UTC; 17:00 ET = 21:00 UTC.
  // Usamos un lunes (2026-06-15) para que isCmeFuturesMarketHours también sea true.
  const beforeCutoff = "2026-06-15T20:50:00Z"; // 16:50 ET (RTH abierto, antes 16:59)
  const afterCutoff = "2026-06-15T20:59:30Z"; // 16:59:30 ET (past Apex cutoff, antes pause)
  const newsTime = "2026-06-15T14:30:00Z"; // 10:30 ET — ventana de 2 min para event

  await step("1. Crear algo_cme_accounts (Apex, $50K)", async () => {
    const { data, error } = await svc
      .from("algo_cme_accounts")
      .insert({
        user_id: userId,
        label: `smoke-propfirm-${suffix}`,
        provider_name: "Apex",
        account_number: `APX-${suffix}`,
        account_type: "propfirm",
        is_paper: true,
        funded_amount: 50000,
        max_daily_loss: 1000,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    cmeAccountId = data.id;
    return `id=${cmeAccountId} provider=Apex funded=$50K (max_contracts=4)`;
  });

  await step("2. Crear cme_connections (status=connected)", async () => {
    const { data, error } = await svc
      .from("cme_connections")
      .insert({
        user_id: userId,
        cme_account_id: cmeAccountId,
        broker_type: "tradovate",
        status: "connected",
        tradovate_account_id: 999999,
        tradovate_account_spec: "DEMO-SPEC",
        daily_pnl_usd: -50,
        token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    connectionId = data.id;
    return `connection_id=${connectionId}`;
  });

  await step("3. Crear cme_risk_configs (enabled)", async () => {
    const { data, error } = await svc
      .from("cme_risk_configs")
      .insert({
        user_id: userId,
        cme_account_id: cmeAccountId,
        enabled: true,
        circuit_breaker_pct: 80,
        max_positions: 99,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    riskConfigId = data.id;
    return `config_id=${riskConfigId}`;
  });

  // ── Apex overnight cutoff ────────────────────────────────────────────────
  await step("4. Apex 16:50 ET (antes cutoff) → allowed", async () => {
    const r = await riskCheck(appUrl, cronSecret, {
      cmeAccountId, userId, direction: "BUY", quantity: 1, now: beforeCutoff,
    });
    if (!r.result.allowed) {
      throw new Error(`expected allowed, got rejected: ${r.result.reason}`);
    }
    return `allowed=true (no reason)`;
  });

  await step("5. Apex 16:59:30 ET (past cutoff) → propfirm_overnight_cutoff", async () => {
    const r = await riskCheck(appUrl, cronSecret, {
      cmeAccountId, userId, direction: "BUY", quantity: 1, now: afterCutoff,
    });
    if (r.result.allowed) throw new Error("expected rejected, got allowed");
    if (r.result.reason !== "propfirm_overnight_cutoff") {
      throw new Error(`expected propfirm_overnight_cutoff, got ${r.result.reason}`);
    }
    return `reason=${r.result.reason}`;
  });

  // ── MFFU news blackout ───────────────────────────────────────────────────
  await step("6. Cambiar a MyFundedFutures + insertar terminal_event high impact", async () => {
    const { error: updErr } = await svc
      .from("algo_cme_accounts")
      .update({ provider_name: "MyFundedFutures" })
      .eq("id", cmeAccountId);
    if (updErr) throw new Error(`update: ${updErr.message}`);

    const { data: ev, error } = await svc
      .from("terminal_events")
      .insert({
        user_id: userId,
        name: `Smoke FOMC ${suffix}`,
        impact: "high",
        timestamp_utc: newsTime,
        // instrument_id requerido si el schema lo exige — el código del risk
        // manager no filtra por instrument, así que cualquier valor sirve.
      })
      .select("id")
      .single();
    if (error) throw new Error(`insert event: ${error.message}`);
    eventId = ev.id;
    return `provider=MyFundedFutures event_id=${eventId}`;
  });

  await step("7. MFFU + event en ventana ±2min → propfirm_news_blackout", async () => {
    const r = await riskCheck(appUrl, cronSecret, {
      cmeAccountId, userId, direction: "BUY", quantity: 1, now: newsTime,
    });
    if (r.result.allowed) throw new Error("expected rejected, got allowed");
    if (r.result.reason !== "propfirm_news_blackout") {
      throw new Error(`expected propfirm_news_blackout, got ${r.result.reason}`);
    }
    return `reason=${r.result.reason}`;
  });

  // ── Apex max contracts per tier ──────────────────────────────────────────
  await step("8. Cambiar de vuelta a Apex $25K + insertar posición de 2 contracts", async () => {
    const { error: updErr } = await svc
      .from("algo_cme_accounts")
      .update({ provider_name: "Apex", funded_amount: 25000 })
      .eq("id", cmeAccountId);
    if (updErr) throw new Error(`update: ${updErr.message}`);

    const { data: pos, error } = await svc
      .from("cme_positions")
      .insert({
        user_id: userId,
        cme_account_id: cmeAccountId,
        contract: "ESH4",
        direction: "BUY",
        quantity: 2,
        is_manual: false,
        opened_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw new Error(`insert position: ${error.message}`);
    positionId = pos.id;
    return `provider=Apex funded=$25K position quantity=2 (límite=2)`;
  });

  await step("9. Apex $25K con 2 contracts abiertos + nueva orden de 1 → propfirm_max_contracts", async () => {
    const r = await riskCheck(appUrl, cronSecret, {
      cmeAccountId, userId, direction: "BUY", quantity: 1, now: beforeCutoff,
    });
    if (r.result.allowed) throw new Error("expected rejected, got allowed");
    if (r.result.reason !== "propfirm_max_contracts") {
      throw new Error(`expected propfirm_max_contracts, got ${r.result.reason}`);
    }
    return `reason=${r.result.reason} (current 2 + 1 > limit 2)`;
  });

  // ── Cleanup ──────────────────────────────────────────────────────────────
  await step("10. Cleanup completo", async () => {
    if (positionId) await svc.from("cme_positions").delete().eq("id", positionId);
    if (eventId) await svc.from("terminal_events").delete().eq("id", eventId);
    await svc.from("cme_risk_configs").delete().eq("id", riskConfigId);
    await svc.from("cme_connections").delete().eq("id", connectionId);
    await svc.from("algo_cme_accounts").delete().eq("id", cmeAccountId);
    return `borrado: position ${positionId}, event ${eventId}, risk ${riskConfigId}, conn ${connectionId}, acct ${cmeAccountId}`;
  });

  printResults();
}

main().catch((err) => {
  console.error("Smoke test fatal:", err);
  process.exit(2);
});
