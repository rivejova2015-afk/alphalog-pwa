#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");

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

function findLatestContextPath() {
  const tempDir = os.tmpdir();
  if (!fs.existsSync(tempDir)) return null;
  const candidates = fs
    .readdirSync(tempDir)
    .filter((name) => /^pilot-runtime-context-\d+\.json$/.test(name))
    .map((name) => {
      const full = path.join(tempDir, name);
      const stat = fs.statSync(full);
      return { full, mtime: stat.mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
  return candidates[0]?.full || null;
}

function asNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const contextPath = args.contextPath || findLatestContextPath();
  const intervalSec = asNumber(args.intervalSec, 45);
  const stopAfterMin = asNumber(args.stopAfterMin, 0);
  const tier = args.tier || "REAL_AGENT";

  if (!contextPath || !fs.existsSync(contextPath)) {
    throw new Error("Missing --contextPath and no context file found in temp dir");
  }

  const context = JSON.parse(fs.readFileSync(contextPath, "utf8"));
  const env = { ...process.env, ...loadEnvFile(path.join(process.cwd(), ".env.local")) };

  if (!env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }

  const fnBase = `${new URL(env.NEXT_PUBLIC_SUPABASE_URL).origin.replace(".supabase.co", ".functions.supabase.co")}`;
  const intervalMs = intervalSec * 1000;
  const stopAt = stopAfterMin > 0 ? Date.now() + stopAfterMin * 60 * 1000 : null;
  let tick = 0;

  console.log(`[agent] started for ${context.instance_id}`);
  console.log(`[agent] context=${contextPath}`);
  console.log(`[agent] interval=${intervalSec}s tier=${tier}`);

  while (true) {
    tick += 1;
    const nowIso = new Date().toISOString();
    const eq = 25200 + Math.sin(tick / 2) * 80;
    const bal = 25150 + Math.sin(tick / 3) * 60;

    try {
      const telemetryRes = await fetch(`${fnBase}/bot-telemetry`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          instance_id: context.instance_id,
          instance_secret: context.instance_secret,
          telemetry: {
            equity: Number(eq.toFixed(2)),
            balance: Number(bal.toFixed(2)),
            positions_total: tick % 2,
            positions_buy: tick % 2,
            positions_sell: (tick + 1) % 2,
            basket_r: Number((0.5 + (tick % 4) / 10).toFixed(2)),
            tier,
            last_signal_text: `agent-${tick}`,
            last_signal_ts: nowIso,
            last_heartbeat_ts: nowIso,
          },
        }),
      });

      const commandsRes = await fetch(`${fnBase}/bot-commands`, {
        method: "GET",
        headers: {
          "x-instance-id": context.instance_id,
          "x-instance-secret": context.instance_secret,
        },
      });

      let acked = 0;
      if (commandsRes.ok) {
        const data = await commandsRes.json().catch(() => ({ commands: [] }));
        const commands = Array.isArray(data.commands) ? data.commands : [];
        for (const item of commands) {
          const commandId = item?.command?.id;
          if (!commandId) continue;
          const ackRes = await fetch(`${fnBase}/bot-ack`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              instance_id: context.instance_id,
              instance_secret: context.instance_secret,
              command_id: commandId,
              status: "APPLIED",
              message: `agent-ack-${tick}`,
            }),
          });
          if (ackRes.ok) acked += 1;
        }
      }

      console.log(`[agent] tick=${tick} telemetry=${telemetryRes.status} acked=${acked}`);
    } catch (error) {
      console.error(`[agent] tick=${tick} err=${error instanceof Error ? error.message : String(error)}`);
    }

    if (stopAt && Date.now() >= stopAt) {
      console.log("[agent] stopAfterMin reached");
      break;
    }

    await sleep(intervalMs);
  }
}

run().catch((error) => {
  console.error("[agent] fatal", error instanceof Error ? error.message : String(error));
  process.exit(1);
});

