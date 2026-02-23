# Bot Runtime Pilot 24h

This runbook validates Bot Control runtime using real MT5 traffic for 24 hours.

## Scope

- Control plane stability: heartbeat, telemetry, commands, ACK status.
- Runtime integrity: no stale instances, no stuck pending commands.
- No schema changes and no UI redesign.

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

### 2) Optional short smoke (5 minutes)

```bash
npm run pilot:bot-runtime -- --duration-min 5 --interval-sec 30 --output bot-runtime-pilot-smoke.json
```

## Report interpretation

Output file fields:

- `summary.status`
  - `PASS`: no S1 alerts.
  - `FAIL`: at least one S1 alert.
  - `BLOCKED_NO_INSTANCES`: no live instance detected (pilot cannot validate runtime).
- `alertsBySeverity`:
  - `S1`: stale heartbeat or timed-out pending commands.
  - `S2`: missing telemetry rows or failed commands during run.

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

