# Bot Runtime Pilot 24h

This runbook validates Bot Control runtime using real MT5 traffic for 24 hours and produces an auditable close report with cleanup.

## Scope

- Control plane stability: heartbeat, telemetry, commands, ACK status.
- Runtime integrity: no stale instances, no stuck pending commands.
- No schema changes and no UI redesign.

## Default policy

- Baseline run: 24h pilot.
- Post-baseline validation: 12h MT5 real (no synthetic agent).
- Temp secret files are deleted after finalize.

## Prerequisites

1. At least one real MT5 instance linked in `/dashboard/bot-control`.
2. MT5 EA configured with current `instance_id`, `instance_secret`, and webhook secret.
3. `.env.local` includes:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

## Commands

### 1) Start pilot for 24h

```bash
npm run pilot:bot-runtime -- --duration-min 1440 --interval-sec 60 --output bot-runtime-pilot-24h.json
```

### 2) Optional QA runtime agent (synthetic heartbeat + ACK)

```bash
npm run pilot:bot:agent -- --contextPath "<context-file>" --intervalSec 45
```

> Use only in QA. For real validation, run MT5 terminal/EA and keep this agent OFF.

### 3) Finalize and cleanup after pilot completes

```bash
npm run pilot:bot:finalize -- \
  --reportPath bot-runtime-pilot-24h.json \
  --contextPath "<context-file>" \
  --outputPath bot-runtime-final-24h.json \
  --emulatorPid <pid-if-agent-running>
```

### 4) Cleanup temporary secrets (always)

```bash
npm run ops:cleanup-temp-secrets
```

### 5) Control-plane smoke (read/write with cleanup)

```bash
npm run ops:bot-control-plane-smoke -- --baseUrl https://www.alphalog.io
```

Optional flags:
- `--output <path>` custom report file.
- `--skipSignedWebhook=true` skip signed webhook check when `MT5_WEBHOOK_SECRET` is unavailable.

### 6) Scheduled control-plane window

```bash
npm run ops:bot-control-plane-window -- --baseUrl https://www.alphalog.io --runs 12 --interval-min 60 --signedMode vercel-prod
```

Modes:
- `signedMode=vercel-prod`: pulls production env (includes webhook secret) via `vercel env run`.
- `signedMode=auto`: uses local env; skips signed webhook if secret is absent.
- `signedMode=local`: requires local `MT5_WEBHOOK_SECRET`.

The command writes one smoke report per run and a window summary under `docs/reports/`.

### 7) SLO monitor (Forex + Futuros)

```bash
npm run ops:bot-slo-monitor -- --baseUrl https://www.alphalog.io --window-min 15 --market-policy auto
```

Checks included:
- heartbeat freshness per profile
- ACK latency within window
- pending command timeout
- failed command ratio

Market policy:
- `auto`: outside market hours stale heartbeat is downgraded from S1 to S2.
- `force-open`: never downgrade.
- `force-closed`: always downgrade heartbeat stale to S2.

### 8) Continuous SLO window (15m cadence)

```bash
npm run ops:bot-control-plane-window -- --baseUrl https://www.alphalog.io --runs 96 --interval-min 15 --signedMode vercel-prod --sloMarketPolicy auto --failFastOn s1
```

This executes smoke + SLO monitor on each run and writes per-run reports plus one window summary.

### 9) Auto-recovery (safe restart command on critical SLO)

Dry run:

```bash
npm run ops:bot-auto-recovery -- --baseUrl https://www.alphalog.io --dryRun=true
```

Active mode:

```bash
npm run ops:bot-auto-recovery -- --baseUrl https://www.alphalog.io --dryRun=false --marketPolicy auto
```

Rules:
- Triggers only on profiles with critical checks (`STALE_HEARTBEAT` or `PENDING_TIMEOUT`) at/above threshold severity.
- Uses cooldown (`--cooldownMin`, default 15) to avoid command storms.
- Creates `RESTART_LOGIC` command + `bot_command_status` rows + `AUTO_RECOVERY_TRIGGERED` event.

### 10) Daily consolidated report

```bash
npm run ops:bot-daily-summary
```

Output:
- `docs/reports/bot-ops-daily-summary-YYYYMMDD.json`
- Aggregates windows + SLO + auto-recovery reports for the target day.

## 12h real validation checklist

1. Stop QA synthetic agent.
2. Keep MT5 terminal and EA online for 12h.
3. Acceptance thresholds:
   - `S1 = 0`
   - `S2 <= 2` and explained
   - Command ACK under 60s for test commands

## Report interpretation

Output file fields:

- `summary.status`
  - `PASS`: no S1 alerts.
  - `FAIL`: at least one S1 alert.
  - `BLOCKED_NO_INSTANCES`: no live instance detected (pilot cannot validate runtime).
- `alertsBySeverity`:
  - `S1`: stale heartbeat or timed-out pending commands.
  - `S2`: missing telemetry rows or failed commands during run.

Finalizer output includes:
- `cleanup.residuals` (must be 0 for all tracked tables)
- `secretsCleanup` (deleted temp secret files)
- `archive` (copies written under `docs/reports/`)

## Alert thresholds

Defaults:

- Heartbeat stale threshold: `120s`.
- Pending command timeout threshold: `60s`.

Override example:

```bash
npm run pilot:bot-runtime -- --duration-min 60 --interval-sec 20 --heartbeat-threshold-sec 180 --pending-threshold-sec 90
```

## Operational response

- `STALE_HEARTBEAT (S1)`:
  1. Verify MT5 terminal is online.
  2. Confirm `instance_secret` matches `bot_instances`.
  3. Check `bot-telemetry` edge function logs.
- `PENDING_COMMAND_TIMEOUT (S1)`:
  1. Verify EA polling `bot-commands`.
  2. Verify ACK path `bot-ack`.
  3. Review `bot_command_status` rows older than threshold.
- `MISSING_TELEMETRY (S2)`:
  1. Confirm telemetry payload is being sent from EA.
  2. Review `bot_telemetry` upsert logs.

## Rollback

No code rollback is required for running pilot only.

If you need to revert this tooling commit:

```bash
git revert <commit>
```

or restore specific files:

```bash
git restore scripts/bot-runtime-pilot.js package.json docs/BOT_RUNTIME_PILOT_24H.md
```
