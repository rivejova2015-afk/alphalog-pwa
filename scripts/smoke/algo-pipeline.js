#!/usr/bin/env node
// Smoke test end-to-end del pipeline algo trading + RL data flow.
//
// Ejercita el flujo completo que el bot externo (MT5 EA) ejecutaría una vez
// desplegado, validando que:
//
//   1. Se puede crear un algo_signal_log (simula que /api/bot/signal o
//      /api/algorithms/[id]/signal lo escribió).
//   2. El webhook /api/webhooks/algo-trade acepta el callback con signalId.
//   3. algo_paper_trades.signal_log_id queda linkeado al log.
//   4. La query del skill-manager (JOIN inner) retorna el row con contexto
//      para entrenar el RL.
//
// Uso:
//   node scripts/smoke/algo-pipeline.js [--cleanup] [--app-url=https://...]
//
// Env requeridos (carga desde .env.local + .env):
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   MT5_WEBHOOK_SECRET
//   BOT_OPS_USER_ID  (UUID del dueño, el algo de prueba se asocia a él)

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

function parseArgs(argv) {
  const out = { cleanup: false, appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "https://alphalog.io" };
  for (const token of argv) {
    if (token === "--cleanup") out.cleanup = true;
    else if (token.startsWith("--app-url=")) out.appUrl = token.slice("--app-url=".length);
  }
  return out;
}

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
  console.log("\n=== Smoke test del pipeline algo trading ===\n");
  for (const r of results) {
    const mark = r.ok ? "✓" : "✗";
    console.log(`${mark} ${r.step.padEnd(48)} ${(r.durationMs + "ms").padStart(7)}`);
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
  const args = parseArgs(process.argv.slice(2));
  const supabaseUrl = envOrFail("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = envOrFail("SUPABASE_SERVICE_ROLE_KEY");
  const mt5Secret = envOrFail("MT5_WEBHOOK_SECRET");
  const userId = envOrFail("BOT_OPS_USER_ID");

  const svc = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const signalId = `smoke_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
  let tempAlgoId = null;
  let signalLogId = null;

  // 1. Crear algoritmo temporal en status='paper' (necesario para que el
  //    webhook routee a algo_paper_trades).
  await step("1. Crear algoritmo temporal (status=paper)", async () => {
    const { data, error } = await svc
      .from("algorithms")
      .insert({
        user_id: userId,
        name: `smoke-test-${signalId}`,
        status: "paper",
        market_type: "forex",
        platform: "MT5",
        engine_config: { kind: "smoke" },
      })
      .select("id, name")
      .single();
    if (error) throw new Error(error.message);
    tempAlgoId = data.id;
    return `id=${tempAlgoId} name=${data.name}`;
  });

  // 2. Insertar algo_signal_log (simula /api/bot/signal con contexto completo).
  await step("2. Insert algo_signal_log con contexto del RL", async () => {
    const { data, error } = await svc
      .from("algo_signal_log")
      .insert({
        user_id: userId,
        algorithm_id: tempAlgoId,
        signal_id: signalId,
        symbol: "XAUUSD",
        regime_code: "BULL_TREND_WEAK",
        signal_action: "BUY",
        final_action: "BUY",
        confidence: 0.75,
        vol_15m: 0.003,
        session_code: "NY",
        lots: 0.5,
        overlay_kind: "passthrough",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    signalLogId = data.id;
    return `signal_log_id=${signalLogId} signal_id=${signalId}`;
  });

  // 3. POST al webhook con el signalId (simula el callback del MT5 EA).
  await step("3. POST /api/webhooks/algo-trade con signalId", async () => {
    const res = await fetch(`${args.appUrl}/api/webhooks/algo-trade`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-mt5-secret": mt5Secret },
      body: JSON.stringify({
        algorithmId: tempAlgoId,
        userId,
        symbol: "XAUUSD",
        direction: "BUY",
        lots: 0.5,
        entryPrice: 2000,
        exitPrice: 2010,
        pnl: 5,
        signalId,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
    }
    return `HTTP ${res.status}`;
  });

  // 4. Verificar que algo_paper_trades.signal_log_id quedó linkeado.
  let tradeId = null;
  await step("4. Verificar linkeo signal_log_id en algo_paper_trades", async () => {
    const { data, error } = await svc
      .from("algo_paper_trades")
      .select("id, signal_log_id, pnl, status")
      .eq("signal_log_id", signalLogId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("trade no encontrado con signal_log_id linkeado");
    if (data.signal_log_id !== signalLogId) throw new Error("signal_log_id mismatch");
    tradeId = data.id;
    return `trade_id=${tradeId} status=${data.status} pnl=${data.pnl}`;
  });

  // 5. Simula la query del skill-manager: JOIN inner con algo_signal_log.
  await step("5. Simula query del skill-manager (JOIN inner)", async () => {
    const { data, error } = await svc
      .from("algo_paper_trades")
      .select(
        `id, pnl, direction, entry_price, exit_price, closed_at, signal_log_id,
         algo_signal_log!inner(regime_code, confidence, vol_15m, session_code)`,
      )
      .eq("signal_log_id", signalLogId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data || !data.algo_signal_log) throw new Error("JOIN no devolvió contexto");
    const ctx = data.algo_signal_log;
    return `regime=${ctx.regime_code} conf=${ctx.confidence} vol=${ctx.vol_15m} session=${ctx.session_code}`;
  });

  // 6. Cleanup opcional (default: limpia para no dejar residuo).
  await step(args.cleanup ? "6. Cleanup completo" : "6. Cleanup (siempre)", async () => {
    await svc.from("algo_paper_trades").delete().eq("signal_log_id", signalLogId);
    await svc.from("algo_signal_log").delete().eq("id", signalLogId);
    await svc.from("algorithms").delete().eq("id", tempAlgoId);
    return `borrado: trade ${tradeId}, signal_log ${signalLogId}, algo ${tempAlgoId}`;
  });

  printResults();
}

main().catch((err) => {
  console.error("Smoke test fatal:", err);
  process.exit(2);
});
