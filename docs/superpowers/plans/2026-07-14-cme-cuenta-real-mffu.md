# Sub-proyecto 2: Conectar cuenta real (MyFundedFutures/Tradovate) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the account-creation gap left by the CME/Tradovate Postgres migration (sub-proyecto 1) so a user can actually create and connect a real MyFundedFutures/Tradovate account, then document the manual empirical validation steps to run it end-to-end in shadow mode.

**Architecture:** The Tradovate execution engine (auth, order placement, dispatch, shadow/live mode, kill-switch) already exists and is deployed. The only code gap is that account *creation* (`algo_cme_accounts`) was never updated when that table moved from Supabase to lattice-server's Postgres — `NewStrategyWizard.client.tsx` still writes directly to Supabase via the client-side SDK, which no longer has this table's real data. This plan adds the missing `POST` API route (following the exact pattern of the already-migrated `cme_risk_configs` POST route) and repoints the wizard's two `algo_cme_accounts` calls (list + create) through the API instead of a stale direct Supabase write. It then documents the manual runbook for the user to connect a real account and validate shadow-mode operation — no task in this plan sets `DISPATCH_MODE=live` or places a real order.

**Tech Stack:** Next.js API routes, `getPgClient()` (`src/lib/pg/client.ts`), Zod, Vitest (real Postgres for the route test, mocked Supabase auth only), React Testing Library for the component test.

## Global Constraints

- Never place a real order or set `DISPATCH_MODE=live` as part of any task in this plan — that is a separate, explicit user-authorized action outside this plan's scope (per `docs/superpowers/specs/2026-07-14-cme-cuenta-real-mffu-design.md`).
- All new DB access goes through `getPgClient()` (`src/lib/pg/client.ts`), never a direct client-side Supabase call, for the `algo_cme_accounts` table — that table lives on lattice-server's Postgres (`alphalog_bots` DB) since sub-proyecto 1.
- Tests against Postgres-backed code use the real database (`ALPHALOG_PG_URL`), not mocks — established convention from sub-proyecto 1 (Ajuste #15). Only Supabase auth (`createClient().auth.getUser()`) is mocked in route tests.
- `provider_name` for `account_type = 'propfirm'` is constrained by a DB `CHECK` to `'Apex' | 'Lucid Trading' | 'MyFundedFutures' | 'Tradeify'` (`lattice-server/data/alphalog/schema.sql:374-376`) — do not duplicate this whitelist in Zod; let the DB reject invalid combinations and surface the error message, matching the existing pattern in `src/app/api/cme/risk-config/route.ts`.
- Test user id for real-Postgres CME tests: `304a1a34-36a9-4a75-ae52-3023409932f0` (already used across `src/lib/pg/__tests__/client.test.ts` and `src/lib/cme/__tests__/tradovate.integration.test.ts` — reuse it, don't invent a new one).

---

### Task 1: `POST /api/intelligence/algorithms/cme-accounts`

**Files:**
- Modify: `src/app/api/intelligence/algorithms/cme-accounts/route.ts` (currently has only `GET`)
- Test: `src/app/api/intelligence/algorithms/cme-accounts/__tests__/route.test.ts` (new)

**Interfaces:**
- Consumes: `getPgClient()` from `src/lib/pg/client.ts` (`.from('algo_cme_accounts').insert(...).select(...).single()` — already supported by the shim).
- Produces: `POST` handler returning `{ data: { id, label, provider_name, account_number, account_type, is_paper, funded_amount, max_daily_loss, max_trailing_dd } }` on `201`, `{ error }` on `400`/`401`/`500` — consumed by Task 2's wizard fix.

- [ ] **Step 1: Write the failing test**

Create `src/app/api/intelligence/algorithms/cme-accounts/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, afterEach, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import { getPgClient } from "@/lib/pg/client";

const TEST_USER_ID = "304a1a34-36a9-4a75-ae52-3023409932f0";

const { getUserMock } = vi.hoisted(() => ({ getUserMock: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: getUserMock } }),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let POST: any;
beforeAll(async () => {
  const mod = await import("../route");
  POST = mod.POST;
});

describe("POST /api/intelligence/algorithms/cme-accounts — integración con Postgres real", () => {
  let createdId: string | undefined;

  afterEach(async () => {
    if (!createdId) return;
    const pg = getPgClient();
    await pg.from("algo_cme_accounts").delete().eq("id", createdId);
    createdId = undefined;
  });

  it("crea una cuenta propfirm real en Postgres", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: TEST_USER_ID } } });

    const req = new NextRequest("http://localhost/api/intelligence/algorithms/cme-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        account_type: "propfirm",
        provider_name: "MyFundedFutures",
        account_number: "TEST-CREATE-ROUTE",
        label: "MFFU Eval",
        funded_amount: 150000,
        max_daily_loss: 1500,
        is_paper: true,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.provider_name).toBe("MyFundedFutures");
    createdId = body.data.id;

    const pg = getPgClient();
    const { data: rows } = await pg
      .from("algo_cme_accounts")
      .select("*")
      .eq("id", createdId as string);
    expect((rows as unknown[]).length).toBe(1);
    expect((rows as { user_id: string }[])[0].user_id).toBe(TEST_USER_ID);
  });

  it("rechaza sin autenticación", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const req = new NextRequest("http://localhost/api/intelligence/algorithms/cme-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account_type: "broker", provider_name: "IBKR", account_number: "X" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("rechaza payload inválido (account_number vacío)", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: TEST_USER_ID } } });
    const req = new NextRequest("http://localhost/api/intelligence/algorithms/cme-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account_type: "broker", provider_name: "IBKR", account_number: "" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
set -a && source .env.local && set +a && npx vitest run src/app/api/intelligence/algorithms/cme-accounts/__tests__/route.test.ts
```

Expected: FAIL — `mod.POST` is `undefined` (no `POST` export exists yet in `route.ts`).

- [ ] **Step 3: Implement the POST handler**

Modify `src/app/api/intelligence/algorithms/cme-accounts/route.ts` — add these imports and the `POST` handler **before** the existing `GET`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPgClient } from '@/lib/pg/client';
import { z } from 'zod';

const createSchema = z.object({
  account_type: z.enum(['propfirm', 'broker']),
  provider_name: z.string().min(1),
  account_number: z.string().min(1),
  label: z.string().trim().optional().nullable(),
  funded_amount: z.number().nonnegative().optional().nullable(),
  max_daily_loss: z.number().nonnegative().optional().nullable(),
  max_trailing_dd: z.number().nonnegative().optional().nullable(),
  is_paper: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const pg = getPgClient();
  const { data, error } = await pg
    .from('algo_cme_accounts')
    .insert({
      user_id: user.id,
      account_type: parsed.data.account_type,
      provider_name: parsed.data.provider_name,
      account_number: parsed.data.account_number,
      label: parsed.data.label ?? null,
      funded_amount: parsed.data.funded_amount ?? null,
      max_daily_loss: parsed.data.max_daily_loss ?? null,
      max_trailing_dd: parsed.data.max_trailing_dd ?? null,
      is_paper: parsed.data.is_paper,
    })
    .select('id, label, provider_name, account_number, account_type, is_paper, funded_amount, max_daily_loss, max_trailing_dd')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data }, { status: 201 });
}

export async function GET(req: NextRequest) {
```

(The existing `GET` function body and its closing brace stay unchanged — only the imports above it and the new `POST` function are inserted before it. Remove the now-duplicate original `import { NextRequest, NextResponse } from 'next/server'; import { createClient } from '@/lib/supabase/server'; import { getPgClient } from '@/lib/pg/client';` lines that used to precede `GET` directly, since they're now above `POST` instead.)

- [ ] **Step 4: Run test to verify it passes**

```bash
set -a && source .env.local && set +a && npx vitest run src/app/api/intelligence/algorithms/cme-accounts/__tests__/route.test.ts
```

Expected: 3/3 PASS. (Requires `ALPHALOG_PG_URL` in `.env.local` pointing at a real Postgres with the CME schema — already set up from sub-proyecto 1.)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/intelligence/algorithms/cme-accounts/route.ts src/app/api/intelligence/algorithms/cme-accounts/__tests__/route.test.ts
git commit -m "feat(cme): agrega POST para crear cuentas prop-firm/broker"
```

---

### Task 2: Fix `NewStrategyWizard.client.tsx`'s stale direct Supabase calls

**Files:**
- Modify: `src/components/intelligence/algorithms/NewStrategyWizard.client.tsx:733-753` (list fetch) and `:829-856` (`handleAddCmeAccount`)
- Test: `src/components/intelligence/algorithms/__tests__/NewStrategyWizard.cme-api.test.tsx` (new)

**Interfaces:**
- Consumes: `GET /api/intelligence/algorithms/cme-accounts` (already exists, unchanged), `POST /api/intelligence/algorithms/cme-accounts` (Task 1) — response shape `{ data }`.
- Produces: nothing consumed by later tasks — this is the last code task.

**Context:** `algo_cme_accounts` moved to lattice-server's Postgres in sub-proyecto 1, but this wizard was never updated — it still calls `createClient()` (`@/lib/supabase/browser`) directly for this one table, which no longer holds real data. `bots`, `bot_accounts`, and `algorithm_templates` remain on Supabase and are untouched by this task.

- [ ] **Step 1: Write the failing test**

Create `src/components/intelligence/algorithms/__tests__/NewStrategyWizard.cme-api.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const { fromMock, fetchMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  fetchMock: vi.fn(),
}));

vi.mock("@/lib/supabase/browser", () => ({
  createClient: () => ({ from: fromMock }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { NewStrategyWizard } from "../NewStrategyWizard.client";

function chain(result: { data: unknown }) {
  const proxy: Record<string, unknown> = {};
  const methods = ["select", "eq", "is", "order"];
  for (const m of methods) proxy[m] = () => proxy;
  proxy.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return proxy;
}

describe("NewStrategyWizard — cuentas CME vía API (no Supabase directo)", () => {
  beforeEach(() => {
    fromMock.mockReset();
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;

    fromMock.mockImplementation((table: string) => {
      if (table === "bots") return chain({ data: [{ id: "bot-1", name: "Bot" }] });
      if (table === "bot_accounts") return chain({ data: [] });
      if (table === "algorithm_templates") return chain({ data: [] });
      throw new Error(`unexpected sb.from(${table}) — algo_cme_accounts must go through fetch()`);
    });

    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/intelligence/algorithms/cme-accounts" && !init) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) });
      }
      if (url === "/api/intelligence/algorithms/cme-accounts" && init?.method === "POST") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: { id: "new-cme-1", provider_name: "MyFundedFutures", account_number: "MFFU-123", account_type: "propfirm", is_paper: true },
          }),
        });
      }
      throw new Error(`unexpected fetch(${url})`);
    });
  });

  it("carga cuentas CME vía fetch, no sb.from('algo_cme_accounts')", async () => {
    render(<NewStrategyWizard onClose={() => {}} />);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/intelligence/algorithms/cme-accounts");
    });
  });

  it("crea una cuenta CME vía POST fetch, no sb.from(...).insert()", async () => {
    render(<NewStrategyWizard onClose={() => {}} />);

    fireEvent.click(await screen.findByText("Futures CME"));
    fireEvent.click(await screen.findByText("Agregar cuenta nueva"));

    const numberInput = await screen.findByPlaceholderText("Número de cuenta (ej. U1234567)");
    fireEvent.change(numberInput, { target: { value: "MFFU-123" } });

    fireEvent.click(screen.getByText("Guardar cuenta"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/intelligence/algorithms/cme-accounts",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/components/intelligence/algorithms/__tests__/NewStrategyWizard.cme-api.test.tsx
```

Expected: FAIL with `Error: unexpected sb.from(algo_cme_accounts)` — confirms the wizard still calls Supabase directly for this table.

- [ ] **Step 3: Fix the list fetch**

In `src/components/intelligence/algorithms/NewStrategyWizard.client.tsx`, in the `useEffect` around line 733, replace:

```tsx
      sb.from('algo_cme_accounts').select('*').is('deleted_at', null),
```

with:

```tsx
      fetch('/api/intelligence/algorithms/cme-accounts').then((r) => r.json()),
```

(Leave the surrounding `Promise.all([...])` array structure, the `sb.from('bots')`/`sb.from('bot_accounts')`/`sb.from('algorithm_templates')` lines, and the `.then(([botsRes, accsRes, cmeRes, tmplRes]) => {...})` callback body unchanged — `cmeRes` already becomes `{ data: [...] }` either way, so `setCmeAccounts((cmeRes.data ?? []) as CmeAccount[])` needs no change.)

- [ ] **Step 4: Fix `handleAddCmeAccount`**

Replace the whole function body (around line 829):

```tsx
  async function handleAddCmeAccount() {
    if (!newCmeNumber.trim()) { toast.error('El número de cuenta es obligatorio'); return; }
    setAddingCmeAccount(true);
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { toast.error('No autenticado'); setAddingCmeAccount(false); return; }
    const { data, error } = await sb.from('algo_cme_accounts').insert({
      user_id:         user.id,
      account_type:    newCmeType,
      provider_name:   newCmeProvider,
      account_number:  newCmeNumber.trim(),
      label:           newCmeLabel.trim() || null,
      funded_amount:   newCmeFunded    ? Number(newCmeFunded)    : null,
      max_daily_loss:  newCmeMaxLoss   ? Number(newCmeMaxLoss)   : null,
      max_trailing_dd: newCmeTrailingDD ? Number(newCmeTrailingDD) : null,
    }).select('*').single();
    if (error) {
      toast.error('Error al crear cuenta: ' + error.message);
    } else if (data) {
      setCmeAccounts((prev) => [...prev, data as CmeAccount]);
      setCmeAccountId(data.id);
      setShowAddCmeAccount(false);
      setNewCmeNumber(''); setNewCmeLabel('');
      setNewCmeFunded(''); setNewCmeMaxLoss(''); setNewCmeTrailingDD('');
      toast.success('Cuenta CME guardada y seleccionada');
    }
    setAddingCmeAccount(false);
  }
```

with:

```tsx
  async function handleAddCmeAccount() {
    if (!newCmeNumber.trim()) { toast.error('El número de cuenta es obligatorio'); return; }
    setAddingCmeAccount(true);
    const res = await fetch('/api/intelligence/algorithms/cme-accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account_type:    newCmeType,
        provider_name:   newCmeProvider,
        account_number:  newCmeNumber.trim(),
        label:           newCmeLabel.trim() || null,
        funded_amount:   newCmeFunded    ? Number(newCmeFunded)    : null,
        max_daily_loss:  newCmeMaxLoss   ? Number(newCmeMaxLoss)   : null,
        max_trailing_dd: newCmeTrailingDD ? Number(newCmeTrailingDD) : null,
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      const message = typeof body.error === 'string' ? body.error : 'No se pudo guardar la cuenta';
      toast.error('Error al crear cuenta: ' + message);
    } else {
      setCmeAccounts((prev) => [...prev, body.data as CmeAccount]);
      setCmeAccountId(body.data.id);
      setShowAddCmeAccount(false);
      setNewCmeNumber(''); setNewCmeLabel('');
      setNewCmeFunded(''); setNewCmeMaxLoss(''); setNewCmeTrailingDD('');
      toast.success('Cuenta CME guardada y seleccionada');
    }
    setAddingCmeAccount(false);
  }
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run src/components/intelligence/algorithms/__tests__/NewStrategyWizard.cme-api.test.tsx
```

Expected: 2/2 PASS. (This test was verified working against this exact fix during plan authoring — both the fix and the test are proven correct, not hypothetical.)

- [ ] **Step 6: Run the full test suite for this file's existing coverage (regression check)**

```bash
npx vitest run src/components/intelligence/algorithms/__tests__/NewStrategyButton.test.tsx
```

Expected: 3/3 PASS unchanged — this test stubs the whole wizard and doesn't exercise the CME path, confirming the fix didn't break the button's open/close behavior.

- [ ] **Step 7: Commit**

```bash
git add src/components/intelligence/algorithms/NewStrategyWizard.client.tsx src/components/intelligence/algorithms/__tests__/NewStrategyWizard.cme-api.test.tsx
git commit -m "fix(cme): la wizard usa la API (Postgres) para crear/listar cuentas CME, no Supabase directo"
```

---

### Task 3: Manual validation runbook (documentation only)

**Files:**
- Create: `docs/cme-cuenta-real-mffu-runbook.md`

**Interfaces:**
- Consumes: nothing (pure documentation).
- Produces: nothing consumed by code — this is the final task.

This task has no automated steps — it is a checklist document for the user to follow manually, in production, using their own real credentials (never pasted into an agent session). No task in this plan performs any of these steps automatically.

- [ ] **Step 1: Write the runbook**

Create `docs/cme-cuenta-real-mffu-runbook.md`:

```markdown
# Runbook: conectar y validar una cuenta real de MyFundedFutures

Este documento es una checklist manual. Ningún paso de acá se ejecuta
automáticamente — cada uno lo hacés vos, con tus propias credenciales,
directo en la app desplegada. Nunca pegues tu usuario/contraseña de
Tradovate en una sesión de agente/IA.

## 0. Requisito previo

- [ ] Deploy de este plan (Tareas 1-2) ya hecho en `alphalog-pwa` (Fly.io).
      (Es un paso separado, autorizado explícitamente por vos — no se hace
      solo al terminar el plan.)

## 1. Conseguir la cuenta y credenciales

- [ ] Cuenta de evaluación o fondeada de MyFundedFutures, operando sobre
      Tradovate.
- [ ] Usuario y contraseña de Tradovate para esa cuenta.
- [ ] (NO se necesita, salvo que el paso 2 falle) el add-on pago
      "API Access" de Tradovate — la investigación previa sugiere que el
      login usuario/contraseña normal alcanza para cuentas de prop firm.

## 2. Dar de alta la cuenta y conectar (paso go/no-go)

- [ ] En la app: New Strategy wizard → "Futures CME" → "Agregar cuenta
      nueva" → tipo "PropFirm" → proveedor "MyFundedFutures" → completar
      número de cuenta / fondeo / pérdida diaria → "Guardar cuenta".
- [ ] En el panel CME PropFirm: conectar la cuenta recién creada con tu
      usuario/contraseña real de Tradovate.
- [ ] **Resultado esperado**: la conexión queda en estado `connected`. Si
      falla con un error de autenticación, esa es la señal de que el
      mecanismo `cid=0`/`sec=''` no alcanza para esta cuenta — en ese caso,
      evaluar el add-on pago de Tradovate antes de seguir (no asumido por
      este plan).

## 3. Validar en modo shadow (sin arriesgar plata)

`DISPATCH_MODE` no está seteado en producción → modo `shadow` por default,
ningún paso de acá coloca una orden real.

- [ ] Confirmar que `/api/cme/connections` muestra `status: 'connected'`
      para la cuenta.
- [ ] Dejar correr un algoritmo real vinculado a esta cuenta (o esperar a
      que uno existente dispare una señal) y confirmar que aparece en
      `cme_signals` con `status: 'skipped'` y
      `reject_reason: 'shadow_mode'`.
- [ ] Activar manualmente el kill-switch desde el panel y confirmar que la
      conexión pasa a `paused`/similar.
- [ ] Confirmar que el cron `risk-monitor` no tira error al leer el equity
      real de la cuenta (revisar logs de Fly: `fly logs -a alphalog-pwa`).

## 4. Flip a modo live — SOLO con tu OK explícito, en otra conversación

Este paso está deliberadamente fuera de este plan y de este runbook como
acción automática. Cuando decidas dar este paso:

- [ ] Pedirlo explícitamente (ej. "flippeá a live la cuenta de MFFU").
- [ ] Se seteará `DISPATCH_MODE=live` como secret de Fly en `alphalog-pwa`
      únicamente en ese momento, con tamaño de posición chico a definir
      en esa conversación.
```

- [ ] **Step 2: Commit**

```bash
git add docs/cme-cuenta-real-mffu-runbook.md
git commit -m "docs(cme): runbook manual para conectar y validar cuenta real MFFU"
```
