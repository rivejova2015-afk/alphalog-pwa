# Task 7 Report: Archivos híbridos (`tradovate-poll`, `bars/tradovate-fetch`)

> Nota: este archivo tenía contenido de un Task 7 de un plan ANTERIOR
> ("Etapa 1a — migrar bots a Postgres propio", bot coinarb) cuya numeración
> de tareas es independiente de este plan nuevo
> (`docs/superpowers/plans/2026-07-13-cme-tradovate-migracion.md`). Ese
> historial ya está preservado en el ledger (`.superpowers/sdd/progress.md`,
> sección "Etapa 1a" al final del archivo) — este reporte lo reemplaza acá
> porque corresponde al Task 7 del plan CME/Tradovate, que es el vigente.

**Status:** DONE
**Commit:** `8865365` — "feat(cme): migra tablas CME/algorithms en los 2 crons híbridos, historical_bars queda en Supabase"
**Branch:** `main` (unchanged, consistent with Tasks 3-6 of this plan)

## Files modified

- `src/app/api/cron/algorithms/tradovate-poll/route.ts`
- `src/app/api/cron/bars/tradovate-fetch/route.ts`
- `src/lib/pg/client.ts` — shim: added `.in()`
- `src/lib/pg/__tests__/client.test.ts` — TDD coverage for `.in()` (incl. empty-array edge case)
- `src/app/api/cron/algorithms/tradovate-poll/__tests__/route.test.ts` — existing mocks updated for the two-client split
- `src/app/api/cron/bars/tradovate-fetch/__tests__/route.test.ts` — same

## What was done

Both files now run with **two data clients side by side**, exactly the
intended end state the brief describes (not a half-finished migration):

- `pg = getPgClient()` — for `algorithms`, `cme_connections`,
  `algo_cme_accounts` (all already in `InScopeTable`).
- `supabaseHistorical = createServiceClient()` — renamed from the old `svc`,
  now explicitly scoped in name and in a doc comment to
  `historical_bars`/`historical_bars_coverage` only (out of scope for this
  entire migration project, 25,111 real rows shared across forex/crypto/futures).

**`tradovate-poll/route.ts`:**
- `latestBarTs()` keeps `historical_bars` on `supabaseHistorical` (param renamed, logic untouched).
- All 4 `svc.from("algorithms").update(...)` calls (no-bars skip, no-fresh-bar
  skip, engine-threw failure, final telemetry update) → `pg.from("algorithms")`.
- The `algorithms` select (`.in('platform',...).in('status',...).is('deleted_at', null)`) → `pg`.
- `runEngineV1()` and `dispatchSignal()` still receive `supabaseHistorical` (a
  real `SupabaseClient`) — both are library code outside this task's file
  scope; they internally touch `historical_bars`, `ml_models`, and (via
  `dispatchTradovate`) `cme_signals`/`cme_connections`/`algo_cme_accounts`
  directly, none of which this task's brief listed for migration. Left
  untouched per the plan's own scope (Task 7 only lists these 2 route files).

**`bars/tradovate-fetch/route.ts`:**
- `ensureFreshToken()` only ever touched `cme_connections` — fully converted to take `pg` instead of a Supabase client.
- `processPair()` only ever touched `historical_bars`/`historical_bars_coverage` — fully converted to take `supabaseHistorical` (renamed from `svc`, otherwise untouched).
- Handler: `cme_connections` select, `algorithms` select (`.in('user_id',...).in('status',...)`), and `algo_cme_accounts` select → all migrated to `pg`.

The `x-cron-secret`/`Authorization: Bearer` auth block at the top of both
handlers is byte-for-byte unchanged — confirmed via `git diff | grep -i
"authorize\|x-cron-secret\|CRON_SECRET\|timingSafeEqual"` returning nothing.

## Shim change: `.in()` — judgment call, flagging clearly

**Not explicitly authorized by this task's brief** (which only says
"mismo método `.select()`/`.update()`/`.eq()`, ya soportados"), but both
files' `algorithms` queries actually use `.in()` (platform/status in
tradovate-poll; user_id/status in bars/tradovate-fetch) and the shim had no
`.in()` before this task — confirmed via `grep`, the codebase test suite,
and Task 2/5/6's own `client.test.ts` history.

Two options existed, same framing as Task 6's `.gte()` decision:

1. **Extend the shim with `.in()`** — mirrors `.eq()` structurally
   (`wheres.push({col, op:"in", val:vals})`), uses postgres.js's native
   `sql\`col IN ${sql(array)}\`` array-interpolation (verified against the
   real Postgres instance, not assumed), plus an explicit `arr.length === 0
   → FALSE` branch since `IN ()` is invalid SQL and Supabase's own `.in()`
   with an empty array matches zero rows (same semantics, not a behavior
   change).
2. **Work around it** — drop `.in()`, fetch a broader row set (e.g. all
   non-deleted algorithms in tradovate-poll, ignoring platform/status; or
   all algorithms regardless of `user_id`/status in bars/tradovate-fetch),
   filter in JS.

Chose option 1. Reasoning: `tradovate-poll` runs every 60 seconds — the
workaround would mean every cron tick fetches the *entire* `algorithms`
table (every platform, every status, every user) instead of the narrow
Tradovate/IBKR + live/paper slice, then filters in JS. Unlike Task 4/5's
"fetch broader + filter in JS" precedent (bounded, on-demand GET endpoints),
this is a permanent per-minute cost increase on a hot-path cron with no
corresponding benefit — the `.in()` addition is a mechanical, semantics-
preserving mirror of `.eq()`, not a design decision, and keeps the exact
same WHERE-level filtering the original Supabase calls had. Same judgment
Task 6 used to justify `.gte()`.

Covered by 2 new tests in `client.test.ts` (both run against the real
Postgres instance, not mocked): `.in()` matching only the listed values, and
`.in()` with an empty array matching zero rows without generating invalid
SQL. Both pass.

## Test coverage

Both route files already had `__tests__/route.test.ts` (an early Glob
search in this task wrongly reported "no files found" — a path-context
issue on my end, caught by falling back to `find` before assuming there was
nothing to update). Both suites mocked `createServiceClient()` as the
single data client; updated each to mock `@/lib/pg/client`'s `getPgClient()`
separately (`pgFromMock`) from `createServiceClient()` (`supabaseFromMock`,
now defaulted to a no-op `historical_bars`/`historical_bars_coverage` stub
since no test asserts on those tables' contents), matching the "mock
`getPgClient()`" precedent documented in the progress ledger for the
earlier Etapa 1a migration's Task 5/6 fix rounds. All assertions that
previously checked `fromMock` for the `algorithms`/`cme_connections`/
`algo_cme_accounts` flow now check `pgFromMock`.

No new test *files* were created — only existing mocks updated to match the
two-client split, consistent with "update whatever test coverage already
exists, don't invent new coverage."

## Verification

- `npx tsc --noEmit` — clean, 0 errors.
- `npx vitest run src/lib/pg/__tests__/client.test.ts` — 9/9 passed (7
  pre-existing + 2 new `.in()` tests), against real Postgres.
- `npx vitest run src/app/api/cron/algorithms/tradovate-poll src/app/api/cron/bars/tradovate-fetch` — 11/11 passed.
- Full suite: `npx vitest run` — **269 test files passed, 3050 tests passed, 0 failed.**
- Confirmed zero leftover test rows in every CME table and in `algorithms`
  (queried directly against lattice-server's Postgres):

  ```
  cme_signals              0
  cme_connections          0
  cme_positions            0
  cme_risk_configs         0
  algo_cme_accounts        0
  cme_equity_snapshots     0
  cme_trades_propfirm      0
  cme_trades_real          0
  algorithms (TEST rows)   0
  ```

- Manually diffed both route files (`git diff`) to confirm the
  `x-cron-secret`/`Authorization: Bearer` validation block at the top of
  each handler is byte-for-byte unchanged.

## Concerns / things worth a second look

- The `.in()` addition to the shim was my own call, not explicitly
  authorized by the brief text (which only mentioned `.select()`/`.update()`/
  `.eq()` as already-supported). Same category of deviation as Task 6's
  `.gte()` addition — believed correct for the reasons above, but flagged
  for review as a deviation from the letter of the instructions.
- `runEngineV1`/`dispatchSignal`/`dispatchTradovate` (in
  `src/lib/engine/...`) still receive the real Supabase `SupabaseClient` and
  internally read/write `cme_signals`, `cme_connections`,
  `algo_cme_accounts`, `ml_models`, and `historical_bars` directly — this is
  genuinely out of this task's file scope (the brief lists only the 2 route
  files), and the plan's Global Constraints explicitly say "sin cambios de
  comportamiento en `dispatchTradovate`... solo cambia el cliente de datos
  que recibe como parámetro" without assigning that rewrite to any task I
  could find in the plan document
  (`docs/superpowers/plans/2026-07-13-cme-tradovate-migracion.md`). Flagging
  this clearly since it means `cme_signals`/`cme_connections`/
  `algo_cme_accounts` writes made *during* a live dispatch (as opposed to
  the cron-level bookkeeping this task did migrate) still go through
  Supabase, not the new Postgres — worth confirming whether a later task in
  this plan is meant to address `src/lib/engine/dispatchers/tradovate.ts`
  and `src/lib/engine/v1/index.ts` specifically.
- Not performed: end-to-end manual invocation of either cron route via HTTP
  (no running Next.js dev server / cron trigger in this environment). All
  verification is via `tsc`, the real-Postgres vitest suite, and manual diff
  review of the auth blocks.

## Fix (gap found during review — dispatch client wiring)

The concern flagged above was confirmed as a real, live gap: `tradovate-poll/route.ts`
was still handing its Supabase client (`supabaseHistorical`) into
`dispatchSignal(...)` → `dispatchTradovate` → `executeSignal`, so the actual
signal-dispatch/execution path — the part of the system that writes
`cme_signals`, `cme_connections`, `algo_cme_accounts`, `cme_trades_propfirm`
during a live or shadow dispatch — was still hitting Supabase under the hood,
even though every other direct call site in these two crons had been
migrated to Postgres. This defeated a good chunk of the point of the
migration for the execution flow specifically.

**What changed:**

- `src/lib/engine/dispatchers/types.ts` — added a new minimal structural
  interface (`DispatchDbClient`, plus its two builder-stage helper interfaces
  `DispatchQueryBuilder`/`DispatchFilterResult`/`DispatchTerminal`) that both
  a real `SupabaseClient` and `getPgClient()`'s return value satisfy
  structurally. Modeled in stages (`.from()` → builder with
  select/insert/update → filter result with `.select()`/`.eq()` + terminal
  `.maybeSingle()`/`.single()`) to mirror how Supabase's own builder types are
  staged — a single flat self-referential interface doesn't typecheck against
  Supabase's real `PostgrestQueryBuilder`/`PostgrestFilterBuilder` split.
  Row/result payloads are intentionally untyped (`any`, with inline
  eslint-disable comments) since Supabase's own client already defaults to
  `SupabaseClient<any, ...>` with no generated Database types wired in — this
  isn't a new looseness, it matches what was implicitly true before.
- `src/lib/engine/dispatchers/tradovate.ts` — `netAccountPosition`,
  `fetchAccountEquity`, and `dispatchTradovate`'s `svc` parameter retyped from
  `SupabaseClient` to `DispatchDbClient`. One real logic addition: ATR/SL-TP
  computation (`computeSlTpTicks` → `loadHistoricalBars`) reads
  `historical_bars`, which stays out of this migration's scope (Supabase-
  only) regardless of what `svc` now represents — so `dispatchTradovate` now
  calls `createServiceClient()` itself to get a dedicated Supabase client for
  that one ATR call, instead of reusing the generalized `svc`.
  `computeSlTpTicks`'s own signature/logic is untouched (still takes a real
  `SupabaseClient`, just sourced differently by its caller).
- `src/lib/cme/order-executor.ts` — `executeSignal`'s `svc` parameter retyped
  from `SupabaseClient` to `DispatchDbClient`. No logic changes.
- `src/lib/engine/dispatchers/ibkr.ts` — `dispatchIbkr`'s `svc` parameter
  retyped to `DispatchDbClient` too. It's a pure stub (no `.from()` calls at
  all), but its signature has to match what `dispatchSignal` (the shared
  router) passes to every platform branch, so the type had to move even
  though the body is untouched.
- `src/lib/engine/dispatchers/index.ts` — `dispatchSignal`'s `svc` parameter
  retyped to `DispatchDbClient`; re-exports `DispatchDbClient` alongside the
  existing `DispatchInput`/`DispatchResult`/`DispatchMode` exports.
- `src/app/api/cron/algorithms/tradovate-poll/route.ts` — the `dispatchSignal(...)`
  call now passes `pg` (the existing `getPgClient()` instance already used
  for the `algorithms` table updates) instead of `supabaseHistorical`.
  `supabaseHistorical` is still used for `latestBarTs()` and the
  `runEngineV1(...)` call only, per the existing (correct) scope boundary.
  Updated two stale comments that described the old (now-wrong) wiring.
- `src/lib/engine/dispatchers/index.test.ts` — `makeSupabaseMock()`'s return
  type (and its `as unknown as ...` cast) changed from `SupabaseClient` to
  `DispatchDbClient`. Pure type-level change (the mock's actual shape is
  unchanged); needed because checking the *real* `SupabaseClient`'s full
  generic surface against the new interface at every one of this file's ~40
  call sites tripped TS2589 ("type instantiation excessively deep") — the
  mock is hand-built and already matches `DispatchDbClient` exactly, so
  there's no reason to force TS through that deep check for a fake object.
- `src/app/api/cron/bars/tradovate-fetch/route.ts` — checked, left
  unchanged: it never calls `dispatchSignal`/`dispatchTradovate`/
  `executeSignal`, so it was never part of this gap.
- `src/app/api/cme/signal/route.ts` — checked, left unchanged: it already
  calls `executeSignal(..., createServiceClient())` with a real Supabase
  client, which still structurally satisfies the new `DispatchDbClient`
  interface. Out of this task's stated scope (only `tradovate-poll` was
  named) and not part of the CME/Tradovate table migration's cron work.

**Why:** `dispatchTradovate`/`executeSignal` are the only place in the whole
migrated flow that actually places orders and writes trade/signal rows during
live dispatch — leaving them on Supabase would have meant the migration was
cosmetically complete (cron bookkeeping moved to Postgres) but functionally
incomplete (the trading side-effects themselves stayed on the old backend).

**Verification:**

```
npx tsc --noEmit
```
→ clean, 0 errors (this was the main risk — narrowing/widening `svc`'s type
incorrectly would have surfaced across every call site; it took three
iterations of the `DispatchDbClient`/`DispatchFilterResult`/`DispatchTerminal`
staging to get a shape both Supabase's real generic builder types and the pg
shim's `QueryBuilder` satisfy without errors).

```
set -a && source .env.local && set +a && npx vitest run
```
→ **269 test files passed, 3050 tests passed, 0 failed** (same file/test
count as the pre-fix baseline recorded above — no new failures, nothing
skipped).

```
npx eslint src/lib/engine/dispatchers/types.ts src/lib/engine/dispatchers/tradovate.ts \
  src/lib/engine/dispatchers/index.ts src/lib/engine/dispatchers/ibkr.ts \
  src/lib/engine/dispatchers/index.test.ts src/lib/cme/order-executor.ts \
  src/app/api/cron/algorithms/tradovate-poll/route.ts
```
→ clean, 0 errors/warnings (the two `any` usages in `types.ts` are covered by
inline `eslint-disable-next-line @typescript-eslint/no-explicit-any` comments
since `src/lib/engine/**` and `src/lib/cme/**` aren't in the eslint config's
"any allowed" glob list).
