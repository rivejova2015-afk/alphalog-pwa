# Sentry coverage audit — server-side console.error gap

> Generated 2026-05-27 from a sweep of `src/app/api/**` and `src/lib/**`.
> Re-run with `grep -rln "console\.error" src/app/api src/lib` to check the
> current count.

## Headline

**383 server-side `console.error` calls don't reach Sentry.** Each is an
error condition that lands in Fly stdout but never appears in the
"Trading Operations Mission Control" dashboard. The bot can lose money
on a silent path failure and the only signal is `flyctl logs`.

## What IS covered

`src/lib/log.ts:logError(name, meta)` forwards to
`captureMessageWithModule(name.toLowerCase(), …)` on the server,
which tags the Sentry event with `module:<name>` so the dashboard
panels group correctly.

Top module tags currently surfaced (sample, top 15 by call site count):

| Tag | Sites |
|---|---|
| Algorithms | 20 |
| Securities | 18 |
| Treasury | 16 |
| WebhookMT | 9 |
| TradeHub | 8 |
| Journal | 7 |
| BacktestJobs | 7 |
| Accounts | 5 |
| TerminalNews | 4 |
| TerminalEvents | 4 |
| SkillApprove | 4 |
| Setups | 4 |
| IVSurface | 4 |
| BotPair | 4 |
| AlgoPaperTrades | 4 |

Total `logError(...)` sites: ~150 (verified via
`grep -rn "logError(" src/ --include="*.ts" | wc -l`).

## What's NOT covered

| Area | Files with console.error | Risk |
|---|---|---|
| `src/app/api/**` | 93 | User-facing 500s, silent webhook drops |
| `src/lib/alphacore/**` | 7 | Offline mutation failures, outbox stalls |
| `src/lib/alphashield/**` | 5 | Logger infra (legitimately self-bootstrapping — accept) |
| `src/lib/bot/**` + `cme/**` + `engine/**` + `backtest/**` | 1 | Mostly covered (only 1 file is the dispatcher's last-resort) |
| `src/lib/business/queries.ts` + `copygroups/mirroring.ts` | 2 | Business-layer compute errors |

## Migration recipe

Replace each `console.error(...)` with `logError("Module", { ... })`:

```ts
// before
catch (err) {
  console.error("[outbox] sync failed:", err);
}

// after
import { logError } from "@/lib/log";

catch (err) {
  logError("Outbox", {
    component: "syncEntry",
    message: err instanceof Error ? err.message : String(err),
  });
}
```

Module-name conventions:
- One CamelCase tag per logical subsystem (matches existing top-15 above).
- Pick from the existing tag set when possible — extra tags fragment the
  dashboard. Add a new tag only for a truly new subsystem.
- Avoid file-path-style tags (`api/algorithms/[id]/route`); they don't
  aggregate well.

## Sites that should stay `console.error`

- **`src/lib/alphashield/logger.ts`** — the logger itself. Forwarding logger
  failures to Sentry creates a loop if Sentry is what failed.
- **`src/lib/sentry.ts`** — same reason. The wrapper is the boot path.
- **Build-time scripts** (`scripts/**`) — these run outside the Sentry
  init window and don't have a DSN. console is correct.

## Suggested first sprint slice

Migrate the 7 `alphacore/**` files first. They're the offline-first
mutations + outbox sync — a silent failure here means a user's edit
appears to succeed locally but never reaches the server. That's the
worst class of bug to find via "user reports their data is gone."

```bash
# Find them:
grep -l "console\.error" src/lib/alphacore/

# After migration verify:
grep -rln "console\.error" src/lib/alphacore/
# Should drop from 7 to 0.
```

Then `src/app/api/**` in order of route popularity — start with the
ones handling webhooks (Postmark inbound, MT5 webhook) since those have
no user UI to surface failures.

## Why not lint-rule this

A blanket "no console.error" ESLint rule would force the legitimate
self-bootstrapping cases (logger, sentry wrapper, scripts) into
suppressions. The cost of the rule (annotations) exceeds the cost of
periodic audits via the grep above.

## Re-audit cadence

Run quarterly:
```bash
echo "Sentry coverage: $(grep -rln 'logError(' src/ --include='*.ts' | wc -l) covered, $(grep -rln 'console\\.error' src/app/api src/lib | wc -l) gap"
```

Target: keep the gap trending down, prioritize new code goes through
`logError`.
