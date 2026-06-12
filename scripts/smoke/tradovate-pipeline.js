#!/usr/bin/env node
// Smoke test end-to-end del pipeline Tradovate (dispatcher → cme_signals).
//
// Ejercita el flujo que el cron tradovate-poll dispararía cuando hay un
// algoritmo Tradovate corriendo:
//
//   1. Crea algo_cme_accounts temporal (paper).
//   2. Crea cme_connections con status='connected' (sin token real — solo
//      schema OK; los tests del executor real requieren cuenta Tradovate).
//   3. Crea cme_risk_configs habilitado.
//   4. Crea algoritmo Tradovate temporal (status=paper).
//   5. Insert directo a cme_signals con status='pending' (simula que el
//      dispatcher procesó una señal).
//   6. Verifica que el row se persistió correctamente.
//   7. Test del kill-switch: crea otro signal pero con risk_config disabled —
//      el cron real lo marcaría rejected. Verificamos contrato del schema.
//   8. Cleanup completo.
//
// NOTA: este smoke NO invoca Tradovate real ni el cron HTTP. Valida el
// contrato de schema + flujo de datos que el dispatcher Tradovate respeta.
// Para test contra Tradovate real se necesita cuenta + credenciales OAuth.
//
// Uso:
//   npm run smoke:tradovate-pipeline
//
// Env requeridos (carga desde .env.local + .env):
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   BOT_OPS_USER_ID

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
  console.log("\n=== Smoke test del pipeline Tradovate ===\n");
  for (const r of results) {
    const mark = r.ok ? "✓" : "✗";
    console.log(`${mark} ${r.step.padEnd(52)} ${(r.durationMs + "ms").padStart(7)}`);
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

async function main() {
  const supabaseUrl = envOrFail("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = envOrFail("SUPABASE_SERVICE_ROLE_KEY");
  const userId = envOrFail("BOT_OPS_USER_ID");

  const svc = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const suffix = crypto.randomBytes(4).toString("hex");

  let cmeAccountId = null;
  let connectionId = null;
  let riskConfigId = null;
  let algoId = null;
  let signalIdAllowed = null;
  let signalIdRejected = null;

  // 1. Crear algo_cme_accounts temporal (paper).
  await step("1. Crear algo_cme_accounts (paper)", async () => {
    const { data, error } = await svc
      .from("algo_cme_accounts")
      .insert({
        user_id: userId,
        label: `smoke-tradovate-${suffix}`,
        provider_name: "Demo",
        account_number: `DEMO-${suffix}`,
        account_type: "evaluation",
        is_paper: true,
        funded_amount: 50000,
        max_daily_loss: 1000,
      })
      .select("id, label")
      .single();
    if (error) throw new Error(error.message);
    cmeAccountId = data.id;
    return `id=${cmeAccountId} max_daily_loss=$1000`;
  });

  // 2. Crear cme_connections row (status=connected, sin token real).
  await step("2. Crear cme_connections (status=connected)", async () => {
    const { data, error } = await svc
      .from("cme_connections")
      .insert({
        user_id: userId,
        cme_account_id: cmeAccountId,
        broker_type: "tradovate",
        status: "connected",
        tradovate_account_id: 999999, // placeholder — sin Tradovate real
        tradovate_account_spec: "DEMO-SPEC",
        daily_pnl_usd: -50, // simula pequeña pérdida del día (no cruza umbral)
        token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    connectionId = data.id;
    return `connection_id=${connectionId} daily_pnl=-$50`;
  });

  // 3. Crear cme_risk_configs habilitado.
  await step("3. Crear cme_risk_configs (enabled, circuit=80%)", async () => {
    const { data, error } = await svc
      .from("cme_risk_configs")
      .insert({
        user_id: userId,
        cme_account_id: cmeAccountId,
        enabled: true,
        circuit_breaker_pct: 80,
        max_positions: 3,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    riskConfigId = data.id;
    return `config_id=${riskConfigId} circuit_breaker_pct=80 max_positions=3`;
  });

  // 4. Crear algoritmo Tradovate temporal (status=paper).
  await step("4. Crear algoritmo Tradovate (paper)", async () => {
    const { data, error } = await svc
      .from("algorithms")
      .insert({
        user_id: userId,
        name: `smoke-tradovate-algo-${suffix}`,
        status: "paper",
        market_type: "futures",
        platform: "Tradovate",
        engine_config: { kind: "smoke" },
        parameters: {
          cme_account_id: cmeAccountId,
          contract: "ESH4",
          contracts_per_trade: 1,
          sl_ticks: 20,
          tp_ticks: 40,
        },
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    algoId = data.id;
    return `algo_id=${algoId} platform=Tradovate contract=ESH4`;
  });

  // 5. Insert cme_signals 'pending' que dispatcher pondría (simula
  //    dispatch_tradovate.ts step 1).
  await step("5. Insert cme_signals (status=pending)", async () => {
    const { data, error } = await svc
      .from("cme_signals")
      .insert({
        user_id: userId,
        algorithm_id: algoId,
        cme_account_id: cmeAccountId,
        contract: "ESH4",
        direction: "BUY",
        signal_type: "entry",
        quantity: 1,
        stop_loss_ticks: 20,
        take_profit_ticks: 40,
        status: "pending",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    signalIdAllowed = data.id;
    return `signal_id=${signalIdAllowed} BUY ESH4 x1`;
  });

  // 6. Verifica que el row es queryable con el schema esperado.
  await step("6. Verificar shape del signal (status + contract + quantity)", async () => {
    const { data, error } = await svc
      .from("cme_signals")
      .select("id, status, direction, contract, quantity, stop_loss_ticks, take_profit_ticks")
      .eq("id", signalIdAllowed)
      .single();
    if (error) throw new Error(error.message);
    if (data.status !== "pending") throw new Error(`status mismatch: ${data.status}`);
    if (data.direction !== "BUY") throw new Error(`direction mismatch`);
    if (data.contract !== "ESH4") throw new Error(`contract mismatch`);
    return `status=${data.status} SL=${data.stop_loss_ticks}t TP=${data.take_profit_ticks}t`;
  });

  // 7. Simula kill-switch denegando: deshabilita risk_config + insert un
  //    signal nuevo con status='rejected' reject_reason='account_disabled'.
  await step("7. Simular kill-switch (risk_config disabled → rejected)", async () => {
    const { error: updErr } = await svc
      .from("cme_risk_configs")
      .update({ enabled: false, paused_reason: "manual" })
      .eq("id", riskConfigId);
    if (updErr) throw new Error(`disable risk: ${updErr.message}`);

    const { data, error } = await svc
      .from("cme_signals")
      .insert({
        user_id: userId,
        algorithm_id: algoId,
        cme_account_id: cmeAccountId,
        contract: "ESH4",
        direction: "SELL",
        signal_type: "entry",
        quantity: 1,
        stop_loss_ticks: 20,
        take_profit_ticks: 40,
        status: "rejected",
        reject_reason: "manual",
      })
      .select("id, status, reject_reason")
      .single();
    if (error) throw new Error(error.message);
    if (data.status !== "rejected") throw new Error("status no es rejected");
    signalIdRejected = data.id;
    return `signal_id=${signalIdRejected} status=${data.status} reason=${data.reject_reason}`;
  });

  // 8. Verifica el conteo final de signals para este algo (debería ser 2:
  //    1 pending + 1 rejected).
  await step("8. Verificar tally final (1 pending + 1 rejected)", async () => {
    const { data, error } = await svc
      .from("cme_signals")
      .select("status", { count: "exact" })
      .eq("algorithm_id", algoId);
    if (error) throw new Error(error.message);
    const total = data.length;
    const pending = data.filter((r) => r.status === "pending").length;
    const rejected = data.filter((r) => r.status === "rejected").length;
    if (total !== 2 || pending !== 1 || rejected !== 1) {
      throw new Error(`tally mismatch: total=${total} pending=${pending} rejected=${rejected}`);
    }
    return `total=2 pending=1 rejected=1`;
  });

  // 9. Cleanup completo (orden importa por FKs).
  await step("9. Cleanup completo", async () => {
    await svc.from("cme_signals").delete().eq("algorithm_id", algoId);
    await svc.from("algorithms").delete().eq("id", algoId);
    await svc.from("cme_risk_configs").delete().eq("id", riskConfigId);
    await svc.from("cme_connections").delete().eq("id", connectionId);
    await svc.from("algo_cme_accounts").delete().eq("id", cmeAccountId);
    return `borrado: algo ${algoId}, signals 2, risk ${riskConfigId}, conn ${connectionId}, acct ${cmeAccountId}`;
  });

  printResults();
}

main().catch((err) => {
  console.error("Smoke test fatal:", err);
  process.exit(2);
});
