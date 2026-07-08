# Migrar tablas de bots de AlphaLog a Postgres propio — Etapa 1a Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the 16 bot-critical tables (and the code that reads/writes them) off Supabase
Cloud onto a self-hosted plain Postgres database running on `lattice-server`, reachable from
Fly.io over a private Headscale/Tailscale network — without touching Supabase Auth or any
other table.

**Architecture:** Add a small Supabase-compatible query-builder shim
(`src/lib/pg/client.ts`) backed by `postgres.js`, restricted to the 16 in-scope tables. Swap
each call site's `.from(<in-scope-table>)` calls from the real Supabase client to this shim
— everything else in the same files (auth, other tables) keeps using the unchanged Supabase
client. Add a Tailscale sidecar to both Fly.io apps so they can reach the new Postgres over
the existing Headscale network.

**Tech Stack:** `postgres.js` (Postgres client), TypeScript, Next.js API routes, Docker
(Tailscale sidecar), Fly.io secrets.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-07-migrar-bots-a-postgres-propio-design.md`.
- **16 tables in scope, exactly:** `bot_instances`, `bot_accounts`, `bot_commands`,
  `bot_command_status`, `trading_algorithms`, `algorithms`, `trades`, `paper_trades`,
  `algo_paper_trades`, `coinarb_positions`, `coinarb_decisions`, `coinarb_smc_signals`,
  `coinarb_telemetry`, `bot_events`, `bot_skills`, `accounts`. Do not migrate any other
  table (`bots`, `bot_settings_global`, `bot_settings_override` stay on Supabase Cloud —
  they belong to Etapa 1b).
- **Do not touch Supabase Auth.** `supabase.auth.getUser()` / session/cookie handling stays
  exactly as-is everywhere — only the `.from(<in-scope-table>)` data calls move.
- **This project has no test framework configured beyond what already exists** — check
  `package.json` `"scripts"` for a `test` command before assuming one; if none exists for a
  given package, verification is `tsc --noEmit` / `npm run build` plus manual `curl`/script
  checks, matching the pattern used throughout this session's other work. Do not add a new
  test framework as part of this plan.
- **`alphalog-pwa` uses CommonJS** (no `"type": "module"` in `package.json`); **`coinarb`
  uses ES modules** (`"type": "module"`) — write import/require syntax matching each
  project's convention exactly.
- **This is a live paper-trading system** (no real money) — the cutover (Task 8) requires a
  short pause of the MT5 EAs and the Coinarb bot; confirm with the user before executing
  Task 8's cutover steps live.

---

### Task 1: Postgres schema on lattice-server (`alphalog_bots` database)

**Files:**
- Create: `C:\Users\rivej\Documents\lattice-server\data\alphalog\schema.sql`
- Modify: `C:\Users\rivej\Documents\lattice-server\docker-compose.yml` (expose Postgres port
  beyond `127.0.0.1`, since it's currently bound to localhost-only per the project's existing
  pattern of `127.0.0.1:5432:5432` style bindings for services not meant to be LAN-public)

**Interfaces:**
- Produces: a running Postgres database named `alphalog_bots` inside the existing
  `lattice-server-postgres-1` container, reachable at
  `postgresql://alphalog:<password>@100.64.0.1:5432/alphalog_bots` from any Headscale-
  connected device (Fly.io included, once Task 7 connects it). Later tasks (2-6) connect to
  this exact connection string shape.

- [ ] **Step 1: Find the current Postgres port binding**

Run: `grep -n "postgres" C:\Users\rivej\Documents\lattice-server\docker-compose.yml`

Expected: a service block for `lattice-server-postgres-1` (or similarly named) with a
`ports:` entry like `"127.0.0.1:5432:5432"`.

- [ ] **Step 2: Change the binding to be reachable over Headscale**

In `docker-compose.yml`, change the postgres service's port line from
`"127.0.0.1:5432:5432"` to `"0.0.0.0:5432:5432"` (matches the same pattern already used
elsewhere in this project for services that need to be reachable over the Headscale network
— Windows Firewall + the fact the host isn't on the public internet is the existing security
model here, consistent with how the remote panel's port 7334 was exposed earlier this
session).

- [ ] **Step 3: Write the schema file**

Create `C:\Users\rivej\Documents\lattice-server\data\alphalog\schema.sql`:

```sql
-- Esquema de las 16 tablas de bots de AlphaLog, adaptado para Postgres plano
-- (sin RLS, sin extensiones de Supabase). Ver
-- docs/superpowers/specs/2026-07-07-migrar-bots-a-postgres-propio-design.md (repo alphalog-pwa)
-- para el contexto completo.

CREATE DATABASE alphalog_bots;
\c alphalog_bots

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- para gen_random_uuid()

-- Un solo usuario (el dueño de AlphaLog) — reemplaza a auth.users de Supabase.
CREATE TABLE public.users (
  id uuid PRIMARY KEY,
  email text
);
-- Se inserta la fila real (mismo UUID que hoy en Supabase) en el runbook de datos (Task 8),
-- no acá — este schema.sql solo crea estructura.

CREATE TABLE public.bot_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  bot_id uuid NOT NULL,
  account_id text NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX bot_accounts_user_account_uq ON public.bot_accounts (user_id, account_id);

CREATE TABLE public.bot_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_account_id uuid NOT NULL REFERENCES public.bot_accounts(id) ON DELETE CASCADE,
  instance_id text NOT NULL UNIQUE,
  instance_secret text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  last_heartbeat_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.bot_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL,
  command_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  target_scope text NOT NULL DEFAULT 'all',
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.bot_command_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  command_id uuid NOT NULL REFERENCES public.bot_commands(id) ON DELETE CASCADE,
  bot_account_id uuid NOT NULL REFERENCES public.bot_accounts(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'PENDING',
  acked_at timestamptz,
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX bot_command_status_uq ON public.bot_command_status (command_id, bot_account_id);

CREATE TABLE public.bot_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL,
  bot_account_id uuid REFERENCES public.bot_accounts(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.bot_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id),
  instrument text NOT NULL DEFAULT 'XAUUSD',
  skill_type text NOT NULL DEFAULT 'HYBRID'
    CHECK (skill_type IN ('RL_POLICY', 'LLM_RULES', 'HYBRID')),
  environment text NOT NULL DEFAULT 'paper' CHECK (environment IN ('paper', 'live')),
  status text NOT NULL DEFAULT 'learning'
    CHECK (status IN ('learning', 'pending_approval', 'approved', 'rejected', 'frozen')),
  model_blob_path text,
  model_version integer NOT NULL DEFAULT 1,
  epsilon_current decimal(5,4) NOT NULL DEFAULT 0.3,
  performance_before jsonb,
  performance_after jsonb,
  approval_requested_at timestamptz,
  approved_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE public.trading_algorithms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id),
  platform text NOT NULL CHECK (platform IN ('MT4', 'MT5')),
  name text NOT NULL CHECK (name <> ''),
  description text,
  algo_type text NOT NULL CHECK (algo_type IN ('scalping', 'grid_basket', 'arbitrage')),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'paper', 'approved', 'live', 'paused', 'archived')),
  parameters jsonb NOT NULL DEFAULT '{}',
  slot_number integer NOT NULL CHECK (slot_number BETWEEN 1 AND 50),
  sort_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE UNIQUE INDEX idx_trading_algorithms_slot
  ON public.trading_algorithms(user_id, platform, slot_number) WHERE deleted_at IS NULL;

CREATE TABLE public.algorithms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id),
  name text NOT NULL,
  instrument text[] NOT NULL DEFAULT '{}',
  market_type text,
  direction text,
  platform text,
  linked_bot_account_id uuid REFERENCES public.bot_accounts(id) ON DELETE SET NULL,
  lot_size numeric,
  max_trades integer,
  risk_percent numeric,
  parameters jsonb NOT NULL DEFAULT '{}',
  engine_config jsonb NOT NULL DEFAULT '{}',
  scan_config jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'paused',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  category_id uuid NOT NULL,
  account_size numeric,
  current_balance numeric,
  operation_state text,
  phase_status text,
  role text,
  withdrawals_enabled boolean NOT NULL DEFAULT true,
  sort_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE public.trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  symbol text NOT NULL CHECK (length(trim(symbol)) > 0),
  direction text NOT NULL CHECK (length(trim(direction)) > 0),
  status text NOT NULL CHECK (length(trim(status)) > 0),
  entry_date date NOT NULL,
  entry_price numeric NOT NULL CHECK (entry_price >= 0),
  exit_price numeric NOT NULL CHECK (exit_price >= 0),
  stop_loss_price numeric NOT NULL CHECK (stop_loss_price >= 0),
  take_profit_price numeric NOT NULL CHECK (take_profit_price >= 0),
  lots numeric NOT NULL CHECK (lots > 0),
  pnl numeric NOT NULL,
  pnl_percent numeric NOT NULL,
  exit_date date,
  notes text,
  setup_id uuid,
  screenshot_path text,
  is_featured_in_report boolean NOT NULL DEFAULT false,
  sort_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE public.paper_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  symbol text NOT NULL CHECK (length(trim(symbol)) > 0),
  direction text NOT NULL CHECK (length(trim(direction)) > 0),
  status text NOT NULL CHECK (length(trim(status)) > 0),
  entry_date date NOT NULL,
  entry_price numeric NOT NULL CHECK (entry_price >= 0),
  exit_price numeric NOT NULL CHECK (exit_price >= 0),
  stop_loss_price numeric NOT NULL CHECK (stop_loss_price >= 0),
  take_profit_price numeric NOT NULL CHECK (take_profit_price >= 0),
  lots numeric NOT NULL CHECK (lots > 0),
  pnl numeric NOT NULL,
  pnl_percent numeric NOT NULL,
  exit_date date,
  notes text,
  setup_id uuid,
  screenshot_path text,
  is_featured_in_report boolean NOT NULL DEFAULT false,
  sort_index integer NOT NULL DEFAULT 0,
  is_paper boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE public.algo_paper_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  algorithm_id uuid REFERENCES public.trading_algorithms(id) ON DELETE SET NULL,
  symbol text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('BUY', 'SELL')),
  quantity numeric(10,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  entry_price numeric(14,5),
  exit_price numeric(14,5),
  pnl numeric(14,2),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  source text NOT NULL DEFAULT 'signal' CHECK (source IN ('signal', 'webhook', 'manual')),
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.coinarb_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL,
  strategy_id text NOT NULL DEFAULT 'A',
  symbol text NOT NULL,
  direction text NOT NULL,
  base_qty numeric,
  stop_loss_price numeric,
  take_profit_price numeric,
  status text,
  entry_price numeric,
  exit_price numeric,
  smc_zone_type text,
  smc_zone_price numeric,
  arb_gap_pct numeric,
  fear_greed_at_entry integer,
  phase_at_entry text,
  entry_reason jsonb,
  opened_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.coinarb_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL,
  strategy_id text NOT NULL DEFAULT 'A',
  kind text NOT NULL,
  symbol text,
  venue text,
  reason text,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.coinarb_smc_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL,
  symbol text NOT NULL,
  timeframe text NOT NULL,
  signal_type text NOT NULL,
  direction text,
  price numeric,
  strength numeric,
  detected_at timestamptz NOT NULL DEFAULT now(),
  invalidated_at timestamptz,
  meta jsonb DEFAULT '{}'::jsonb,
  strategy_id text NOT NULL DEFAULT 'A',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.coinarb_telemetry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id),
  agent_id uuid NOT NULL,
  strategy_id text NOT NULL DEFAULT 'A',
  ws_coinbase_connected boolean DEFAULT false,
  ws_binance_connected_spot boolean DEFAULT false,
  daily_trades_count integer DEFAULT 0,
  daily_wins integer DEFAULT 0,
  daily_losses integer DEFAULT 0,
  phase_current text DEFAULT '$100',
  risk_pct_current numeric DEFAULT 0.01,
  capital_current numeric,
  smc_bias jsonb,
  fear_greed_index integer,
  paused_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

- [ ] **Step 4: Apply the port binding change and restart Postgres**

```bash
cd /c/Users/rivej/Documents/lattice-server
docker compose up -d --force-recreate lattice-server-postgres-1
```

Expected: container restarts, `docker compose ps` shows it `Up`.

- [ ] **Step 5: Set a dedicated password for a new `alphalog` role and apply the schema**

```bash
cd /c/Users/rivej/Documents/lattice-server
docker compose exec lattice-server-postgres-1 psql -U postgres -c \
  "CREATE ROLE alphalog WITH LOGIN PASSWORD 'CHANGE_ME_STRONG_PASSWORD';"
docker compose exec -T lattice-server-postgres-1 psql -U postgres < data/alphalog/schema.sql
docker compose exec lattice-server-postgres-1 psql -U postgres -d alphalog_bots -c \
  "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO alphalog; GRANT ALL ON SCHEMA public TO alphalog;"
```

Replace `CHANGE_ME_STRONG_PASSWORD` with a real generated password (e.g.
`openssl rand -hex 24`) — do not commit the real password anywhere; it only goes into the Fly
secrets in Task 7.

- [ ] **Step 6: Verify the schema applied**

```bash
docker compose exec lattice-server-postgres-1 psql -U postgres -d alphalog_bots -c "\dt"
```

Expected: 16 tables listed (`users`, `bot_accounts`, `bot_instances`, `bot_commands`,
`bot_command_status`, `bot_events`, `bot_skills`, `trading_algorithms`, `algorithms`,
`accounts`, `trades`, `paper_trades`, `algo_paper_trades`, `coinarb_positions`,
`coinarb_decisions`, `coinarb_smc_signals`, `coinarb_telemetry`).

- [ ] **Step 7: Verify reachability from a Headscale-connected device**

From the Windows PC itself (already on the Headscale network):

```bash
docker compose exec lattice-server-postgres-1 psql -U alphalog -h 100.64.0.1 -d alphalog_bots -c "SELECT 1;"
```

Expected: prompts for the password set in Step 5, then returns `1`. (This confirms the bind
change worked — connecting via the Headscale IP, not `localhost`.)

- [ ] **Step 8: Commit**

```bash
cd /c/Users/rivej/Documents/lattice-server
git add data/alphalog/schema.sql docker-compose.yml
git commit -m "feat(alphalog-migration): esquema Postgres para tablas de bots + expone Postgres via Headscale"
```

---

### Task 2: Supabase-compatible Postgres shim (`src/lib/pg/client.ts`)

**Files:**
- Create: `C:\Users\rivej\Documents\alphalog-pwa\src\lib\pg\client.ts`
- Modify: `C:\Users\rivej\Documents\alphalog-pwa\package.json` (add `postgres` dependency)

**Interfaces:**
- Produces: `getPgClient(): PgTable` factory function, where `PgTable` exposes
  `.from(table: InScopeTable)` returning a query builder with `.select(cols)`,
  `.insert(row | row[])`, `.update(row)`, `.eq(col, val)`, `.is(col, val)`, `.order(col, opts)`,
  `.single()` — enough of the Supabase surface to cover every call site found in the audit.
  `InScopeTable` is a TypeScript union type of exactly the 16 table names, so passing a
  wrong/out-of-scope table name is a compile error, not a runtime surprise.

- [ ] **Step 1: Add the `postgres` dependency**

```bash
cd /c/Users/rivej/Documents/alphalog-pwa
npm install postgres
```

Expected: `package.json` gets a new `"postgres": "^3.x.x"` line in `dependencies`.

- [ ] **Step 2: Write the shim**

Create `src/lib/pg/client.ts`:

```typescript
import postgres from "postgres";

export type InScopeTable =
  | "bot_instances"
  | "bot_accounts"
  | "bot_commands"
  | "bot_command_status"
  | "trading_algorithms"
  | "algorithms"
  | "trades"
  | "paper_trades"
  | "algo_paper_trades"
  | "coinarb_positions"
  | "coinarb_decisions"
  | "coinarb_smc_signals"
  | "coinarb_telemetry"
  | "bot_events"
  | "bot_skills"
  | "accounts";

let sql: ReturnType<typeof postgres> | null = null;

function getSql() {
  if (sql) return sql;
  const url = process.env.ALPHALOG_PG_URL;
  if (!url) throw new Error("Missing ALPHALOG_PG_URL env var");
  sql = postgres(url, { max: 5 });
  return sql;
}

type Row = Record<string, unknown>;

interface PgResult<T> {
  data: T | null;
  error: { message: string } | null;
}

class QueryBuilder {
  private table: InScopeTable;
  private mode: "select" | "insert" | "update" | null = null;
  private selectCols = "*";
  private insertRows: Row[] = [];
  private updateRow: Row = {};
  private wheres: Array<{ col: string; op: "eq" | "is"; val: unknown }> = [];
  private orderCol: string | null = null;
  private orderAsc = true;
  private wantSingle = false;

  constructor(table: InScopeTable) {
    this.table = table;
  }

  select(cols = "*") {
    this.mode = this.mode ?? "select";
    this.selectCols = cols;
    return this;
  }

  insert(rows: Row | Row[]) {
    this.mode = "insert";
    this.insertRows = Array.isArray(rows) ? rows : [rows];
    return this;
  }

  update(row: Row) {
    this.mode = "update";
    this.updateRow = row;
    return this;
  }

  eq(col: string, val: unknown) {
    this.wheres.push({ col, op: "eq", val });
    return this;
  }

  is(col: string, val: unknown) {
    this.wheres.push({ col, op: "is", val });
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this.orderCol = col;
    this.orderAsc = opts?.ascending ?? true;
    return this;
  }

  single() {
    this.wantSingle = true;
    return this;
  }

  private buildWhereFragment(client: ReturnType<typeof postgres>) {
    if (this.wheres.length === 0) return client``;
    const clauses = this.wheres.map((w) => {
      if (w.op === "is") {
        // "is" is only ever used with null in the audited call sites.
        return client`${client(w.col)} IS NULL`;
      }
      return client`${client(w.col)} = ${w.val as never}`;
    });
    return client`WHERE ${clauses.reduce((acc, c, i) => (i === 0 ? c : client`${acc} AND ${c}`))}`;
  }

  async then<T = Row[]>(
    resolve: (result: PgResult<T>) => void,
    reject?: (err: unknown) => void,
  ) {
    try {
      const client = getSql();
      let result: Row[];

      if (this.mode === "insert") {
        result = await client`
          INSERT INTO ${client(this.table)} ${client(this.insertRows)}
          RETURNING ${this.selectCols === "*" ? client`*` : client(this.selectCols.split(","))}
        `;
      } else if (this.mode === "update") {
        const where = this.buildWhereFragment(client);
        result = await client`
          UPDATE ${client(this.table)} SET ${client(this.updateRow)} ${where}
          RETURNING *
        `;
      } else {
        const where = this.buildWhereFragment(client);
        const orderFragment = this.orderCol
          ? client`ORDER BY ${client(this.orderCol)} ${this.orderAsc ? client`ASC` : client`DESC`}`
          : client``;
        const cols = this.selectCols === "*" ? client`*` : client(this.selectCols.split(","));
        result = await client`SELECT ${cols} FROM ${client(this.table)} ${where} ${orderFragment}`;
      }

      if (this.wantSingle) {
        resolve({ data: (result[0] ?? null) as T, error: null });
      } else {
        resolve({ data: result as T, error: null });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      resolve({ data: null, error: { message } });
      reject?.(err);
    }
  }
}

export function getPgClient() {
  return {
    from(table: InScopeTable) {
      return new QueryBuilder(table);
    },
  };
}
```

**Note for the implementer:** the `then()` method is what lets callers `await` a
`QueryBuilder` instance directly (`const { data, error } = await pg.from('trades').select()`)
— this mirrors exactly how the real Supabase client behaves (it's a "thenable", not a
Promise itself), so existing destructuring call-site code (`const { data, error } = await
...`) works unmodified once the client swap happens in Task 4.

- [ ] **Step 3: Manual smoke test**

Create a throwaway test file `scratch-pg-test.mjs` in the repo root (delete after running):

```javascript
import { getPgClient } from "./src/lib/pg/client.ts";
// This won't run directly via node without ts-node; instead verify via the Next.js
// dev server in Task 4's manual test step. Skip this step's file creation — go straight
// to `tsc --noEmit` below, which is the real check for this task.
```

Actually, skip creating that file. Instead just type-check:

```bash
cd /c/Users/rivej/Documents/alphalog-pwa
npx tsc --noEmit
```

Expected: no new errors introduced by `src/lib/pg/client.ts` (pre-existing unrelated errors,
if any, are not this task's concern — note them in your report if you see any, but only fix
ones caused by this new file).

- [ ] **Step 4: Commit**

```bash
git add src/lib/pg/client.ts package.json package-lock.json
git commit -m "feat(alphalog-migration): shim de Postgres compatible con la API de Supabase"
```

---

### Task 3: Environment variable wiring (`ALPHALOG_PG_URL`)

**Files:**
- Modify: `C:\Users\rivej\Documents\alphalog-pwa\.env.example`

**Interfaces:**
- Consumes: nothing.
- Produces: documents `ALPHALOG_PG_URL` as an expected env var (actual value goes into Fly
  secrets in Task 7, and into a local `.env.local` for development — never committed).

- [ ] **Step 1: Document the new env var**

In `.env.example`, add a new line near the existing Supabase env var block:

```
# Postgres propio (self-hosted, para las tablas de bots — ver Etapa 1a de la migracion)
ALPHALOG_PG_URL=postgresql://alphalog:CHANGE_ME@100.64.0.1:5432/alphalog_bots
```

- [ ] **Step 2: Add the same value to your local `.env.local`** (not committed — this repo's
`.gitignore` already excludes `.env.local`)

```
ALPHALOG_PG_URL=postgresql://alphalog:<la password real de Task 1 Step 5>@100.64.0.1:5432/alphalog_bots
```

(You need to be connected to the Headscale network from your dev machine for this to work
locally — if developing from a machine not on the Headscale network, use the LAN IP of the
lattice-server PC instead, temporarily, for local dev only.)

- [ ] **Step 3: Commit** (only `.env.example`, never `.env.local`)

```bash
git add .env.example
git commit -m "docs(alphalog-migration): documentar ALPHALOG_PG_URL"
```

---

### Task 4: Rewire server-side call sites (batch 1 — webhooks, bot-ops cron, dashboard)

**Files:**
- Modify: `src/app/api/webhooks/mt5/route.ts`
- Modify: `src/app/api/webhooks/telemetry/route.ts`
- Modify: `src/app/api/bot/pair/route.ts`
- Modify: `src/app/api/dashboard/command-center/route.ts`
- Modify: `src/app/api/ops/cron/bot-auto-recovery/route.ts`
- Modify: `src/app/api/ops/cron/bot-daily-verify/route.ts`
- Modify: `src/app/api/ops/cron/bot-slo-monitor/route.ts`
- Modify: `src/app/api/ops/cron/bot-heartbeat-monitor/route.ts`
- Modify: `src/lib/bot/skills/skill-manager.ts`

**Interfaces:**
- Consumes: `getPgClient()` from `src/lib/pg/client.ts` (Task 2).

- [ ] **Step 1: Read each file and identify every `.from(<table>)` call touching an
in-scope table**

Run, for each file in this task's list:

```bash
grep -n "\.from(" src/app/api/webhooks/mt5/route.ts
```

(repeat for each file above). For every match where the table name is one of the 16
in-scope tables, that call site needs the client swap in Step 2. Any `.from(...)` call on a
table NOT in the 16-table list (e.g. `bots`, `bot_settings_global`) or any `.auth.*` call
stays completely untouched.

- [ ] **Step 2: Swap the client for in-scope calls**

For each identified call site, the pattern is:

**Before** (example shape — actual variable name may be `supabase` or similar):
```typescript
import { createClient } from "@/lib/supabase/server";
// ...
const supabase = await createClient();
const { data, error } = await supabase.from("bot_instances").select("*").eq("id", id);
```

**After:**
```typescript
import { createClient } from "@/lib/supabase/server"; // kept, for auth/other tables in this file
import { getPgClient } from "@/lib/pg/client";
// ...
const supabase = await createClient(); // unchanged — still used for auth in this file
const pg = getPgClient();
const { data, error } = await pg.from("bot_instances").select("*").eq("id", id);
```

If a file's in-scope calls are the ONLY Supabase calls in that file (no auth, no other-table
reads), the `createClient()` import/call can be removed entirely for that file — check this
per-file rather than assuming.

- [ ] **Step 3: Type-check after each file**

```bash
npx tsc --noEmit
```

Expected: no errors introduced. Fix any type mismatches (e.g. a `.select()` column list that
doesn't match what the shim expects — the shim's `select(cols: string)` takes a comma-
separated string exactly like Supabase's, so this should be a drop-in swap).

- [ ] **Step 4: Manual verification per route**

For `src/app/api/webhooks/mt5/route.ts` specifically (the most safety-critical one — this is
what live MT5 EAs hit), start the dev server and send a test webhook:

```bash
npm run dev
```

In another terminal, once the server is up:

```bash
curl -s -X POST http://localhost:3000/api/webhooks/mt5 \
  -H "Content-Type: application/json" \
  -d '{"instance_id":"test","signature":"invalid"}'
```

Expected: a `401` or validation error response (NOT a 500 crash) — confirms the route loads
and the Postgres connection doesn't throw at import time. A full successful webhook test
requires a real paired bot instance and valid HMAC signature, which is covered in Task 8's
end-to-end cutover verification, not here.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/webhooks/mt5/route.ts src/app/api/webhooks/telemetry/route.ts \
        src/app/api/bot/pair/route.ts src/app/api/dashboard/command-center/route.ts \
        src/app/api/ops/cron/bot-auto-recovery/route.ts \
        src/app/api/ops/cron/bot-daily-verify/route.ts \
        src/app/api/ops/cron/bot-slo-monitor/route.ts \
        src/app/api/ops/cron/bot-heartbeat-monitor/route.ts \
        src/lib/bot/skills/skill-manager.ts
git commit -m "feat(alphalog-migration): migrar rutas de webhooks/ops-cron al Postgres propio"
```

---

### Task 5: Rewire server-side call sites (batch 2 — treasury, coinarb stats, quality gates)

**Files:**
- Modify: `src/app/api/treasury/payouts/create/route.ts`
- Modify: `src/app/api/treasury/payouts/preview/route.ts`
- Modify: `src/app/api/treasury/export/route.ts`
- Modify: `src/app/api/treasury/calendar-events/route.ts`
- Modify: `src/app/api/coinarb/stats/pnl/route.ts`
- Modify: `src/app/api/coinarb/stats/correlation/route.ts`
- Modify: `src/app/api/coinarb/stats/drawdown/route.ts`
- Modify: `src/app/api/coinarb/stats/exposure-heatmap/route.ts`
- Modify: `src/app/api/coinarb/stats/regime-history/route.ts`
- Modify: `src/app/api/coinarb/decisions/route.ts`
- Modify: `src/app/api/coinarb/decisions/skip-reasons/route.ts`
- Modify: `src/app/api/coinarb/positions/route.ts`
- Modify: `src/app/api/coinarb/telemetry/route.ts`
- Modify: `src/app/api/cron/business/alerts/route.ts`
- Modify: `src/app/api/cron/algorithms/paper-review/route.ts`
- Modify: `src/app/api/ops/cron/coinarb-heartbeat/route.ts`
- Modify: `src/lib/treasury/queries.ts`
- Modify: `src/lib/dashboard/queries.ts`
- Modify: `src/lib/bot/arbitrage/pair-monitor.ts`
- Modify: `src/lib/bot/arbitrage/risk-guard.ts`
- Modify: `src/lib/quality-gates/runner.ts`

**Interfaces:**
- Consumes: `getPgClient()` from `src/lib/pg/client.ts` (Task 2).

**Important:** `src/app/api/treasury/calendar-events/route.ts` reads/writes
`treasury_calendar_events` (NOT in scope — stays on Supabase) but ALSO reads `accounts` (IN
scope, per the audit's example showing `.from('accounts').select('id').eq('id',
account_id).eq('user_id', user.id)` for ownership verification). This file needs a MIXED
swap: the `accounts` read moves to the pg client, the `treasury_calendar_events` read/write
stays on Supabase. Apply the same "per-call-site" judgment to every file in this task — do
not swap a whole file just because ONE table in it is in scope.

- [ ] **Step 1: Repeat Task 4's Step 1 process (grep + identify) for every file in this
task's list**

- [ ] **Step 2: Repeat Task 4's Step 2 swap pattern for every in-scope call site found**,
leaving out-of-scope table calls (`treasury_calendar_events`, and anything else not in the
16-table list) untouched in the same files.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors introduced.

- [ ] **Step 4: Manual verification**

```bash
npm run dev
```

```bash
curl -s http://localhost:3000/api/coinarb/positions
```

Expected: this route requires auth (per the pattern in Task 7 of the audit) — a `401`
Unauthorized response (not a 500) confirms the route loads and the Postgres import doesn't
throw. Full data verification happens in Task 8.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/treasury/ src/app/api/coinarb/ src/app/api/cron/business/alerts/route.ts \
        src/app/api/cron/algorithms/paper-review/route.ts \
        src/app/api/ops/cron/coinarb-heartbeat/route.ts \
        src/lib/treasury/queries.ts src/lib/dashboard/queries.ts \
        src/lib/bot/arbitrage/pair-monitor.ts src/lib/bot/arbitrage/risk-guard.ts \
        src/lib/quality-gates/runner.ts
git commit -m "feat(alphalog-migration): migrar rutas de tesoreria/coinarb-stats/quality-gates al Postgres propio"
```

---

### Task 6: 3 new API routes replacing direct browser Supabase calls

**Files:**
- Create: `src/app/api/bot-control/command/route.ts`
- Create: `src/app/api/bot-control/command-status/route.ts`
- Create: `src/app/api/bot-control/algorithms/route.ts`
- Modify: `src/components/bot-control/BotControlWorkspace.client.tsx`
- Modify: `src/components/intelligence/algorithms/NewStrategyWizard.client.tsx`

**Interfaces:**
- Consumes: `createClient()` from `@/lib/supabase/server` (for auth only — checking who's
  logged in), `getPgClient()` from `@/lib/pg/client.ts` (for the actual writes).
- Produces: `POST /api/bot-control/command` (body: `{botId, commandType, targetAccountIds?,
  payload?}` → creates a `bot_commands` row + matching `bot_command_status` rows, returns
  `{id}`), `POST /api/bot-control/algorithms` (body: matches `NewStrategyWizard`'s existing
  insert payload shape exactly → creates an `algorithms` row, returns `{id}`).

- [ ] **Step 1: Write `src/app/api/bot-control/command/route.ts`**

This combines what `BotControlWorkspace.client.tsx`'s `createCommand()` currently does
directly (insert into `bot_commands`, then insert matching rows into `bot_command_status`)
into one server-side route:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPgClient } from "@/lib/pg/client";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { botId, commandType, targetAccountIds, payload } = body as {
    botId: string;
    commandType: string;
    targetAccountIds?: string[];
    payload?: Record<string, unknown>;
  };

  if (!botId || !commandType) {
    return NextResponse.json(
      { error: "Missing required fields: botId, commandType" },
      { status: 400 },
    );
  }

  const pg = getPgClient();

  const { data: command, error: commandError } = await pg
    .from("bot_commands")
    .insert({
      bot_id: botId,
      command_type: commandType,
      payload: payload ?? {},
      target_scope: targetAccountIds ? "accounts" : "all",
      created_by: user.id,
      status: "PENDING",
    })
    .select("id")
    .single();

  if (commandError || !command) {
    return NextResponse.json(
      { error: commandError?.message ?? "Failed to create command" },
      { status: 500 },
    );
  }

  const targetIds = targetAccountIds ?? [];
  if (targetIds.length > 0) {
    const statusRows = targetIds.map((accountId) => ({
      command_id: (command as { id: string }).id,
      bot_account_id: accountId,
      status: "PENDING",
    }));
    const { error: statusError } = await pg.from("bot_command_status").insert(statusRows);
    if (statusError) {
      return NextResponse.json({ error: statusError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ id: (command as { id: string }).id });
}
```

**Note:** the original client code computed `targetIds` as
`targetAccountIds || accountsForBot.map((account) => account.id)` when no explicit target was
given (i.e., it defaulted to ALL accounts for that bot, not an empty list). Since the account
list for a bot isn't known to this route without an extra query, change the frontend
(`BotControlWorkspace.client.tsx`, Step 3 below) to always pass `targetAccountIds` explicitly
computed client-side from data it already has in memory — the route itself stays simple and
doesn't need to look up `accountsForBot`.

- [ ] **Step 2: Write `src/app/api/bot-control/algorithms/route.ts`**

Mirrors `NewStrategyWizard.client.tsx`'s existing insert payload shape exactly:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPgClient } from "@/lib/pg/client";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    name,
    instrument,
    marketType,
    direction,
    platform,
    linkedBotAccountId,
    lotSize,
    maxTrades,
    riskPercent,
    parameters,
    engineConfig,
    scanConfig,
  } = body as {
    name: string;
    instrument: string[];
    marketType: string;
    direction: string;
    platform: string;
    linkedBotAccountId: string | null;
    lotSize: number;
    maxTrades: number;
    riskPercent: number;
    parameters: Record<string, unknown>;
    engineConfig: Record<string, unknown>;
    scanConfig: Record<string, unknown>;
  };

  if (!name || !name.trim()) {
    return NextResponse.json({ error: "Missing required field: name" }, { status: 400 });
  }

  const pg = getPgClient();

  const { data: created, error } = await pg
    .from("algorithms")
    .insert({
      user_id: user.id,
      name: name.trim(),
      instrument,
      market_type: marketType,
      direction,
      platform,
      linked_bot_account_id: marketType === "forex" ? linkedBotAccountId ?? null : null,
      lot_size: lotSize,
      max_trades: maxTrades,
      risk_percent: riskPercent,
      parameters,
      engine_config: engineConfig,
      scan_config: scanConfig ?? {},
      status: "paused",
    })
    .select("id")
    .single();

  if (error || !created) {
    return NextResponse.json({ error: error?.message ?? "Failed to create algorithm" }, { status: 500 });
  }

  return NextResponse.json({ id: (created as { id: string }).id });
}
```

**Note:** the original code also handled a `latencyArbCfg` / `arbitrage_latency_pairs` insert
for a `isLatencyArb` case — `arbitrage_latency_pairs` is NOT one of the 16 in-scope tables
(it wasn't in the audit's table list), so it stays on Supabase. If the implementer finds this
case is actually exercised in current usage, keep that specific insert going through the
original `createClient()`-based Supabase call in the frontend (do not route it through this
new endpoint) — flag this as a concern in the task report rather than guessing whether it's
still needed.

- [ ] **Step 3: Update `BotControlWorkspace.client.tsx`'s `createCommand()`**

Replace the function body (the exact code shown in the audit, lines ~408-453) with:

```typescript
const createCommand = async (commandType: string, targetAccountIds?: string[], payload: Record<string, unknown> = {}) => {
  if (!selectedBotId) return;

  setLoading(true);
  setError(null);
  try {
    const res = await fetch("/api/bot-control/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        botId: selectedBotId,
        commandType,
        targetAccountIds: targetAccountIds ?? accountsForBot.map((account) => account.id),
        payload,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }

    await loadData();
  } catch (err) {
    logError("BotControlWorkspace", { component: "botcontrolworkspace", message: "[BotControl] createCommand error", error: err instanceof Error ? err.message : String(err) });
    setError("No se pudo enviar el comando.");
  } finally {
    setLoading(false);
  }
};
```

This removes the direct `supabase.from("bot_commands")`/`.from("bot_command_status")` calls
and the `supabase.auth.getUser()` call from this function (the new route handles auth
server-side) — the `supabase` client import in this file may still be needed for OTHER
functions in the same component (check before removing the import entirely).

- [ ] **Step 4: Update `NewStrategyWizard.client.tsx`'s save handler**

Replace the `supabase.from('algorithms').insert(...)` block (audit lines ~1001-1017) with:

```typescript
const res = await fetch("/api/bot-control/algorithms", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: name.trim(),
    instrument: instruments,
    marketType,
    direction: dbDirection,
    platform: resolvedPlatform,
    linkedBotAccountId: marketType === 'forex' ? (botAccountId || null) : null,
    lotSize,
    maxTrades,
    riskPercent,
    parameters,
    engineConfig,
    scanConfig: {},
  }),
});

if (!res.ok) {
  const body = await res.json().catch(() => ({ error: res.statusText }));
  toast.error(body.error ?? "Failed to create algorithm");
  return;
}

const created = await res.json();
```

Leave the subsequent `isLatencyArb` block (which inserts into `arbitrage_latency_pairs`, an
out-of-scope table) exactly as-is — it still calls Supabase directly, unchanged, using
`created.id` from the response above the same way it used `created?.id` before.

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Manual verification**

```bash
npm run dev
```

Log in to the app in a browser (existing Supabase Auth login, unchanged), navigate to the
bot control UI, and try pausing/resuming a bot. Confirm in the Network tab that the request
goes to `/api/bot-control/command` (not directly to Supabase), and check via `psql` on
lattice-server that a row appeared in `alphalog_bots.bot_commands`:

```bash
docker compose exec lattice-server-postgres-1 psql -U alphalog -d alphalog_bots \
  -c "SELECT id, command_type, status, created_at FROM bot_commands ORDER BY created_at DESC LIMIT 5;"
```

- [ ] **Step 7: Commit**

```bash
git add src/app/api/bot-control/ src/components/bot-control/BotControlWorkspace.client.tsx \
        src/components/intelligence/algorithms/NewStrategyWizard.client.tsx
git commit -m "feat(alphalog-migration): rutas API nuevas para las 3 mutaciones de UI que tocan tablas migradas"
```

---

### Task 7: Coinarb bot — swap Supabase client for Postgres

**Files:**
- Create: `C:\Users\rivej\Documents\alphalog-pwa\coinarb\src\pg-client.ts`
- Modify: `coinarb/src/trading/spot-positions.ts`
- Modify: `coinarb/src/ops/decision-logger.ts`
- Modify: `coinarb/src/ops/smc-signal-persist.ts`
- Modify: `coinarb/src/core/loop.ts`
- Modify: `coinarb/src/core/config.ts`
- Modify: `coinarb/src/ops/command-poller.ts`
- Modify: `coinarb/package.json` (add `postgres` dependency)

**Interfaces:**
- Produces: `getPg(): ReturnType<typeof postgres>` — the coinarb bot's calls are simpler
  (mostly single-table inserts/selects, per the audit), so this uses the raw `postgres.js`
  tagged-template client directly rather than a Supabase-compatible shim (no need for the
  chainable builder here — it would just add indirection for straight-line insert calls).

- [ ] **Step 1: Add the `postgres` dependency**

```bash
cd /c/Users/rivej/Documents/alphalog-pwa/coinarb
npm install postgres
```

- [ ] **Step 2: Write `coinarb/src/pg-client.ts`** (note: `coinarb` uses ES modules —
`"type": "module"` — so use `import`/`export`, not `require`)

```typescript
import postgres from 'postgres';

let client: ReturnType<typeof postgres> | null = null;

export function getPg() {
  if (client) return client;

  const url = process.env.ALPHALOG_PG_URL;
  if (!url) throw new Error('Missing ALPHALOG_PG_URL');

  client = postgres(url, { max: 5 });
  return client;
}
```

- [ ] **Step 3: Rewire `coinarb/src/trading/spot-positions.ts`**

The audited `openPosition()` function currently does:
```typescript
const { data: pos, error } = await supabase
  .from('coinarb_positions')
  .insert({
    user_id: userId,
    agent_id: COINARB_AGENT_ID,
    strategy_id: strategyId,
    // ... more fields
```

Change the import from `import { getSupabase } from '../supabase.js';` to
`import { getPg } from '../pg-client.js';`, and change the call site from the Supabase
chainable style to a tagged-template insert. Since this file's exact full field list wasn't
captured in the audit beyond the first few fields shown, the implementer must open the file,
read the COMPLETE object passed to `.insert({...})`, and translate it to:

```typescript
const pg = getPg();
const [pos] = await pg`
  INSERT INTO coinarb_positions ${pg({
    user_id: userId,
    agent_id: COINARB_AGENT_ID,
    strategy_id: strategyId,
    // ...(keep every other field from the original object literal, unchanged)
  })}
  RETURNING *
`;
```

(`postgres.js`'s `pg({...})` helper turns a plain object into an `INSERT ... (cols) VALUES
(...)` fragment — this is the standard, documented way to do dynamic-column inserts with this
library.) Remove any `if (error) throw error;`-style error handling that assumed Supabase's
`{data, error}` shape — with `postgres.js`, a failed query throws directly, so wrap the call
in a `try/catch` only if the surrounding function already expects to catch and handle
insertion failures (check the surrounding code before deciding).

- [ ] **Step 4: Rewire `coinarb/src/ops/decision-logger.ts`**

Same pattern as Step 3. The audited code:
```typescript
const supabase = getSupabase();
const { error } = await supabase.from('coinarb_decisions').insert({
  user_id: row.userId,
  agent_id: row.agentId,
  strategy_id: row.strategyId ?? 'A',
  kind: row.kind,
  symbol: row.symbol ?? null,
  venue: row.venue ?? null,
  reason: row.reason,
  meta: row.meta ?? {},
  created_at: new Date().toISOString(),
});
```

Becomes:
```typescript
const pg = getPg();
await pg`
  INSERT INTO coinarb_decisions ${pg({
    user_id: row.userId,
    agent_id: row.agentId,
    strategy_id: row.strategyId ?? 'A',
    kind: row.kind,
    symbol: row.symbol ?? null,
    venue: row.venue ?? null,
    reason: row.reason,
    meta: row.meta ?? {},
    created_at: new Date().toISOString(),
  })}
`;
```

- [ ] **Step 5: Rewire `coinarb/src/ops/smc-signal-persist.ts`**

Audited code: `const { error } = await supabase.from('coinarb_smc_signals').insert(row);`
becomes: `await getPg()\`INSERT INTO coinarb_smc_signals ${getPg()(row)}\`;` — read the full
file first to confirm `row`'s exact shape matches the `coinarb_smc_signals` schema from
Task 1 (it should, since this table wasn't altered beyond what's already in the schema).

- [ ] **Step 6: Rewire `coinarb/src/core/loop.ts`, `coinarb/src/core/config.ts`,
`coinarb/src/ops/command-poller.ts`**

These were flagged by the audit as touching `coinarb_positions`, `coinarb_decisions`,
`coinarb_telemetry`, `coinarb_agents` (NOT in the 16-table list — leave any `coinarb_agents`
calls on Supabase, unchanged), `trading_algorithms`, `bot_accounts`, `bot_commands`,
`bot_command_status` but their exact call shapes weren't captured in the audit report. The
implementer must open each file, find every `.from(<in-scope-table>)` call (grep for
`.from('bot_` and `.from('coinarb_` and `.from('trading_algorithms'` in each file), and apply
the same `pg\`INSERT/SELECT/UPDATE ...\`` translation pattern shown in Steps 3-5. For
`command-poller.ts` specifically (reads `bot_commands`/`bot_command_status` to know what to
do), a `SELECT` translates as:

```typescript
const pending = await getPg()`
  SELECT * FROM bot_command_status WHERE status = ${'PENDING'} AND bot_account_id = ${accountId}
`;
```

- [ ] **Step 7: Build check**

```bash
cd /c/Users/rivej/Documents/alphalog-pwa/coinarb
npm run build
```

Expected: TypeScript compiles with no errors.

- [ ] **Step 8: Commit**

```bash
git add src/pg-client.ts src/trading/spot-positions.ts src/ops/decision-logger.ts \
        src/ops/smc-signal-persist.ts src/core/loop.ts src/core/config.ts \
        src/ops/command-poller.ts package.json package-lock.json
git commit -m "feat(alphalog-migration): bot coinarb usa Postgres propio en vez de Supabase"
```

---

### Task 8: Tailscale sidecar for Fly.io (both apps)

**Files:**
- Modify: `C:\Users\rivej\Documents\alphalog-pwa\Dockerfile`
- Create: `C:\Users\rivej\Documents\alphalog-pwa\scripts\start-with-tailscale.sh`
- Modify: `C:\Users\rivej\Documents\alphalog-pwa\coinarb\Dockerfile`
- Create: `C:\Users\rivej\Documents\alphalog-pwa\coinarb\scripts\start-with-tailscale.sh`

**Interfaces:**
- Produces: both Fly.io machines join the Headscale network on boot (using a preauth key
  passed as a Fly secret) before starting the actual app process, so `100.64.0.1` (the
  lattice-server Postgres) is reachable from both.

- [ ] **Step 1: Write the entrypoint script for `alphalog-pwa`**

Create `scripts/start-with-tailscale.sh`:

```bash
#!/bin/sh
set -e

# Arranca tailscaled en background y se une a la red Headscale.
tailscaled --tun=userspace-networking --socks5-server=localhost:1055 &
sleep 2
tailscale up --login-server="${HEADSCALE_URL}" --authkey="${HEADSCALE_AUTHKEY}" --hostname=alphalog-pwa

# Arranca la app Next.js (comando original del Dockerfile).
exec node server.js
```

- [ ] **Step 2: Modify `alphalog-pwa/Dockerfile`**

Add Tailscale installation and switch the `CMD` to use the new entrypoint. Insert this block
right after the existing `FROM node:24-slim AS runner` / `WORKDIR /app` lines (before the
`ENV` block):

```dockerfile
# Tailscale (sidecar): conecta el contenedor a la red Headscale propia antes de arrancar la app.
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
    && curl -fsSL https://pkgs.tailscale.com/stable/debian/bookworm.noarmor.gpg -o /usr/share/keyrings/tailscale-archive-keyring.gpg \
    && curl -fsSL https://pkgs.tailscale.com/stable/debian/bookworm.tailscale-keyring.list -o /etc/apt/sources.list.d/tailscale.list \
    && apt-get update && apt-get install -y tailscale \
    && rm -rf /var/lib/apt/lists/*
```

Then replace the final `CMD ["node", "server.js"]` line with:

```dockerfile
COPY --chown=nextjs:nodejs scripts/start-with-tailscale.sh /app/start.sh
RUN chmod +x /app/start.sh
CMD ["/app/start.sh"]
```

**Note:** the existing Dockerfile runs as `USER nextjs` (non-root) — `tailscaled` normally
needs elevated capabilities for networking. Since this uses `--tun=userspace-networking`
(pure userspace TUN, no kernel networking privileges required), it can run as a non-root
user; if the implementer hits a permissions error at runtime, escalate this as a concern
rather than adding `USER root` (which would be a real security regression for this
container) — the userspace-networking flag is specifically chosen to avoid needing that.

- [ ] **Step 3: Repeat for `coinarb/Dockerfile`**

Create `coinarb/scripts/start-with-tailscale.sh`:

```bash
#!/bin/sh
set -e

tailscaled --tun=userspace-networking --socks5-server=localhost:1055 &
sleep 2
tailscale up --login-server="${HEADSCALE_URL}" --authkey="${HEADSCALE_AUTHKEY}" --hostname=coinarb-50x

exec node dist/core/index.js
```

In `coinarb/Dockerfile`, add the same `apt-get install tailscale` block after
`FROM node:22-slim` in the final stage (not the builder stage), and replace
`CMD ["node", "dist/core/index.js"]` with:

```dockerfile
COPY scripts/start-with-tailscale.sh /app/start.sh
RUN chmod +x /app/start.sh
CMD ["/app/start.sh"]
```

- [ ] **Step 4: Generate a Headscale preauth key for these two machines**

On lattice-server (already has the `headscale/` kit deployed on the VPS from earlier this
session):

```bash
ssh root@49.12.224.9 "cd ~/headscale && docker compose exec headscale headscale preauthkeys create --user rivej --reusable --expiration 720h"
```

(720h = 30 days — reusable since both `alphalog-pwa` and the coinarb bot will use the same
key to join.)

- [ ] **Step 5: Set Fly secrets for both apps**

```bash
cd /c/Users/rivej/Documents/alphalog-pwa
fly secrets set HEADSCALE_URL="https://vpn.alphalog.io" HEADSCALE_AUTHKEY="<key from Step 4>" ALPHALOG_PG_URL="postgresql://alphalog:<password from Task 1 Step 5>@100.64.0.1:5432/alphalog_bots" --app alphalog-pwa

cd coinarb
fly secrets set HEADSCALE_URL="https://vpn.alphalog.io" HEADSCALE_AUTHKEY="<key from Step 4>" ALPHALOG_PG_URL="postgresql://alphalog:<password from Task 1 Step 5>@100.64.0.1:5432/alphalog_bots" --app coinarb-50x
```

- [ ] **Step 6: Deploy and verify Tailscale connects**

```bash
cd /c/Users/rivej/Documents/alphalog-pwa
fly deploy --app alphalog-pwa
```

Then check the Headscale server sees the new node:

```bash
ssh root@49.12.224.9 "cd ~/headscale && docker compose exec headscale headscale nodes list"
```

Expected: a new node named `alphalog-pwa` appears, status `online`. Repeat `fly deploy` for
`coinarb-50x` and confirm it appears too.

- [ ] **Step 7: Commit**

```bash
git add Dockerfile scripts/start-with-tailscale.sh coinarb/Dockerfile coinarb/scripts/start-with-tailscale.sh
git commit -m "feat(alphalog-migration): sidecar de Tailscale en ambos Fly.io apps"
```

---

### Task 9: Data migration + cutover runbook

**Files:** none (operational task, no code changes)

**Interfaces:** none — this is the live cutover.

- [ ] **Step 1: Confirm with the user before proceeding** — this step pauses live (paper)
trading bots. Do not execute Steps 2+ without explicit go-ahead in the current conversation,
even if this task file is being run non-interactively — post a message asking for
confirmation and wait.

- [ ] **Step 2: Full backup of the 16 tables from Supabase Cloud**

```bash
pg_dump "$SUPABASE_CLOUD_DB_URL" \
  --table=bot_instances --table=bot_accounts --table=bot_commands --table=bot_command_status \
  --table=trading_algorithms --table=algorithms --table=trades --table=paper_trades \
  --table=algo_paper_trades --table=coinarb_positions --table=coinarb_decisions \
  --table=coinarb_smc_signals --table=coinarb_telemetry --table=bot_events --table=bot_skills \
  --table=accounts \
  --file=alphalog-bots-backup-$(date +%Y%m%d).sql
```

(`SUPABASE_CLOUD_DB_URL` is the direct Postgres connection string for the Supabase Cloud
project — found in the Supabase dashboard under Project Settings → Database → Connection
string. Do not commit this file or the connection string anywhere; keep the backup file
locally.)

- [ ] **Step 3: Insert the real user row into the new `public.users` table**

```bash
docker compose exec lattice-server-postgres-1 psql -U alphalog -d alphalog_bots -c \
  "INSERT INTO public.users (id, email) VALUES ('<the real UUID from Supabase auth.users>', '<email>');"
```

(Get the real UUID/email by querying Supabase Cloud: `SELECT id, email FROM auth.users;`)

- [ ] **Step 4: Data-only dump and restore**

```bash
pg_dump "$SUPABASE_CLOUD_DB_URL" --data-only \
  --table=bot_instances --table=bot_accounts --table=bot_commands --table=bot_command_status \
  --table=trading_algorithms --table=algorithms --table=trades --table=paper_trades \
  --table=algo_paper_trades --table=coinarb_positions --table=coinarb_decisions \
  --table=coinarb_smc_signals --table=coinarb_telemetry --table=bot_events --table=bot_skills \
  --table=accounts \
  --file=alphalog-bots-data-$(date +%Y%m%d).sql

# Copiar el archivo a lattice-server y restaurarlo ahí:
docker compose exec -T lattice-server-postgres-1 psql -U alphalog -d alphalog_bots \
  < alphalog-bots-data-$(date +%Y%m%d).sql
```

Expected: no errors (there may be warnings about `auth.users` FK references in the dumped
data if `pg_dump` included the raw `auth.users(id)` FK constraint text — if so, the
implementer needs to strip the `REFERENCES auth.users` clause from the dumped `ALTER TABLE
... ADD CONSTRAINT` statements before restoring, since the schema in Task 1 already defines
the FK against `public.users` instead).

- [ ] **Step 5: Verify row counts match**

For each of the 16 tables, compare:

```bash
psql "$SUPABASE_CLOUD_DB_URL" -c "SELECT count(*) FROM trades;"
docker compose exec lattice-server-postgres-1 psql -U alphalog -d alphalog_bots -c "SELECT count(*) FROM trades;"
```

(repeat for all 16 tables) — counts must match exactly before proceeding.

- [ ] **Step 6: Pause the bots**

- MT5 EAs: log into the MT5 terminal(s) running `GoldRangeBasketR` and `AlphaLogTelemetry`
  and disable auto-trading (or detach the EAs) temporarily.
- Coinarb: `fly machine list --app coinarb-50x` then `fly machine stop <machine-id>`.

- [ ] **Step 7: Deploy the migrated code** (Tasks 2-8's changes, if not already deployed)

```bash
cd /c/Users/rivej/Documents/alphalog-pwa
fly deploy --app alphalog-pwa
cd coinarb
fly deploy --app coinarb-50x
```

- [ ] **Step 8: Verify connectivity end-to-end**

```bash
ssh root@49.12.224.9 "cd ~/headscale && docker compose exec headscale headscale nodes list"
```

Confirm both `alphalog-pwa` and `coinarb-50x` show `online`. Then from the lattice-server
PC:

```bash
docker compose exec lattice-server-postgres-1 psql -U alphalog -d alphalog_bots -c \
  "SELECT count(*) FROM bot_commands;"
```

(just confirming the DB is reachable and unchanged so far — the real end-to-end write test
is Step 9.)

- [ ] **Step 9: Resume the bots**

Re-enable the MT5 EAs' auto-trading, and:

```bash
fly machine start <machine-id> --app coinarb-50x
```

- [ ] **Step 10: Monitor for correct data flow**

Watch for new rows appearing as expected:

```bash
docker compose exec lattice-server-postgres-1 psql -U alphalog -d alphalog_bots -c \
  "SELECT id, event_type, created_at FROM bot_events ORDER BY created_at DESC LIMIT 10;"
```

Wait for at least one new heartbeat/event to confirm the live write path works, before
considering the cutover complete. Also test one bot-control UI action (pause/resume) from
the browser, per Task 6 Step 6's verification.

- [ ] **Step 11: Report cutover complete**

Summarize to the user: what was migrated, current state of Supabase Cloud (kept alive, no
new writes to the 16 tables), and the 1-2 week safety window before evaluating subscription
changes (per the spec's rollback plan).

---

## Self-Review Notes

- **Spec coverage:** all sections of the design doc (architecture, components, runbook,
  the 3-mutation special case, rollback) map to Tasks 1-9 above.
- **`arbitrage_latency_pairs` edge case** (Task 6): flagged explicitly as a concern for the
  implementer to verify rather than silently assumed — this table wasn't in the audit's
  16-table list, so it's out of scope, but the code path exists in `NewStrategyWizard` and
  deserves a human check before assuming it's dead code.
- **`coinarb/src/core/loop.ts` etc. (Task 7, Step 6):** the audit didn't capture these files'
  exact call shapes, so the plan is explicit that the implementer must read the actual code
  and apply the established translation pattern, rather than guessing at exact code — this is
  a deliberate, flagged gap, not an oversight.
