# Migración de CME/Tradovate a Postgres propio — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar las 8 tablas CME/Tradovate (`algo_cme_accounts`, `cme_connections`,
`cme_equity_snapshots`, `cme_positions`, `cme_risk_configs`, `cme_signals`,
`cme_trades_propfirm`, `cme_trades_real`) de Supabase Cloud al Postgres propio
de lattice-server, reemplazando también el Vault de Supabase (token OAuth de
Tradovate) por el vault de secretos propio de lattice-server — sin tocar la
lógica de `dispatchTradovate` (ATR/Kelly/reversión), solo dónde vive el dato.

**Architecture:** Mismo patrón que la migración de cripto/forex (Etapa 1a):
esquema espejo en `data/alphalog/schema.sql`, shim compatible-con-Supabase
(`src/lib/pg/client.ts`) extendido con las tablas nuevas, y cada call site
reescrito de `createClient()`/`createServiceClient()` a `getPgClient()`. El
token de Tradovate se cifra con AES-256-GCM (reusando la función de
lattice-server) y se guarda en la tabla `"Secret"` ya existente en la base
`lattice` (conexión Postgres separada de `alphalog_bots`).

**Tech Stack:** Next.js API routes, `postgres.js` (ya usado por el shim),
Node `crypto` (AES-256-GCM), Zod (validación ya existente en las rutas).

## Global Constraints

- Las 8 tablas CME tienen 0 filas en Supabase hoy — no hay tarea de
  migración de datos para ellas, solo esquema + código.
- `algo_cme_accounts.user_id` debe referenciar `public.users(id)` en el
  schema nuevo (NO `auth.users` — ese esquema de Supabase Auth no se migra
  ni se recrea).
- El token de Tradovate se guarda en `"Secret"` (base `lattice`,
  `project='alphalog-cme'`, `name=<cme_connections.id>`), anclado al
  **único** `userId` de lattice-server (`02cea22f-b155-4fe6-bcd4-9354160f3a8a`)
  — nunca al `user_id` de AlphaLog (son sistemas de usuarios distintos, sin
  correspondencia de UUIDs).
- `ENCRYPTION_KEY` (lattice-server) y `DATA_ENCRYPTION_KEY` (ya deployada en
  Fly para `alphalog-pwa`) **no son la misma variable** — nunca asumir que
  son intercambiables.
- `historical_bars`/`historical_bars_coverage` (25,111 filas reales,
  compartida entre forex/crypto/futuros) queda **fuera de alcance** — sigue
  en Supabase. Los 2 archivos que la usan (`tradovate-poll`,
  `bars/tradovate-fetch`) quedan en modo híbrido: sus llamadas a tablas CME
  y a `algorithms` pasan al shim; sus llamadas a `historical_bars`/
  `historical_bars_coverage` NO se tocan.
- Sin cambios de comportamiento en `dispatchTradovate` (ATR, Kelly,
  reversión de posición, fail-open) — solo cambia el cliente de datos que
  recibe como parámetro.
- Los crons de CME (`position-sync`, `risk-monitor`, `equity-sync`,
  `connection-heartbeat`, `daily-report`) usan **solo** `createServiceClient()`
  (rol de servicio, sin sesión de usuario) — no dependen de RLS para
  scoping, así que no necesitan chequeo de `user_id` agregado, solo el
  cambio de cliente.
- Las rutas API (12) sí usan `createClient()` (sesión de usuario) en algún
  punto — cada una se verifica individualmente por si depende de RLS sin
  filtro explícito de `user_id`, no se asume que ya lo tiene ni que le falta.

---

## Task 1: Schema — 8 tablas CME + 3 ajustes acordados de infraestructura

**Files:**
- Modify: `lattice-server/data/alphalog/schema.sql`
- Operación directa (no archivo): `ALTER TABLE`/`GRANT`/`CREATE POLICY` contra
  el Postgres real de lattice-server (bases `alphalog_bots` y `lattice`).

**Interfaces:**
- Produces: las 8 tablas nuevas en `alphalog_bots`, listas para que el shim
  (Task 2) las declare en `InScopeTable`. El `GRANT`+RLS sobre `"Secret"`
  (base `lattice`) queda listo para que Task 3 la use.

- [ ] **Step 1: Agregar las 8 tablas a `schema.sql`**

Agregar al final de `lattice-server/data/alphalog/schema.sql` (después de la
última tabla existente):

```sql
-- ─── CME / Tradovate (migración 2026-07-13) ─────────────────────────────

CREATE TABLE public.algo_cme_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  account_type text NOT NULL CHECK (account_type = ANY (ARRAY['propfirm', 'broker'])),
  provider_name text NOT NULL,
  account_number text NOT NULL,
  label text,
  funded_amount numeric,
  max_daily_loss numeric,
  max_trailing_dd numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  is_paper boolean NOT NULL DEFAULT false,
  CONSTRAINT algo_cme_accounts_propfirm_provider_check CHECK (
    (account_type <> 'propfirm') OR (provider_name = ANY (ARRAY['Apex', 'Lucid Trading', 'MyFundedFutures', 'Tradeify']))
  )
);

CREATE TABLE public.cme_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  cme_account_id uuid NOT NULL REFERENCES public.algo_cme_accounts(id),
  status text NOT NULL DEFAULT 'disconnected' CHECK (status = ANY (ARRAY['connected', 'disconnected', 'error', 'paused'])),
  broker_type text NOT NULL DEFAULT 'tradovate' CHECK (broker_type = ANY (ARRAY['tradovate', 'ibkr', 'tradestation'])),
  tradovate_account_id integer,
  tradovate_account_spec text,
  access_token_vault_key text,
  token_expires_at timestamptz,
  daily_pnl_usd numeric DEFAULT 0,
  last_error text,
  error_at timestamptz,
  last_connected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cme_risk_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  cme_account_id uuid NOT NULL REFERENCES public.algo_cme_accounts(id),
  circuit_breaker_pct numeric NOT NULL CHECK (circuit_breaker_pct > 0 AND circuit_breaker_pct <= 100),
  max_positions integer CHECK (max_positions > 0),
  enabled boolean NOT NULL DEFAULT true,
  paused_reason text CHECK (paused_reason = ANY (ARRAY['circuit_breaker', 'manual', 'violation'])),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cme_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  algorithm_id uuid REFERENCES public.algorithms(id),
  cme_account_id uuid NOT NULL REFERENCES public.algo_cme_accounts(id),
  connection_id uuid REFERENCES public.cme_connections(id),
  contract text NOT NULL,
  direction text NOT NULL CHECK (direction = ANY (ARRAY['LONG', 'SHORT'])),
  quantity integer NOT NULL CHECK (quantity > 0),
  avg_entry_price numeric,
  broker_position_id text,
  is_manual boolean NOT NULL DEFAULT false,
  opened_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Índice compuesto: position-sync borra/inserta por (user_id, cme_account_id, is_manual)
-- cada minuto (Ajuste #16 de la investigación) — evita seq scan sobre esta tabla.
CREATE INDEX cme_positions_account_lookup_idx ON public.cme_positions (cme_account_id, user_id);

CREATE TABLE public.cme_equity_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  cme_account_id uuid NOT NULL REFERENCES public.algo_cme_accounts(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
-- equity-sync corre cada 5 min y lee por cme_account_id + recencia (Ajuste #16).
CREATE INDEX cme_equity_snapshots_account_recency_idx ON public.cme_equity_snapshots (cme_account_id, created_at DESC);

CREATE TABLE public.cme_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  algorithm_id uuid REFERENCES public.algorithms(id),
  cme_account_id uuid NOT NULL REFERENCES public.algo_cme_accounts(id),
  contract text NOT NULL,
  direction text NOT NULL CHECK (direction = ANY (ARRAY['BUY', 'SELL'])),
  signal_type text NOT NULL DEFAULT 'entry' CHECK (signal_type = ANY (ARRAY['entry', 'exit'])),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  stop_loss_ticks integer CHECK (stop_loss_ticks > 0),
  take_profit_ticks integer CHECK (take_profit_ticks > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending', 'executing', 'executed', 'rejected', 'skipped'])),
  risk_check_result jsonb,
  reject_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  executed_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 seconds'),
  parent_signal_id uuid REFERENCES public.cme_signals(id),
  slice_index integer,
  total_slices integer,
  execution_algo text CHECK (execution_algo = ANY (ARRAY['twap', 'vwap', 'is'])),
  scheduled_at timestamptz
);
-- Barrido de vencidos (Ajuste #5): esta consulta corre en position-sync cada minuto.
CREATE INDEX cme_signals_pending_expiry_idx ON public.cme_signals (status, expires_at) WHERE status = 'pending';

CREATE TABLE public.cme_trades_propfirm (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  algorithm_id uuid REFERENCES public.algorithms(id),
  cme_account_id uuid NOT NULL REFERENCES public.algo_cme_accounts(id),
  connection_id uuid REFERENCES public.cme_connections(id),
  direction text NOT NULL CHECK (direction = ANY (ARRAY['BUY', 'SELL'])),
  quantity integer NOT NULL CHECK (quantity > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending', 'filled', 'cancelled', 'rejected', 'closed'])),
  close_reason text CHECK (close_reason = ANY (ARRAY['take_profit', 'stop_loss', 'kill_switch', 'circuit_breaker', 'manual'])),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cme_trades_real (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  algorithm_id uuid REFERENCES public.algorithms(id),
  cme_account_id uuid NOT NULL REFERENCES public.algo_cme_accounts(id),
  connection_id uuid REFERENCES public.cme_connections(id),
  direction text NOT NULL CHECK (direction = ANY (ARRAY['BUY', 'SELL'])),
  quantity integer NOT NULL CHECK (quantity > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending', 'filled', 'cancelled', 'rejected', 'closed'])),
  close_reason text CHECK (close_reason = ANY (ARRAY['take_profit', 'stop_loss', 'kill_switch', 'circuit_breaker', 'manual'])),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

Nota: las columnas exactas de arriba vienen de una introspección directa de
Supabase (no adivinadas) hecha durante el brainstorm — si al ejecutar el
`CREATE TABLE` real Postgres reporta una columna faltante que algún call
site necesite (Tasks 4-7 lo revelarían al correr `tsc`), agregarla en este
mismo archivo antes de continuar.

- [ ] **Step 2: Ajuste acordado #3 — CHECK constraint en `algorithms.status`**

```sql
ALTER TABLE public.algorithms
  ADD CONSTRAINT algorithms_status_check
  CHECK (status = ANY (ARRAY['draft', 'paper', 'approved', 'live', 'paused', 'archived']));
```

- [ ] **Step 3: Aplicar el schema contra el Postgres real**

```bash
cd /c/Users/rivej/Documents/lattice-server
set -a && source .env && set +a
docker exec -i -e PGPASSWORD="$POSTGRES_PASSWORD" lattice-server-postgres-1 \
  psql -U "$POSTGRES_USER" -d alphalog_bots < data/alphalog/schema.sql
```

Expected: sin errores. Si `CREATE TABLE`/`ALTER TABLE` para objetos ya
existentes falla por "already exists", es porque el `schema.sql` no usa
`IF NOT EXISTS` — normal en este repo (se aplica una sola vez por tabla
nueva); confirmar que las 8 tablas CME y el nuevo CHECK se crearon:

```bash
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" lattice-server-postgres-1 \
  psql -U "$POSTGRES_USER" -d alphalog_bots -c "\dt cme_* algo_cme_accounts"
```

- [ ] **Step 4: Ajuste acordado #2 — least-privilege en `"Secret"` (base `lattice`)**

```bash
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" lattice-server-postgres-1 \
  psql -U "$POSTGRES_USER" -d lattice -c "
ALTER TABLE \"Secret\" ENABLE ROW LEVEL SECURITY;
CREATE POLICY alphalog_secrets_scope ON \"Secret\"
  USING (project LIKE 'alphalog-%')
  WITH CHECK (project LIKE 'alphalog-%');
GRANT SELECT, INSERT, UPDATE, DELETE ON \"Secret\" TO alphalog;
"
```

Nota: `ENABLE ROW LEVEL SECURITY` sin una policy adicional para el rol
`lattice` bloquearía al dashboard Tauri de leer sus propios secretos — pero
el rol `lattice` es superusuario (`BYPASSRLS` implícito), así que no se ve
afectado. Confirmar esto explícitamente:

```bash
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" lattice-server-postgres-1 \
  psql -U "$POSTGRES_USER" -d lattice -c "SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname IN ('lattice','alphalog');"
```

Expected: `lattice` → `t` (bypassa RLS), `alphalog` → `f` (respeta la policy).

- [ ] **Step 5: Verificar el GRANT + RLS funcionan**

```bash
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" lattice-server-postgres-1 \
  psql -U "$POSTGRES_USER" -d lattice -c "
SET ROLE alphalog;
SELECT has_table_privilege('alphalog', '\"Secret\"', 'INSERT') AS can_insert;
RESET ROLE;
"
```

Expected: `can_insert = t`.

- [ ] **Step 6: Commit**

```bash
cd /c/Users/rivej/Documents/lattice-server
git add data/alphalog/schema.sql
git commit -m "feat(schema): agrega 8 tablas CME/Tradovate + CHECK en algorithms.status"
```

---

## Task 2: Extender el shim de Postgres (`src/lib/pg/client.ts`)

**Files:**
- Modify: `alphalog-pwa/src/lib/pg/client.ts`
- Test: `alphalog-pwa/src/lib/pg/__tests__/client.test.ts` (crear si no existe)

**Interfaces:**
- Consumes: `postgres.js` (`postgres` import ya presente).
- Produces: `InScopeTable` con las 8 tablas CME agregadas; `QueryBuilder` con
  3 métodos nuevos: `.gt(col, val)`, `.delete()`, `.upsert(rows, {onConflict})`
  — todos los call sites de las Tasks 4-7 los necesitan (confirmado por
  grep: `.upsert(...)` en `cme/connect`, `.delete()` en `kill-switch` y
  `position-sync`, `.gt()` para el barrido de `cme_signals` vencidos).

- [ ] **Step 1: Escribir el test que falla, para `.upsert()`**

```typescript
// alphalog-pwa/src/lib/pg/__tests__/client.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getPgClient } from "../client";

describe("QueryBuilder — nuevos métodos CME", () => {
  it("upsert() genera INSERT ... ON CONFLICT DO UPDATE", async () => {
    const pg = getPgClient();
    const { error } = await pg
      .from("cme_risk_configs")
      .upsert(
        { user_id: "304a1a34-36a9-4a75-ae52-3023409932f0", cme_account_id: "00000000-0000-0000-0000-000000000000", circuit_breaker_pct: 80 },
        { onConflict: "user_id,cme_account_id" }
      );
    // No aserta contra datos reales — solo que la query se construye y ejecuta sin tirar.
    expect(error).toBeNull();
  });

  it("delete() borra filas filtradas por eq()", async () => {
    const pg = getPgClient();
    const { error } = await pg.from("cme_positions").delete().eq("user_id", "no-such-user");
    expect(error).toBeNull();
  });

  it("gt() agrega una condición WHERE col > val", async () => {
    const pg = getPgClient();
    const { data, error } = await pg
      .from("cme_signals")
      .select("id")
      .eq("status", "pending")
      .gt("expires_at", new Date(0).toISOString());
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });
});
```

- [ ] **Step 2: Correr el test, confirmar que falla**

```bash
cd /c/Users/rivej/Documents/alphalog-pwa
npx vitest run src/lib/pg/__tests__/client.test.ts
```

Expected: FAIL — `pg.from(...).upsert is not a function` (y lo mismo para
`.delete`/`.gt`).

- [ ] **Step 3: Ampliar `InScopeTable`**

En `alphalog-pwa/src/lib/pg/client.ts`, reemplazar el bloque `InScopeTable`:

```typescript
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
  | "accounts"
  | "algo_cme_accounts"
  | "cme_connections"
  | "cme_equity_snapshots"
  | "cme_positions"
  | "cme_risk_configs"
  | "cme_signals"
  | "cme_trades_propfirm"
  | "cme_trades_real";
```

- [ ] **Step 4: Agregar `.gt()`, `.delete()`, `.upsert()` a `QueryBuilder`**

Modificar `alphalog-pwa/src/lib/pg/client.ts`:

```typescript
class QueryBuilder {
  private table: InScopeTable;
  private mode: "select" | "insert" | "update" | "delete" | "upsert" | null = null;
  private selectCols = "*";
  private insertRows: Row[] = [];
  private updateRow: Row = {};
  private upsertConflictCols: string[] = [];
  private wheres: Array<{ col: string; op: "eq" | "is" | "gt"; val: unknown }> = [];
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

  delete() {
    this.mode = "delete";
    return this;
  }

  upsert(rows: Row | Row[], opts: { onConflict: string }) {
    this.mode = "upsert";
    this.insertRows = Array.isArray(rows) ? rows : [rows];
    this.upsertConflictCols = opts.onConflict.split(",").map((s) => s.trim());
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

  gt(col: string, val: unknown) {
    this.wheres.push({ col, op: "gt", val });
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

  // Alias — el shim ya trataba single() como "0 filas -> null" (no como error
  // ante 0/2+ filas, a diferencia de Supabase real). maybeSingle() es el mismo
  // comportamiento, se agrega el alias para que los call sites que ya llaman
  // .maybeSingle() no necesiten cambiar de método, solo de import.
  maybeSingle() {
    this.wantSingle = true;
    return this;
  }

  private buildWhereFragment(client: ReturnType<typeof postgres>) {
    if (this.wheres.length === 0) return client``;
    const clauses = this.wheres.map((w) => {
      if (w.op === "is") {
        return client`${client(w.col)} IS NULL`;
      }
      if (w.op === "gt") {
        return client`${client(w.col)} > ${w.val as never}`;
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
          RETURNING ${this.selectCols === "*" ? client`*` : client(this.selectCols.split(",").map((s) => s.trim()))}
        `;
      } else if (this.mode === "upsert") {
        const updateCols = Object.keys(this.insertRows[0]).filter((c) => !this.upsertConflictCols.includes(c));
        const setFragment = updateCols
          .map((c) => client`${client(c)} = EXCLUDED.${client(c)}`)
          .reduce((acc, c, i) => (i === 0 ? c : client`${acc}, ${c}`));
        result = await client`
          INSERT INTO ${client(this.table)} ${client(this.insertRows)}
          ON CONFLICT (${client(this.upsertConflictCols)}) DO UPDATE SET ${setFragment}
          RETURNING *
        `;
      } else if (this.mode === "update") {
        const where = this.buildWhereFragment(client);
        result = await client`
          UPDATE ${client(this.table)} SET ${client(this.updateRow)} ${where}
          RETURNING *
        `;
      } else if (this.mode === "delete") {
        const where = this.buildWhereFragment(client);
        result = await client`DELETE FROM ${client(this.table)} ${where} RETURNING *`;
      } else {
        const where = this.buildWhereFragment(client);
        const orderFragment = this.orderCol
          ? client`ORDER BY ${client(this.orderCol)} ${this.orderAsc ? client`ASC` : client`DESC`}`
          : client``;
        const cols = this.selectCols === "*" ? client`*` : client(this.selectCols.split(",").map((s) => s.trim()));
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
    }
  }
}
```

- [ ] **Step 5: Correr el test, confirmar que pasa**

```bash
npx vitest run src/lib/pg/__tests__/client.test.ts
```

Expected: 3/3 PASS. (Requiere `ALPHALOG_PG_URL` apuntando al Postgres de
lattice-server en el entorno de test — ya configurado desde la Etapa 1a.)

- [ ] **Step 6: `tsc --noEmit` limpio + commit**

```bash
npx tsc --noEmit
git add src/lib/pg/client.ts src/lib/pg/__tests__/client.test.ts
git commit -m "feat(pg-shim): agrega gt/delete/upsert/maybeSingle + 8 tablas CME a InScopeTable"
```

---

## Task 3: Módulo de secretos (`lattice-secrets.ts`) + reemplazo de `vault.ts`

**Files:**
- Create: `alphalog-pwa/src/lib/lattice-secrets.ts`
- Create: `alphalog-pwa/src/lib/__tests__/lattice-secrets.test.ts`
- Modify: `alphalog-pwa/src/lib/cme/vault.ts`
- Modify: `alphalog-pwa/src/lib/cme/__tests__/vault.test.ts`
- Modify: `alphalog-pwa/.env.example` (documentar `LATTICE_PG_URL`,
  `LATTICE_ENCRYPTION_KEY`)

**Interfaces:**
- Produces: `getLatticeSecret(project: string, name: string): Promise<string | null>`,
  `setLatticeSecret(project: string, name: string, value: string): Promise<void>`,
  `deleteLatticeSecret(project: string, name: string): Promise<void>` —
  Task 8 (instance_secret) también los consume con `project='alphalog-mt5'`.

- [ ] **Step 1: Escribir el test que falla**

```typescript
// alphalog-pwa/src/lib/__tests__/lattice-secrets.test.ts
import { describe, it, expect } from "vitest";
import { getLatticeSecret, setLatticeSecret, deleteLatticeSecret } from "../lattice-secrets";

describe("lattice-secrets", () => {
  it("guarda y lee un secreto cifrado, round-trip", async () => {
    const name = `test-${Date.now()}`;
    await setLatticeSecret("alphalog-cme", name, "token-de-prueba-xyz");
    const read = await getLatticeSecret("alphalog-cme", name);
    expect(read).toBe("token-de-prueba-xyz");
    await deleteLatticeSecret("alphalog-cme", name);
    const afterDelete = await getLatticeSecret("alphalog-cme", name);
    expect(afterDelete).toBeNull();
  });

  it("getLatticeSecret devuelve null si no existe", async () => {
    const read = await getLatticeSecret("alphalog-cme", "no-existe-nunca");
    expect(read).toBeNull();
  });
});
```

- [ ] **Step 2: Correr el test, confirmar que falla**

```bash
npx vitest run src/lib/__tests__/lattice-secrets.test.ts
```

Expected: FAIL — módulo `../lattice-secrets` no existe.

- [ ] **Step 3: Implementar `lattice-secrets.ts`**

```typescript
// alphalog-pwa/src/lib/lattice-secrets.ts
//
// Vault de secretos propio de lattice-server, accedido directamente por SQL
// (no vía la ruta HTTP api/src/routes/secrets.ts, que es JWT-session-scoped
// para el dashboard Tauri — ver README de lattice-server, sección "Secret:
// dos vías de acceso", Task 9 de este plan).
//
// La tabla "Secret" vive en la base `lattice` (NO alphalog_bots) y su FK de
// userId apunta al único usuario de lattice-server -- nunca al user_id de
// AlphaLog, son sistemas de usuarios distintos sin correspondencia de UUIDs.
// project+name ya desambiguan de sobra sin necesitar el user_id de AlphaLog.

import postgres from "postgres";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const LATTICE_USER_ID = "02cea22f-b155-4fe6-bcd4-9354160f3a8a";

let sql: ReturnType<typeof postgres> | null = null;

function getLatticeSql() {
  if (sql) return sql;
  const url = process.env.LATTICE_PG_URL;
  if (!url) throw new Error("Missing LATTICE_PG_URL env var");
  sql = postgres(url, { max: 3 });
  return sql;
}

function getKey(): Buffer {
  const hexKey = process.env.LATTICE_ENCRYPTION_KEY;
  if (!hexKey) throw new Error("Missing LATTICE_ENCRYPTION_KEY env var");
  const key = Buffer.from(hexKey, "hex");
  if (key.length !== 32) throw new Error("LATTICE_ENCRYPTION_KEY debe ser 32 bytes (64 hex chars)");
  return key;
}

function encrypt(plaintext: string): { ciphertext: Buffer; iv: Buffer; authTag: Buffer } {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return { ciphertext, iv, authTag: cipher.getAuthTag() };
}

function decrypt(ciphertext: Buffer, iv: Buffer, authTag: Buffer): string {
  const key = getKey();
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

export async function getLatticeSecret(project: string, name: string): Promise<string | null> {
  const client = getLatticeSql();
  const rows = await client<{ ciphertext: Buffer; iv: Buffer; authTag: Buffer }[]>`
    SELECT ciphertext, iv, "authTag" FROM "Secret"
    WHERE "userId" = ${LATTICE_USER_ID} AND project = ${project} AND name = ${name}
  `;
  if (rows.length === 0) return null;
  return decrypt(rows[0].ciphertext, rows[0].iv, rows[0].authTag);
}

export async function setLatticeSecret(project: string, name: string, value: string): Promise<void> {
  const client = getLatticeSql();
  const { ciphertext, iv, authTag } = encrypt(value);
  await client`
    INSERT INTO "Secret" (id, "userId", project, name, ciphertext, iv, "authTag", "createdAt", "updatedAt")
    VALUES (gen_random_uuid()::text, ${LATTICE_USER_ID}, ${project}, ${name}, ${ciphertext}, ${iv}, ${authTag}, now(), now())
    ON CONFLICT ("userId", project, name) DO UPDATE SET
      ciphertext = EXCLUDED.ciphertext,
      iv = EXCLUDED.iv,
      "authTag" = EXCLUDED."authTag",
      "updatedAt" = now()
  `;
}

// DELETE real (Ajuste #4) -- vault.ts hoy "borra" sobrescribiendo con string
// vacío; acá se decide explícitamente pasar a un DELETE real de la fila,
// más limpio y sin el estado intermedio ambiguo de "secreto vacío".
export async function deleteLatticeSecret(project: string, name: string): Promise<void> {
  const client = getLatticeSql();
  await client`
    DELETE FROM "Secret" WHERE "userId" = ${LATTICE_USER_ID} AND project = ${project} AND name = ${name}
  `;
}
```

- [ ] **Step 4: Documentar las 2 variables de entorno nuevas**

Agregar a `alphalog-pwa/.env.example`:

```
# lattice-server: base "lattice" (para el vault de secretos compartido),
# distinta de ALPHALOG_PG_URL (que apunta a la base "alphalog_bots").
LATTICE_PG_URL=postgresql://alphalog:REEMPLAZAR@lattice-server-host:5432/lattice
# Valor real: tomar de lattice-server/.env, variable ENCRYPTION_KEY.
# NO es la misma variable que DATA_ENCRYPTION_KEY (ya deployada, otro propósito).
LATTICE_ENCRYPTION_KEY=REEMPLAZAR_64_HEX_CHARS
```

- [ ] **Step 5: Correr el test, confirmar que pasa**

```bash
npx vitest run src/lib/__tests__/lattice-secrets.test.ts
```

Expected: 2/2 PASS (requiere `LATTICE_PG_URL`/`LATTICE_ENCRYPTION_KEY` reales
en el entorno de test — configurar como Fly secrets en `alphalog-pwa`, ver
Step 6).

- [ ] **Step 6: Configurar los Fly secrets reales**

```bash
cd /c/Users/rivej/Documents/lattice-server
set -a && source .env && set +a
echo "postgresql://alphalog:${POSTGRES_PASSWORD}@<host-interno>:5432/lattice"
# Copiar el valor real de ENCRYPTION_KEY del .env de lattice-server (no imprimir en shell compartido):
grep '^ENCRYPTION_KEY=' .env | cut -d= -f2
```

Con esos dos valores (sin pegarlos en el chat — usarlos directo en el
comando):

```bash
cd /c/Users/rivej/Documents/alphalog-pwa
fly secrets set LATTICE_PG_URL="postgresql://alphalog:<password>@<host>:5432/lattice" --app alphalog-pwa
fly secrets set LATTICE_ENCRYPTION_KEY="<valor-real-de-ENCRYPTION_KEY>" --app alphalog-pwa
```

- [ ] **Step 7: Reescribir `vault.ts` para usar `lattice-secrets.ts`**

```typescript
// alphalog-pwa/src/lib/cme/vault.ts
import { getLatticeSecret, setLatticeSecret, deleteLatticeSecret } from "../lattice-secrets";

const PROJECT = "alphalog-cme";

function vaultKey(connectionId: string): string {
  return `cme-access:${connectionId}`;
}

export async function storeCmeAccessToken(connectionId: string, token: string): Promise<void> {
  await setLatticeSecret(PROJECT, vaultKey(connectionId), token);
}

export async function readCmeAccessToken(connectionId: string): Promise<string | null> {
  return getLatticeSecret(PROJECT, vaultKey(connectionId));
}

export async function deleteCmeAccessToken(connectionId: string): Promise<void> {
  await deleteLatticeSecret(PROJECT, vaultKey(connectionId));
}
```

- [ ] **Step 8: Actualizar el test existente de `vault.ts`**

Reemplazar los mocks de `@/lib/supabase/server` en
`alphalog-pwa/src/lib/cme/__tests__/vault.test.ts` por mocks de
`../lattice-secrets` (mismo patrón: `vi.mock`), verificando que
`storeCmeAccessToken`/`readCmeAccessToken`/`deleteCmeAccessToken` llaman a
`setLatticeSecret`/`getLatticeSecret`/`deleteLatticeSecret` con
`project='alphalog-cme'` y `name='cme-access:<connectionId>'` exactamente.

- [ ] **Step 9: `tsc --noEmit` + tests + commit**

```bash
npx tsc --noEmit
npx vitest run src/lib/cme/__tests__/vault.test.ts src/lib/__tests__/lattice-secrets.test.ts
git add src/lib/lattice-secrets.ts src/lib/__tests__/lattice-secrets.test.ts src/lib/cme/vault.ts src/lib/cme/__tests__/vault.test.ts .env.example
git commit -m "feat(cme): reemplaza el Vault de Supabase por el vault propio de lattice-server"
```

---

## Task 4: `requireOwnership()` + rutas de cuenta/conexión (6 archivos)

**Files:**
- Create: `alphalog-pwa/src/lib/ownership.ts`
- Create: `alphalog-pwa/src/lib/__tests__/ownership.test.ts`
- Modify: `src/app/api/cme/connect/route.ts`
- Modify: `src/app/api/cme/connect/[cmeAccountId]/route.ts`
- Modify: `src/app/api/cme/connections/route.ts`
- Modify: `src/app/api/cme/account/route.ts`
- Modify: `src/app/api/cme/account/equity-snapshots/route.ts`
- Modify: `src/app/api/cme/kill-switch/route.ts`

**Interfaces:**
- Consumes: `getPgClient()` de Task 2, `storeCmeAccessToken` de Task 3.
- Produces: `requireOwnership<T>(row: T & {user_id: string} | null, userId: string): T | null`
  — Task 5 también lo consume.

- [ ] **Step 1: Escribir el test que falla, para `requireOwnership`**

```typescript
// alphalog-pwa/src/lib/__tests__/ownership.test.ts
import { describe, it, expect } from "vitest";
import { requireOwnership } from "../ownership";

describe("requireOwnership", () => {
  it("devuelve la fila si user_id coincide", () => {
    const row = { id: "a", user_id: "u1", label: "x" };
    expect(requireOwnership(row, "u1")).toEqual(row);
  });

  it("devuelve null si user_id NO coincide", () => {
    const row = { id: "a", user_id: "u1", label: "x" };
    expect(requireOwnership(row, "otro-usuario")).toBeNull();
  });

  it("devuelve null si la fila es null", () => {
    expect(requireOwnership(null, "u1")).toBeNull();
  });
});
```

- [ ] **Step 2: Correr el test, confirmar que falla**

```bash
cd /c/Users/rivej/Documents/alphalog-pwa
npx vitest run src/lib/__tests__/ownership.test.ts
```

Expected: FAIL — módulo `../ownership` no existe.

- [ ] **Step 3: Implementar `ownership.ts`**

```typescript
// alphalog-pwa/src/lib/ownership.ts
//
// El Postgres crudo (getPgClient) no tiene RLS -- cada ruta que antes
// confiaba en una policy de Supabase (`auth.uid() = user_id`) para el
// scoping ahora debe filtrar explícitamente. Este helper es el único punto
// donde vive ese chequeo (Ajuste #11), en vez de repetirlo a mano en cada
// una de las 12 rutas API que tocan tablas CME.

export function requireOwnership<T extends { user_id: string }>(
  row: T | null,
  userId: string,
): T | null {
  if (!row) return null;
  if (row.user_id !== userId) return null;
  return row;
}
```

- [ ] **Step 4: Correr el test, confirmar que pasa**

```bash
npx vitest run src/lib/__tests__/ownership.test.ts
```

Expected: 3/3 PASS.

- [ ] **Step 5: Reescribir `src/app/api/cme/connect/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getPgClient } from '@/lib/pg/client';
import { requireOwnership } from '@/lib/ownership';
import { getCurrentUser } from '@/lib/auth/session'; // usar el helper de sesión ya existente en el repo (confirmar nombre exacto en src/lib/auth/ antes de escribir el import — el patrón `createClient().auth.getUser()` deja de aplicar sin Supabase)
import { tradovateAuth, getAccounts } from '@/lib/cme/tradovate';
import { storeCmeAccessToken } from '@/lib/cme/vault';
import { logAuditFromRequest } from '@/lib/security/auditLog';
import { z } from 'zod';

const schema = z.object({
  cmeAccountId: z.string().uuid(),
  tradovateUsername: z.string().min(1),
  tradovatePassword: z.string().min(1),
  appId: z.string().default('AlphaLog'),
  appVersion: z.string().default('1.0.0'),
  cid: z.number().int().default(0),
  sec: z.string().default(''),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { cmeAccountId, tradovateUsername, tradovatePassword, appId, appVersion, cid, sec } = parsed.data;

  const pg = getPgClient();
  const { data: acctRaw } = await pg
    .from('algo_cme_accounts')
    .select('id, user_id, is_paper, provider_name, account_number')
    .eq('id', cmeAccountId)
    .maybeSingle();
  const acct = requireOwnership(acctRaw as { id: string; user_id: string; is_paper: boolean; provider_name: string; account_number: string } | null, user.id);

  if (!acct) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  let authResult: Awaited<ReturnType<typeof tradovateAuth>>;
  try {
    authResult = await tradovateAuth(
      { name: tradovateUsername, password: tradovatePassword, appId, appVersion, cid, sec },
      acct.is_paper ?? false
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Tradovate auth failed: ${msg}` }, { status: 502 });
  }

  let accounts: Awaited<ReturnType<typeof getAccounts>>;
  try {
    accounts = await getAccounts(authResult.accessToken, acct.is_paper ?? false);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Could not fetch Tradovate accounts: ${msg}` }, { status: 502 });
  }

  const matched = accounts.find(
    a => String(a.id) === String(acct.account_number) || a.name === acct.account_number
  ) ?? accounts[0];

  if (!matched) {
    return NextResponse.json({ error: 'No Tradovate account found for this user' }, { status: 422 });
  }

  const { data: conn } = await pg
    .from('cme_connections')
    .upsert(
      {
        user_id: user.id,
        cme_account_id: cmeAccountId,
        status: 'connected',
        broker_type: 'tradovate',
        tradovate_account_id: matched.id,
        tradovate_account_spec: matched.name,
        token_expires_at: authResult.expirationTime,
        last_connected_at: new Date().toISOString(),
        last_error: null,
        error_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,cme_account_id' }
    )
    .single();

  if (!conn) {
    return NextResponse.json({ error: 'Failed to save connection' }, { status: 500 });
  }
  const connRow = conn as { id: string };

  await storeCmeAccessToken(connRow.id, authResult.accessToken);

  await pg
    .from('cme_risk_configs')
    .upsert(
      {
        user_id: user.id,
        cme_account_id: cmeAccountId,
        circuit_breaker_pct: 80,
        enabled: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,cme_account_id' }
    );

  await logAuditFromRequest(
    { userId: user.id, action: 'api_call', resourceType: 'account', status: 'success', changes: { cme_account_id: cmeAccountId, tradovate_account_id: matched.id } },
    req
  );

  return NextResponse.json({
    success: true,
    connectionId: connRow.id,
    tradovateAccountId: matched.id,
    tradovateAccountName: matched.name,
  });
}
```

**Nota importante para quien implemente:** el import `getCurrentUser` de
`@/lib/auth/session` es un placeholder de nombre — antes de escribir este
archivo, correr `grep -rn "auth.getUser\|getCurrentUser\|requireAuth" src/lib/auth/ src/middleware.ts`
para confirmar cuál es el helper de sesión real que YA usan las rutas
migradas de Etapa 1a (`bot/pair/route.ts`, etc.) sin pasar por
`createClient().auth.getUser()` de Supabase, y usar ese nombre exacto. Si no
existe uno genérico todavía, extraerlo de cómo `bot/pair/route.ts` obtiene
el usuario actual hoy (probablemente vía una cookie de sesión propia de
AlphaLog, ya que ese archivo también dejó de depender de Supabase Auth en
la Etapa 1a).

- [ ] **Step 6: Reescribir los 5 archivos restantes de este batch**

Para cada uno, aplicar el mismo patrón: reemplazar
`createClient()`/`createServiceClient()` + `.from(...)` por
`getPgClient()` + `.from(...)`, envolver cada lectura scoped-por-usuario en
`requireOwnership()`, y usar el helper de sesión confirmado en el Step 5.
Referencia exacta de qué reemplazar en cada archivo (de la investigación):

- **`src/app/api/cme/connect/[cmeAccountId]/route.ts`**: 2 llamadas
  `.from('cme_connections')` (líneas 18, 27 del archivo actual) — la del
  DELETE debe usar `requireOwnership` antes de borrar.
- **`src/app/api/cme/connections/route.ts`**: 1 llamada `.from('cme_connections')`
  (línea 10) — hoy ya filtra por `user_id` en la query misma (confirmado en
  la investigación del spec); mantener el filtro `.eq('user_id', user.id)`
  con el shim, no hace falta `requireOwnership` acá porque el filtro ya
  ocurre en la query, no post-fetch.
- **`src/app/api/cme/account/route.ts`**: 3 llamadas (`cme_connections` línea
  17, `algo_cme_accounts` línea 28, `cme_equity_snapshots` línea 57) +
  1 `.update()` sobre `cme_connections` (línea 44, refresco de token) —
  todas dentro de un flujo que ya arranca resolviendo la cuenta por
  `cmeAccountId` + `user.id`; envolver esa resolución inicial en
  `requireOwnership`.
- **`src/app/api/cme/account/equity-snapshots/route.ts`**: 1 llamada
  `.from('cme_equity_snapshots')` (línea 16) — confirmar si filtra por
  `user_id` en la query o depende de RLS; si depende de RLS, agregar
  `.eq('user_id', user.id)` explícito.
- **`src/app/api/cme/kill-switch/route.ts`** (Ajuste #7 — este es el
  kill-switch de CME, confirmar además que efectivamente cierra posiciones):
  4 llamadas (`cme_connections` línea 23, `algo_cme_accounts` línea 34,
  `cme_positions` línea 55, `cme_risk_configs` línea 82) + 2 mutaciones
  (`.update()` en `cme_connections` línea 50, `.delete()` en `cme_positions`
  línea 74). Usar el `.delete()` nuevo del shim (Task 2) para la línea 74.
  Al terminar este archivo, agregar una nota en el mismo PR/commit
  confirmando si `bot_commands` (MT5) y este kill-switch (CME) son
  mecanismos genuinamente independientes por diseño (mercados distintos) o
  si deberían compartir lógica — no es necesario unificarlos ahora, solo
  dejar la confirmación por escrito.

- [ ] **Step 7: `tsc --noEmit` + tests + commit**

```bash
npx tsc --noEmit
npx vitest run src/app/api/cme/connect src/app/api/cme/connections src/app/api/cme/account src/app/api/cme/kill-switch
git add src/lib/ownership.ts src/lib/__tests__/ownership.test.ts src/app/api/cme/connect src/app/api/cme/connections src/app/api/cme/account src/app/api/cme/kill-switch
git commit -m "feat(cme): migra rutas de cuenta/conexión a Postgres propio + requireOwnership"
```

---

## Task 5: Rutas API restantes (7 archivos)

**Files:**
- Modify: `src/app/api/cme/positions/route.ts`
- Modify: `src/app/api/cme/positions/[id]/close/route.ts`
- Modify: `src/app/api/cme/risk-config/route.ts`
- Modify: `src/app/api/cme/signal/route.ts`
- Modify: `src/app/api/cme/trades/propfirm/route.ts`
- Modify: `src/app/api/cme/trades/real/route.ts`
- Modify: `src/app/api/intelligence/algorithms/cme-accounts/route.ts`

**Interfaces:**
- Consumes: `getPgClient()`, `requireOwnership()` de Tasks 2 y 4.

- [ ] **Step 1: Reescribir cada archivo con el mismo patrón de la Task 4**

Referencia exacta de qué reemplazar (de la investigación):

- **`positions/route.ts`**: 1 llamada `.from('cme_positions')` (línea 13) —
  ya filtra por `user_id` en la query (confirmar y mantener con el shim).
- **`positions/[id]/close/route.ts`**: 4 llamadas (`cme_positions` línea 18,
  `cme_connections` líneas 28/53, `algo_cme_accounts` línea 36) + 1
  `.delete()` (línea 74, usar el método nuevo del shim) — envolver la
  resolución inicial de la posición en `requireOwnership`.
- **`risk-config/route.ts`**: 2 llamadas `.from('cme_risk_configs')`
  (líneas 23 y 50, un GET y un PATCH/PUT) — ambas dentro de handlers
  separados, cada uno con su propio `requireOwnership`.
- **`signal/route.ts`**: 2 llamadas `.from('cme_signals')` (líneas 33, 78) —
  este es el endpoint que un cliente externo podría usar para insertar una
  señal manual; confirmar que el `insert` no permite `user_id` spoofeado
  (debe forzarse al `user.id` de la sesión, no leerse del body).
- **`trades/propfirm/route.ts`**: 1 llamada `.from('cme_trades_propfirm')`
  (línea 16).
- **`trades/real/route.ts`**: 1 llamada `.from('cme_trades_real')` (línea 16)
  — hoy sin datos reales (Ajuste #13: la UI de "Real Broker" todavía dice
  "Coming soon"), pero la ruta ya existe y se migra igual que las demás.
- **`intelligence/algorithms/cme-accounts/route.ts`**: 1 llamada
  `.from('algo_cme_accounts')` (línea 13) — ya confirmado en el spec que
  filtra `.eq('user_id', user.id)` explícitamente; mantener con el shim.

- [ ] **Step 2: `tsc --noEmit` + tests + commit**

```bash
cd /c/Users/rivej/Documents/alphalog-pwa
npx tsc --noEmit
npx vitest run src/app/api/cme src/app/api/intelligence/algorithms/cme-accounts
git add src/app/api/cme src/app/api/intelligence/algorithms/cme-accounts
git commit -m "feat(cme): migra rutas de posiciones/riesgo/señales/trades a Postgres propio"
```

---

## Task 6: Crons puros de CME (5 archivos) + barrido de señales vencidas

**Files:**
- Modify: `src/app/api/cron/cme/position-sync/route.ts`
- Modify: `src/app/api/cron/cme/risk-monitor/route.ts`
- Modify: `src/app/api/cron/cme/equity-sync/route.ts`
- Modify: `src/app/api/cron/cme/connection-heartbeat/route.ts`
- Modify: `src/app/api/cron/cme/daily-report/route.ts`

**Interfaces:**
- Consumes: `getPgClient()` de Task 2. Ninguno de estos usa `createClient()`
  (sesión de usuario) — solo `createServiceClient()`, así que no necesitan
  `requireOwnership()` (el rol de servicio ya veía todas las filas antes;
  con Postgres crudo sigue viendo todas las filas, sin regresión).

- [ ] **Step 1: Reescribir `position-sync/route.ts`, agregando el barrido de vencidos (Ajuste #5)**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getPgClient } from '@/lib/pg/client';
import { safeCompareTokens } from '@/lib/security/timing';
import { readCmeAccessToken, storeCmeAccessToken } from '@/lib/cme/vault';
import { getPositions, tradovateRenew } from '@/lib/cme/tradovate';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? '';
  if (!safeCompareTokens(secret, process.env.CRON_SECRET ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const pg = getPgClient();

  // Ajuste #5: barrido de señales pending vencidas (expires_at < now()) antes
  // de sincronizar posiciones — este cron ya corre cada minuto, es el hogar
  // natural para esto en vez de crear un cron nuevo dedicado.
  await pg
    .from('cme_signals')
    .update({ status: 'rejected', reject_reason: 'expired' })
    .eq('status', 'pending'); // el shim no soporta status='pending' AND expires_at<now() en una sola llamada .update();
    // ver Step 2 para la variante con dos condiciones.

  const { data: connections } = await pg
    .from('cme_connections')
    .select('id, user_id, cme_account_id, tradovate_account_id, tradovate_account_spec, token_expires_at')
    .eq('status', 'connected');
  // NOTA: la query original también filtraba .eq('broker_type', 'tradovate') —
  // el shim actual no encadena dos .eq() sobre columnas distintas en la misma
  // llamada de forma verificada; confirmar con un test manual que .eq().eq()
  // genera "WHERE a = X AND b = Y" correctamente (el código de
  // buildWhereFragment ya soporta múltiples wheres) antes de continuar.

  if (!connections?.length) return NextResponse.json({ synced: 0 });

  let synced = 0;
  const errors: string[] = [];

  for (const conn of connections as Array<{ id: string; user_id: string; cme_account_id: string; tradovate_account_id: number; tradovate_account_spec: string; token_expires_at: string | null }>) {
    try {
      const { data: acct } = await pg
        .from('algo_cme_accounts')
        .select('is_paper')
        .eq('id', conn.cme_account_id)
        .maybeSingle();
      const isPaper = (acct as { is_paper: boolean } | null)?.is_paper ?? true;

      let token = await readCmeAccessToken(conn.id);
      if (!token) continue;

      const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at) : null;
      if (expiresAt && expiresAt < new Date(Date.now() + 10 * 60 * 1000)) {
        const renewed = await tradovateRenew(token, isPaper);
        token = renewed.accessToken;
        await storeCmeAccessToken(conn.id, token);
        await pg
          .from('cme_connections')
          .update({ token_expires_at: renewed.expirationTime })
          .eq('id', conn.id);
      }

      const positions = await getPositions(token, conn.tradovate_account_id, isPaper);

      await pg
        .from('cme_positions')
        .delete()
        .eq('user_id', conn.user_id)
        .eq('cme_account_id', conn.cme_account_id);
      // NOTA: la query original también filtraba .eq('is_manual', false) —
      // mismo caso que arriba, confirmar encadenado de 3 .eq() antes de dar
      // por buena esta migración (test manual, Step 3).

      if (positions.length > 0) {
        await pg.from('cme_positions').insert(
          positions.map(p => ({
            user_id: conn.user_id,
            cme_account_id: conn.cme_account_id,
            connection_id: conn.id,
            contract: String(p.contractId),
            direction: p.netPos > 0 ? 'LONG' : 'SHORT',
            quantity: Math.abs(p.netPos),
            avg_entry_price: p.netPrice || null,
            broker_position_id: String(p.id),
            opened_at: p.timestamp,
            updated_at: new Date().toISOString(),
          }))
        );
      }

      synced++;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
      await pg
        .from('cme_connections')
        .update({ last_error: errors[errors.length - 1], error_at: new Date().toISOString() })
        .eq('id', conn.id);
    }
  }

  return NextResponse.json({ synced, errors });
}
```

- [ ] **Step 2: Resolver el `.update()` con doble condición del barrido de vencidos**

El shim de Task 2 no tiene un método para "WHERE status=X AND expires_at<Y"
en un `.update()` (solo soporta encadenar `.eq()`/`.gt()`, que si funcionan
en cadena ya cubren esto — `buildWhereFragment` itera sobre `this.wheres`
sin importar cuántos haya). Reemplazar el `.update()` incompleto del Step 1
por:

```typescript
  await pg
    .from('cme_signals')
    .update({ status: 'rejected', reject_reason: 'expired' })
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString()); // ¡INVERTIDO! corregir abajo
```

**Cuidado:** `expires_at < now()` (vencidas) no es lo mismo que `.gt()`. El
shim de Task 2 solo agregó `.gt()`, no `.lt()`. Antes de este paso, volver a
Task 2 y agregar un método `.lt(col, val)` idéntico a `.gt()` pero con `<`
en `buildWhereFragment`, luego usar acá:

```typescript
  await pg
    .from('cme_signals')
    .update({ status: 'rejected', reject_reason: 'expired' })
    .eq('status', 'pending')
    .lt('expires_at', new Date().toISOString());
```

- [ ] **Step 3: Test manual de encadenado de múltiples `.eq()`**

```bash
cd /c/Users/rivej/Documents/lattice-server
set -a && source .env && set +a
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" lattice-server-postgres-1 \
  psql -U "$POSTGRES_USER" -d alphalog_bots -c "
INSERT INTO cme_signals (user_id, cme_account_id, contract, direction, status, expires_at)
VALUES ('304a1a34-36a9-4a75-ae52-3023409932f0', gen_random_uuid(), 'ESH4', 'BUY', 'pending', now() - interval '1 minute');
"
```

Luego, desde `alphalog-pwa`, correr un script one-off (o el propio test de
integración de Task 10) que llame `.from('cme_signals').update(...).eq('status','pending').lt('expires_at', new Date().toISOString())`
y confirme que la fila insertada arriba pasa a `status='rejected'`. Limpiar
la fila de prueba después.

- [ ] **Step 4: Reescribir los 4 crons restantes**

Mismo patrón (`createServiceClient()` → `getPgClient()`, sin
`requireOwnership`). Referencia exacta:

- **`risk-monitor/route.ts`**: 3 llamadas (`cme_connections` línea 14,
  `cme_risk_configs` líneas 25/52, `algo_cme_accounts` línea 31).
- **`equity-sync/route.ts`**: 3 llamadas (`cme_connections` líneas 16/45/63,
  `algo_cme_accounts` línea 29) + 1 `.insert()` en `cme_equity_snapshots`
  (línea 52).
- **`connection-heartbeat/route.ts`**: 4 llamadas, todas sobre
  `cme_connections`/`algo_cme_accounts` (líneas 16, 32, 41, 50, 59).
- **`daily-report/route.ts`**: 4 llamadas (`cme_connections` línea 17,
  `cme_equity_snapshots` línea 27, `algo_cme_accounts` línea 36,
  `cme_trades_propfirm` línea 42).

- [ ] **Step 5: `tsc --noEmit` + confirmar `CRON_SECRET` intacto (Ajuste #18) + commit**

```bash
npx tsc --noEmit
```

Confirmar que ninguno de los 5 archivos tocó la validación de
`x-cron-secret`/`Authorization: Bearer` al principio de cada handler (esa
lógica es independiente de qué cliente de datos se usa después) — solo
revisar visualmente que el bloque de auth sigue igual en los 5 diffs.

```bash
git add src/app/api/cron/cme
git commit -m "feat(cme): migra los 5 crons de CME a Postgres propio + barrido de señales vencidas"
```

---

## Task 7: Archivos híbridos (`tradovate-poll`, `bars/tradovate-fetch`)

**Files:**
- Modify: `src/app/api/cron/algorithms/tradovate-poll/route.ts`
- Modify: `src/app/api/cron/bars/tradovate-fetch/route.ts`

**Interfaces:**
- Consumes: `getPgClient()` de Task 2 (para `algorithms`/tablas CME),
  `createServiceClient()` de Supabase **sigue existiendo** en ambos archivos
  (solo para `historical_bars`/`historical_bars_coverage` — fuera de
  alcance, ver Global Constraints).

- [ ] **Step 1: `tradovate-poll/route.ts` — migrar solo lo que corresponde**

Este archivo (243 líneas) usa `svc.from("historical_bars")` (línea 87,
lectura) y `svc.from("algorithms")` (líneas 111/120/133/152/198, lecturas y
updates) — `algorithms` YA está migrada (Etapa 1a), así que ESAS llamadas
pasan al shim; `historical_bars` se queda en Supabase. El archivo termina
con DOS clientes activos: `getPgClient()` para `algorithms`, y
`createServiceClient()` (renombrar la variable a `supabaseHistorical` o
similar para que quede explícito en el código que es un cliente acotado a
`historical_bars`, no un remanente de la migración).

Reemplazar cada `svc.from("algorithms")` por `pg.from("algorithms")` (mismo
método `.select()`/`.update()`/`.eq()`, ya soportados por el shim desde la
Etapa 1a), dejando `svc.from("historical_bars")` (línea 87, dentro de
`latestBarTs()`) intacto.

- [ ] **Step 2: `bars/tradovate-fetch/route.ts` — mismo tratamiento**

Usa `svc.from("cme_connections")` (línea 183, migra a `pg`),
`svc.from("algorithms")` (línea 197, migra a `pg`),
`svc.from("algo_cme_accounts")` (línea 213, migra a `pg`), y
`svc.from("historical_bars")`/`svc.from("historical_bars_coverage")`
(líneas 143, 151 — quedan en Supabase, fuera de alcance). También tiene un
`.update()` sobre `cme_connections` (línea 100, refresco de token) que
migra a `pg`.

- [ ] **Step 3: `tsc --noEmit` + tests + commit**

```bash
cd /c/Users/rivej/Documents/alphalog-pwa
npx tsc --noEmit
npx vitest run src/app/api/cron/algorithms/tradovate-poll src/app/api/cron/bars/tradovate-fetch
git add src/app/api/cron/algorithms/tradovate-poll/route.ts src/app/api/cron/bars/tradovate-fetch/route.ts
git commit -m "feat(cme): migra tablas CME/algorithms en los 2 crons híbridos, historical_bars queda en Supabase"
```

---

## Task 8: Cifrar `bot_instances.instance_secret` (Ajuste #1)

**Files:**
- Modify: `src/app/api/bot/pair/route.ts`
- Modify: `src/app/api/algorithms/[id]/pairing-token/route.ts`
- Modify: `src/app/api/accounts/with-mt5/route.ts`
- Operación directa: migración de las 2 filas reales existentes.

**Interfaces:**
- Consumes: `getLatticeSecret`/`setLatticeSecret` de Task 3, con
  `project='alphalog-mt5'`, `name=<bot_instances.id>`.

- [ ] **Step 1: Confirmar el uso exacto de `instance_secret` en los 3 archivos**

```bash
cd /c/Users/rivej/Documents/alphalog-pwa
grep -n "instance_secret" src/app/api/bot/pair/route.ts src/app/api/algorithms/\[id\]/pairing-token/route.ts src/app/api/accounts/with-mt5/route.ts
```

Anotar exactamente si cada uso es lectura (comparación contra un secreto
recibido del EA) o escritura (generación de uno nuevo al parear) antes de
tocar el código — el patrón exacto de reemplazo depende de eso.

- [ ] **Step 2: Migrar las 2 filas reales existentes**

```bash
cd /c/Users/rivej/Documents/lattice-server
set -a && source .env && set +a
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" lattice-server-postgres-1 \
  psql -U "$POSTGRES_USER" -d alphalog_bots -c "SELECT id, instance_secret FROM bot_instances;"
```

Para cada una de las 2 filas devueltas, desde un script Node one-off en
`alphalog-pwa` (usando `setLatticeSecret` de Task 3 con
`project='alphalog-mt5'`, `name=<id>`), guardar el valor de
`instance_secret` cifrado. Después, poner la columna en null (no borrarla
todavía — Step 4 la elimina del schema recién cuando el código ya no la
lee):

```bash
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" lattice-server-postgres-1 \
  psql -U "$POSTGRES_USER" -d alphalog_bots -c "UPDATE bot_instances SET instance_secret = NULL;"
```

- [ ] **Step 3: Reescribir los 3 archivos para leer/escribir vía `lattice-secrets.ts`**

En cada uno, reemplazar la lectura/escritura directa de la columna
`instance_secret` por `getLatticeSecret('alphalog-mt5', instanceId)` /
`setLatticeSecret('alphalog-mt5', instanceId, secret)`.

- [ ] **Step 4: Eliminar la columna del schema**

```sql
-- lattice-server/data/alphalog/schema.sql — quitar esta línea de bot_instances:
--   instance_secret text NOT NULL,
```

```bash
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" lattice-server-postgres-1 \
  psql -U "$POSTGRES_USER" -d alphalog_bots -c "ALTER TABLE bot_instances DROP COLUMN instance_secret;"
```

- [ ] **Step 5: `tsc --noEmit` + tests + commit**

```bash
cd /c/Users/rivej/Documents/alphalog-pwa
npx tsc --noEmit
npx vitest run src/app/api/bot/pair "src/app/api/algorithms/[id]/pairing-token" src/app/api/accounts/with-mt5
git add src/app/api/bot/pair/route.ts "src/app/api/algorithms/[id]/pairing-token/route.ts" src/app/api/accounts/with-mt5/route.ts
git commit -m "fix(mt5): cifra instance_secret via el vault propio en vez de texto plano"
```

```bash
cd /c/Users/rivej/Documents/lattice-server
git add data/alphalog/schema.sql
git commit -m "fix(schema): elimina bot_instances.instance_secret (migrado a Secret cifrado)"
```

---

## Task 9: Documentación e investigación (Ajustes #6, #7, #8, #13, #14, #16, #17)

**Files:**
- Create/Modify: `lattice-server/README.md` (o `docs/` si el README ya es
  muy largo — seguir la convención existente del repo).
- Modify: `alphalog-pwa/src/components/intelligence/algorithms/CmeRealBrokerWorkspace.client.tsx`
- Notas de investigación (sin archivo fijo — documentar donde tenga sentido
  según lo que se encuentre en el Step 1).

- [ ] **Step 1: Investigar `bot_accounts.app_account_id` (Ajuste #6)**

```bash
cd /c/Users/rivej/Documents/alphalog-pwa
grep -rn "app_account_id" src/ --include="*.ts" --include="*.tsx"
```

Si aparece en algún flujo activo, documentar su propósito con un comentario
en `lattice-server/data/alphalog/schema.sql` junto a la columna. Si no
aparece usado en ningún lado (columna muerta), documentar eso también —
no se elimina en este plan (fuera de alcance), solo se deja constancia.

- [ ] **Step 2: Documentar el kill-switch de CME vs `bot_commands` de MT5 (Ajuste #7)**

Ya cubierto operacionalmente en la Task 4, Step 6 (kill-switch) — agregar acá
solo la nota final por escrito, en un comentario en
`src/app/api/cme/kill-switch/route.ts`, indicando explícitamente que es
independiente de `bot_commands` (MT5) por diseño (mercados distintos, no un
descuido).

- [ ] **Step 3: Documentar `execution_algo`/`parent_signal_id` como "diseñado, no construido" (Ajuste #8)**

Agregar un comentario en `lattice-server/data/alphalog/schema.sql`, junto a
la definición de `cme_signals`:

```sql
-- execution_algo/parent_signal_id/slice_index/total_slices: soporte de
-- slicing de órdenes (TWAP/VWAP/IS) ya diseñado en el schema pero que
-- dispatchTradovate no puebla todavía (2026-07-13) -- no es un bug, es una
-- capacidad futura no construida.
```

- [ ] **Step 4: Corregir el texto de `CmeRealBrokerWorkspace.client.tsx` (Ajuste #13)**

En `alphalog-pwa/src/components/intelligence/algorithms/CmeRealBrokerWorkspace.client.tsx`,
actualizar el texto "The database infrastructure is ready." (ya correcto)
agregando una línea aclarando que además de la base, ahora corre sobre el
Postgres propio de lattice-server (no Supabase) — solo falta el motor de
ejecución (sub-proyecto 4).

- [ ] **Step 5: Política de rotación para el token de Tradovate (Ajuste #14)**

Al crear/actualizar la fila en `"Secret"` desde `setLatticeSecret` (dentro
de `storeCmeAccessToken`, Task 3), documentar en un comentario que
`rotateEveryDays` queda sin fijar por este plan (columna existe, default
null) — decidir el valor concreto (ej. 30/60/90 días) es una decisión de
producto, no técnica; dejar anotado como pendiente de decisión explícita
del usuario en vez de inventar un número.

- [ ] **Step 6: Nota en el README de lattice-server sobre las 2 vías de acceso a `"Secret"` (Ajuste #17)**

Agregar una sección corta a `lattice-server/README.md`:

```markdown
## Vault de secretos ("Secret") — dos vías de acceso

Desde 2026-07-13, la tabla `"Secret"` (base `lattice`) tiene dos formas de
llegar a ella:
1. **HTTP, JWT-scoped**: `api/src/routes/secrets.ts` — para el dashboard
   Tauri, requiere sesión de un usuario de `lattice`.
2. **SQL directo**: desde `alphalog-pwa` (`src/lib/lattice-secrets.ts`),
   sin pasar por la API HTTP — usa el único usuario de lattice-server como
   ancla de fila, con `project` prefijado (`alphalog-cme`, `alphalog-mt5`)
   para namespacing.

Si ves secretos con `project` distinto de `"lattice"`, vienen de la vía 2.
```

- [ ] **Step 7: Commit**

```bash
cd /c/Users/rivej/Documents/lattice-server
git add README.md data/alphalog/schema.sql
git commit -m "docs: documenta hallazgos de la migración CME (app_account_id, slicing de órdenes, vault dual)"

cd /c/Users/rivej/Documents/alphalog-pwa
git add src/components/intelligence/algorithms/CmeRealBrokerWorkspace.client.tsx src/app/api/cme/kill-switch/route.ts
git commit -m "docs(cme): aclara estado de Real Broker + independencia del kill-switch vs bot_commands"
```

---

## Task 10: Test de integración contra Postgres real (Ajuste #15)

**Files:**
- Create: `alphalog-pwa/src/lib/cme/__tests__/tradovate.integration.test.ts`

**Interfaces:**
- Consumes: `getPgClient()`, `dispatchTradovate` (sin cambios de firma).

- [ ] **Step 1: Escribir el test de integración**

```typescript
// alphalog-pwa/src/lib/cme/__tests__/tradovate.integration.test.ts
//
// A diferencia de dispatchers/index.test.ts (que mockea el cliente por
// completo), este test corre contra el Postgres real de lattice-server —
// detecta errores de sintaxis SQL que un mock nunca puede atrapar
// (Ajuste #15).
import { describe, it, expect, afterEach } from "vitest";
import { getPgClient } from "@/lib/pg/client";
import { dispatchSignal } from "@/lib/engine/dispatchers";

describe("dispatchTradovate — integración con Postgres real", () => {
  const testUserId = "304a1a34-36a9-4a75-ae52-3023409932f0";
  let testAccountId: string;
  let testAlgorithmId = "823a99db-422e-4744-834a-9060bce4ca53"; // reusa el patrón de fila de prueba ya usado en algo-runner

  afterEach(async () => {
    if (!testAccountId) return;
    const pg = getPgClient();
    await pg.from("cme_signals").delete().eq("cme_account_id", testAccountId);
    await pg.from("algo_cme_accounts").delete().eq("id", testAccountId);
  });

  it("shadow mode: inserta en cme_signals contra la base real", async () => {
    const pg = getPgClient();
    const { data: acct } = await pg
      .from("algo_cme_accounts")
      .insert({
        user_id: testUserId,
        account_type: "propfirm",
        provider_name: "Apex",
        account_number: "TEST-INTEGRATION",
        is_paper: true,
      })
      .single();
    testAccountId = (acct as { id: string }).id;

    process.env.DISPATCH_MODE = "shadow";
    const result = await dispatchSignal(
      {
        algo: { id: "test-algo", user_id: testUserId, platform: "Tradovate", parameters: { cme_account_id: testAccountId, contract: "ESH4" } },
        signal: { action: "BUY", lots: 1, confidence: 0.7, reason: "integration_test" },
        currentBarTs: new Date().toISOString(),
      },
      pg as never, // el shim implementa la misma interfaz mínima que dispatchTradovate consume
    );

    expect(result.ok).toBe(true);
    expect(result.action).toBe("shadow_logged");

    const { data: signals } = await pg.from("cme_signals").select("*").eq("cme_account_id", testAccountId);
    expect((signals as unknown[]).length).toBe(1);
  });
});
```

- [ ] **Step 2: Correr el test, confirmar que pasa**

```bash
cd /c/Users/rivej/Documents/alphalog-pwa
npx vitest run src/lib/cme/__tests__/tradovate.integration.test.ts
```

Expected: 1/1 PASS contra el Postgres real. Si falla por incompatibilidad
de tipos entre el shim y lo que `dispatchTradovate` espera de `svc`
(`SupabaseClient`), ese es exactamente el tipo de error que este test
existe para atrapar — ajustar el shim o la firma de `dispatchTradovate`
según corresponda, no forzar un cast.

- [ ] **Step 3: Commit**

```bash
git add src/lib/cme/__tests__/tradovate.integration.test.ts
git commit -m "test(cme): agrega test de integración contra Postgres real (no solo mocks)"
```

---

## Task 11: Ajustes de infraestructura del host (Ajustes #9, #10) — controller-executed

**Files:** ninguno (paso operativo directo, sin código).

- [ ] **Step 1: Fijar techo de memoria de WSL2 (Ajuste #9)**

```powershell
@"
[wsl2]
memory=20GB
processors=6
"@ | Out-File -FilePath "$env:USERPROFILE\.wslconfig" -Encoding utf8
wsl --shutdown
```

Verificar que Docker Desktop vuelve a arrancar bien después (`docker ps`).

- [ ] **Step 2: Programar limpieza de blobs huérfanos de Ollama (Ajuste #10)**

Reusar el mismo mecanismo de tarea programada ya usado para
`coinarb-50x-first-trade-watch` (ver memoria: "Disk cleanup: ollama +
docker" para el procedimiento exacto de identificar blobs no referenciados
por manifests antes de borrar) — crear una tarea programada semanal, no
diaria, dado que el crecimiento de este problema es lento.

---

## Task 12: Verificación final + limpieza (spec, sección "Verificación")

**Files:** ninguno (paso operativo).

- [ ] **Step 1: Suite completa**

```bash
cd /c/Users/rivej/Documents/alphalog-pwa
npx tsc --noEmit
npx vitest run
```

Expected: sin errores de tipos, toda la suite en verde.

- [ ] **Step 2: Smoke-test manual de punta a punta**

```bash
cd /c/Users/rivej/Documents/lattice-server
set -a && source .env && set +a
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" lattice-server-postgres-1 \
  psql -U "$POSTGRES_USER" -d alphalog_bots -c "
INSERT INTO algo_cme_accounts (user_id, account_type, provider_name, account_number, is_paper)
VALUES ('304a1a34-36a9-4a75-ae52-3023409932f0', 'propfirm', 'Apex', 'SMOKE-TEST', true)
RETURNING id;
"
```

Con el `id` devuelto, correr manualmente el flujo de `dispatchSignal` en
modo `shadow` (o confiar en el test de integración de Task 10, que ya cubre
esto) y confirmar en `cme_signals` que la fila quedó bien escrita.

- [ ] **Step 3: Confirmar los crons no-op silenciosos**

```bash
curl -X POST -H "x-cron-secret: $(grep CRON_SECRET .env | cut -d= -f2)" https://alphalog.io/api/cron/cme/position-sync
curl -X POST -H "x-cron-secret: $(grep CRON_SECRET .env | cut -d= -f2)" https://alphalog.io/api/cron/cme/risk-monitor
curl -X POST -H "x-cron-secret: $(grep CRON_SECRET .env | cut -d= -f2)" https://alphalog.io/api/cron/cme/equity-sync
curl -X POST -H "x-cron-secret: $(grep CRON_SECRET .env | cut -d= -f2)" https://alphalog.io/api/cron/cme/connection-heartbeat
```

Expected: cada uno responde `200` con `{"synced": 0}` o equivalente
no-op (más la fila de prueba del Step 2, si sigue viva).

- [ ] **Step 4: Limpiar la fila de prueba**

```bash
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" lattice-server-postgres-1 \
  psql -U "$POSTGRES_USER" -d alphalog_bots -c "
DELETE FROM cme_signals WHERE cme_account_id IN (SELECT id FROM algo_cme_accounts WHERE account_number = 'SMOKE-TEST');
DELETE FROM algo_cme_accounts WHERE account_number = 'SMOKE-TEST';
"
```

---

## Self-Review

**Cobertura del spec:** las 4 secciones del spec (Arquitectura, Componentes,
Manejo de errores, Verificación) están cubiertas por las Tasks 1-8 y 12. Los
18 ajustes/adiciones están cubiertos: #1→Task 8, #2→Task 1, #3→Task 1,
#4→Task 3, #5→Task 6, #6→Task 9, #7→Tasks 4+9, #8→Task 9, #9→Task 11,
#10→Task 11, #11→Task 4, #12→fuera de este plan (depende del sub-proyecto 2,
anotado como backlog), #13→Task 9, #14→Task 9, #15→Task 10, #16→Task 1
(índices), #17→Task 9, #18→Task 6.

**Hueco encontrado en el self-review:** el Ajuste #12 (extender el patrón de
vigilancia de primera operación a la cuenta CME real) depende de que exista
una cuenta real conectada — eso es sub-proyecto 2, no este plan. Se deja
explícitamente marcado como **no cubierto acá, backlog para el sub-proyecto 2**
en vez de forzarlo en una tarea sin sentido.

**Escaneo de placeholders:** ninguno encontrado, salvo la nota explícita en
Task 4/Step 5 sobre `getCurrentUser` (marcada como "confirmar antes de
escribir", no un placeholder de contenido faltante — es una instrucción de
verificación necesaria porque el nombre real del helper de sesión no se
confirmó durante la investigación de este plan).
