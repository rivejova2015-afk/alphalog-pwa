# Coinarb 50x

Crypto SMC + latency arbitrage bot. Spot-only (Coinbase) with Binance as cross-venue reference. Deployed on Fly.io as `coinarb-50x`. Integrated with the AlphaLog `algorithms` framework (Fase A/B/C) for unified UI control, hot-reloadable parameters, and pause/resume commands.

> For the broader integration context, see `CLAUDE.md` → "Coinarb ↔ Algorithms unification".

---

## Quick links

| Resource | Where |
|---|---|
| Production app | https://fly.io/apps/coinarb-50x |
| Live telemetry | https://alphalog.io/intelligence/algorithms → "Coinarb 50x" |
| Heartbeat cron | `/api/ops/cron/coinarb-heartbeat` (Vercel cron, 1m) |
| Auto-deploy | `.github/workflows/coinarb-deploy.yml` (push to main with `coinarb/**` changes) |
| Source of truth for tunables | `algorithms.parameters` (Supabase), hot-reloaded by command-poller |

---

## Setup (local dev)

```bash
cd coinarb
npm install
cp .env.example .env.local   # edit with your creds
npm test                     # runs vitest, all green expected
npm run dev                  # local loop (paper mode default)
```

Required env vars (bot fails to start without these):

- `SUPABASE_URL` — `https://jgkvnnlodwdtjsmmzwry.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` — bypass RLS for telemetry/decisions writes
- `DATA_ENCRYPTION_KEY` — base64, 32 bytes (matches main app's key)

Recommended:

- `COINARB_USER_ID` — needed for telemetry writes (without it, the bot still runs but produces zero rows)
- `COINARB_50X_PAPER_MODE=true` (default) — flip to `false` only after the preflight checklist below

Live trading requires both Coinbase CDP creds:

- `COINBASE_CDP_KEY_NAME` — `organizations/{org}/apiKeys/{key}`
- `COINBASE_CDP_PRIVATE_KEY` — EC PEM (no escaped newlines)

Optional (graceful fallback when missing):

- `COINGLASS_API_KEY` — for liquidation heatmap validator (currently stub)
- `CRYPTOQUANT_API_KEY` — for exchange flows validator (currently stub)
- `ALPHALOG_PUSH_NOTIFY_URL` + `ALPHALOG_PUSH_NOTIFY_TOKEN` — push notifications on entries/exits

---

## Architecture (1-minute tour)

```
src/
├── core/
│   ├── config.ts        # Live-bindable tunables (paper mode, thresholds, IDs)
│   ├── index.ts         # Entrypoint: loadConfigFromDb + buildLoop + SIGTERM
│   └── loop.ts          # Main tick (15s): SMC pipeline per symbol + telemetry
├── analysis/
│   ├── smc-detector.ts  # detectSmc, evaluateConfluence, detectLiquiditySweep,
│   │                    # validateChochDisplacement, evaluatePremiumDiscount
│   ├── mtf-analyzer.ts  # Multi-timeframe bias aggregation across 7 TFs
│   └── candle-builder.ts# OHLC aggregation from 1m ticks
├── feeds/               # CoinbaseFeed (WS) + BinanceFeed (WS) with watchdogs
├── ops/
│   ├── command-poller.ts# Polls bot_commands every 30s (update_parameters/pause/resume)
│   ├── decision-logger.ts # Writes coinarb_decisions (every SKIP/ENTER/EXIT)
│   ├── agent-heartbeat.ts # Mirrors heartbeat to legacy coinarb_agents table
│   ├── smc-signal-persist.ts # Analytics writes to coinarb_smc_signals
│   └── notify-alphalog.ts # Push notifications via AlphaLog webhook
├── risk/
│   ├── phase-manager.ts # 11 capital tiers ($100 → $100k+) with auto-scaled risk %
│   ├── circuit-breaker.ts # 6 consecutive losses → 3h pause
│   └── daily-tracker.ts # 100 trades/day cap, 33/symbol
├── trading/
│   ├── coinbase-spot-orders.ts # Live order placement (CDP JWT auth)
│   └── spot-positions.ts # Open/close in coinarb_positions
├── paper/
│   └── paper-spot-broker.ts # In-memory broker for PAPER_MODE
├── validators/          # F&G, volume delta, volume profile, liquidation (stub), flows (stub)
└── math/
    └── kelly-sizer.ts   # checkRiskReward, computeKellySize
```

Per-tick pipeline (`loop.ts:evaluateSymbol`):

1. Warmup gate (≥30 samples from each WS feed)
2. MTF analysis → `bias` + `confidence ≥ MTF_CONFIDENCE_MIN`
3. Best-effort persist `coinarb_smc_signals` (5m signal)
4. Premium/Discount (macro 3D + micro 5M)
5. Liquidity sweep (EQH/EQL boundary + 1m confirmation)
6. CHOCH displacement (15m/5m/1m aligned)
7. Confluence (OB/FVG/EQ + 2h pace)
8. Arb gap vs Binance (per-symbol min %)
9. Volume delta agreement, value area, R:R ≥ 2.0
10. Phase-manager risk USD + circuit-breaker canTrade
11. **ENTER**: paper broker fill + (if LIVE) coinbase-spot-orders → persist position
12. Manage open positions: TP/SL hit detection

Every 15s, `flushTelemetry()` upserts `coinarb_telemetry` (heartbeat, WS status, phase, F&G, daily counters) and mirrors heartbeat to `coinarb_agents`.

---

## Testing

```bash
npm test          # vitest, 179+ tests
npm test -- --run sweep-detector  # single suite
```

Backtest replay (forward TP/SL scoring against historical bars):

```bash
npm run backtest                       # snapshot mode (current verdict per symbol)
tsx scripts/backtest.ts --days=7       # 7d replay with aggregate stats
tsx scripts/backtest.ts --days=7 --json  # machine-readable summary on stdout
```

CI quality gate (runs on every push to main with `coinarb/**` changes):

```bash
# Workflow runs:
tsx scripts/backtest.ts --days=7 --json > /tmp/result.txt
tsx scripts/check-backtest-threshold.ts --file=/tmp/result.txt

# Default thresholds:
#   --min-win-rate=0.30
#   --min-total-pnl-r=0
#   --min-entries=3
#   --max-worst-run=8
```

Bypass the gate (emergencies only): include `[skip-backtest]` in the commit message.

---

## Deploy

Auto-deploy on push to `main` (workflow `coinarb-deploy.yml`):

1. `npm ci`
2. `tsc --noEmit`
3. `npm run build`
4. `npm test -- --run`
5. **Backtest quality gate** (`--days=7`, lax thresholds — see Testing)
6. `flyctl deploy --app coinarb-50x --strategy rolling --remote-only`

Manual deploy with custom strategy:

```bash
# From local machine
flyctl deploy --app coinarb-50x --strategy bluegreen --remote-only

# Via Actions UI: workflow_dispatch → choose rolling/immediate/bluegreen
```

Fly secrets (set via `flyctl secrets set`):

```bash
flyctl secrets set COINARB_50X_PAPER_MODE=false -a coinarb-50x
flyctl secrets set COINBASE_CDP_KEY_NAME='organizations/.../apiKeys/...' -a coinarb-50x
flyctl secrets set COINBASE_CDP_PRIVATE_KEY="$(cat private-key.pem)" -a coinarb-50x
```

---

## Live trading switchover

**Do NOT flip `COINARB_50X_PAPER_MODE=false` without running the preflight script.**

```bash
cd coinarb
tsx scripts/preflight-live.ts
```

What it validates:

1. `PAPER_MODE` flag state
2. CDP key + private key present
3. CDP JWT signs (ES256 valid)
4. Auth scope: `/api/v3/brokerage/accounts` returns 200
5. USD balance > 0 (recommend ≥ $20)
6. Product `BTC-USD` reachable, trading not disabled

After preflight passes:

```bash
flyctl secrets set COINARB_50X_PAPER_MODE=false -a coinarb-50x
# Trigger a deploy (or wait for next push to main)
flyctl deploy --app coinarb-50x --remote-only
```

Monitor:

- `flyctl logs -a coinarb-50x`
- AlphaLog `/intelligence/algorithms` → "Coinarb 50x" → Telemetry (15s refresh)
- Heartbeat cron alerts to push notification if stale >5min

---

## Troubleshooting

### Bot is alive but never trades

Likely cause: filter pipeline rejection. Look at `coinarb_decisions` (Supabase) grouped by `reason` over the last 6h. Top historical offenders:

- **`liquidity-sweep: not detected`** (≈ 46% of skips): the SMC sweep requires wick crossing EQH/EQL + close rejecting back + strong 1m confirmation. Genuinely rare in lateral markets. Relax via tunables (see below) before suspecting a bug.
- **`mtf bias=X conf=Y (need ≥ZZ)`**: confidence below threshold. Lower `MTF_CONFIDENCE_MIN` via UI.
- **`premium-discount: macro=X_micro=Y`**: zones conflict. No tunable — wait for alignment.

### Adjust tunables without redeploy

`/intelligence/algorithms` → Detalles "Coinarb 50x" → Tunables tab:

- `mtf_confidence_min` (current default 0.15, range 0.10–0.50)
- `sweep_confirm_body_ratio` (current default 0.40, range 0.30–0.60)
- `pd_macro_band` (current default 0.005)
- `pd_micro_band` (current default 0.005)
- Per-symbol `arb_gap_min` for BTC/ETH/SOL

The UI writes `bot_commands.update_parameters`; the bot's command-poller picks it up within 30s and applies via `applyParameters()` (mutates `let` exports in `config.ts`). No restart needed.

### Heartbeat stale on the dashboard

Two heartbeats exist:

- `coinarb_telemetry.last_heartbeat_at` — source of truth, updated every tick (15s)
- `coinarb_agents.last_heartbeat_at` — mirrored from telemetry (PR #29). Reads from `/intelligence/agents`.

If the dashboard shows OFFLINE but telemetry is fresh: check that `COINARB_USER_ID` is set in Fly secrets. The mirror is best-effort and skipped when the user_id is empty.

### Build / deploy failing

- **Fly Depot OOM during build**: Fly's Depot can OOM (~4 GB) building large Node apps. Workaround for the main `alphalog-pwa` app is to pre-build locally + copy `.next/standalone`. Coinarb is small (no Next), shouldn't hit this.
- **Backtest quality gate fails**: data-source outage (Coinbase REST) or genuine performance regression. Use `[skip-backtest]` in the commit message ONLY if the failure is infrastructure, not strategy regression.

### Hot-reload command not landing

`bot_commands` rows for the bot have `status='DONE'` or `status='FAILED'` once acked. If a command sits in `pending` for >5 min:

1. Check Fly logs for the command-poller: `flyctl logs -a coinarb-50x | grep command`
2. Verify `COINARB_BOT_ID` env matches the seeded `bots.id` (default `11111111-c01a-4b00-9001-000000000001`)

---

## Tables (Supabase)

| Table | Written by | Purpose |
|---|---|---|
| `algorithms` (1 row) | UI (PUT) + bot (status sync) | Source of truth: parameters, status (live/paused) |
| `coinarb_telemetry` | bot (every 15s) | Heartbeat, equity, WS status, phase, F&G |
| `coinarb_agents` | bot (every 15s, PR #29) | Legacy table, mirrored from telemetry for `/intelligence/agents` |
| `coinarb_decisions` | bot (every tick × symbol) | ENTER/SKIP/EXIT with reason — analytics source |
| `coinarb_smc_signals` | bot (PR #29) | Analytics: 5m signals passing MTF threshold |
| `coinarb_positions` | bot (entry/exit) | Open + closed positions with PnL |
| `coinarb_trades` | bot (close) | Completed trades for win-rate calcs |
| `coinarb_daily_stats` | bot (daily rollup) | Per-day aggregate |
| `coinarb_liquidity_map` | bot (refresh) | Cached EQH/EQL zones for the loop |
| `bot_commands` | UI (POST), bot (ack) | Hot-reload of parameters, pause/resume |

Migrations in `supabase/migrations/095_coinarb_rewrite.sql` and successors.

---

## Reading guide

- New to the codebase? Start with `src/core/loop.ts:evaluateSymbol` — that's the whole strategy.
- Adding a new validator? Look at `src/validators/volume-delta.ts` as a template.
- Adding a new tunable? Add it as `export let X = Number(process.env.X ?? 'D')` in `config.ts`, then map it in `applyParameters()`.
- Adding a new persistence table? Mirror the pattern in `src/ops/smc-signal-persist.ts`: pure builder + thin async wrapper, with unit tests.
