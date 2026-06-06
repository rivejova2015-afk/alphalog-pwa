# DISPATCH_MODE flip — shadow → live runbook

## What it does

Setting `DISPATCH_MODE=live` on the Fly `alphalog-pwa` app makes
`dispatchTradovate` actually call `executeSignal()` instead of inserting a
`cme_signals` row with `status='skipped'` / `reject_reason='shadow_mode'`.

**Once flipped, every engine v1 signal from a paper/live Tradovate algorithm
will place a real bracket order on Tradovate** (paper or live account, per
the algo's `is_paper` flag on `algo_cme_accounts`). There is no rollback
window — the next poll cycle (≤60s) starts placing.

## Pre-flight checklist

Run these in order. If any fails, fix before flipping.

1. **Shadow Inbox shows what live mode would do.** Open
   `/intelligence/algorithms` → click your futures algo → "Shadow Inbox"
   section. Inspect the last 24h of rows: they should be coherent BUY/SELL
   signals on the right contract, with reasonable `quantity`,
   `stop_loss_ticks`, and `take_profit_ticks` values. **Skim for: wrong
   direction (BUY when you wanted SELL), absurd quantity (10× expected),
   SL/TP=0**. Any of those = abort.

2. **Telemetry is fresh.** Same modal → "Dispatcher Telemetry" section.
   `last_dispatch_at` should be within the last few minutes during market
   hours. Stale telemetry means the cron isn't running — fix that first
   (logs in Fly `alphalog-cron`).

3. **Tradovate connection is alive.** Modal → CME section. Status badge
   should be green. Hit "Refresh" — should NOT error.

4. **Quality gates passed.** Modal → "Quality Gates Tier-1". Every "must"
   gate green. If any are red, the algo shouldn't be in `paper` status
   anyway; investigate.

5. **Kelly stats sane (if `kelly_enabled=true`).** Modal → "Position Sizing".
   If activated: `win_rate` ∈ (0.4, 0.7), `avg_win > avg_loss` (positive
   edge), `Sample ≥ 30`. Backtest samples can be lucky — if `paper_trades:*`
   source has shown up, prefer that.

6. **`SUPABASE_SERVICE_ROLE_KEY` is set in Fly.** The dispatcher needs it
   to renew Tradovate tokens.
   ```bash
   flyctl secrets list -a alphalog-pwa | grep SERVICE_ROLE_KEY
   ```

7. **`/api/cron/algorithms/tradovate-poll` is being hit.** Check the
   `alphalog-cron` Fly machine logs:
   ```bash
   flyctl logs -a alphalog-cron | grep tradovate-poll | tail -5
   ```
   Should show `mode=shadow ... scanned=N` lines every minute during
   market hours.

## The flip

```bash
flyctl secrets set DISPATCH_MODE=live -a alphalog-pwa
```

This triggers a rolling restart of the Fly machine (~30-60s). During the
restart, the cron continues to fire — calls during the gap fail loud but
the next cycle picks up `DISPATCH_MODE=live` from `process.env`.

Verify:
```bash
flyctl secrets list -a alphalog-pwa | grep DISPATCH_MODE
# Should show: DISPATCH_MODE  <digest>  <recent-timestamp>

flyctl logs -a alphalog-pwa | grep "DispatchTradovate" | tail -5
# Should show: "live BUY ESM5 x1 placed orderId=..." instead of "shadow ..."
```

## Rollback

If something looks wrong (wrong orders placed, runaway sizing, etc.):

```bash
flyctl secrets set DISPATCH_MODE=shadow -a alphalog-pwa
```

This flips back to shadow within ~30-60s. **Existing open positions on
Tradovate are NOT closed by the flip** — manual close via Tradovate UI or
`POST /api/algorithms/[id]/control` with `{action:'close-all'}` (if
implemented) is required.

Emergency manual halt (kills the cron without waiting for the flip):
```bash
flyctl machine stop -a alphalog-cron
```

## Per-algo pause without flipping the whole app

The dispatcher honors per-algo `status`. Setting an algo to `paused` via
the modal's status badge or:
```sql
UPDATE algorithms SET status = 'paused' WHERE id = '<algo-id>';
```
removes it from the dispatcher's scan (`.in("status", ["live","paper"])`).
Cleaner than flipping the global mode when you want to halt just one.

## When NOT to flip

- During the daily Globex maintenance (17:00–18:00 ET): the cron skips
  anyway (Sprint S), so the flip is a no-op until 18:00 ET.
- Right before an FOMC release, NFP, CPI, or similar event: shadow logs
  during these events give you a feel for how the algo behaves; flip after
  you've seen ≥2 such events without surprises.
- Without watching the first 5 minutes post-flip in real time. If you flip
  and walk away you can't react to wrong orders.

## Smoke after flip

Wait 5 minutes after flipping, then check:

1. **At least one `placed` action in the cron logs.** (If the market is
   open and a Tradovate algo is on paper/live status, you should see one.)
2. **`cme_signals` table:** new rows with `status='executed'` (live order
   placed) instead of `status='skipped'` / `reject_reason='shadow_mode'`.
3. **Tradovate web UI:** the order exists on the right account (paper or
   live as configured) with the SL/TP bracket attached.

If any of those don't match, rollback immediately and inspect the logs.
