# AlphaCore Specification

**Version**: 1.0.0  
**Created**: Sprint 11.1  
**Status**: Foundation Complete

---

## Overview

**AlphaCore** es el motor determinista de mutaciones para AlphaLog PWA. Garantiza que todas las operaciones CRUD (Create, Read, Update, Delete) sigan un conjunto de invariantes estrictos en toda la aplicación.

### Principios Fundamentales

1. **Determinismo**: Toda operación debe ser predecible y reproducible
2. **Visibilidad**: Create → Persist → Visible (siempre)
3. **Resilencia**: Offline-first con queue y retries
4. **Seguridad**: Anti-duplicados + validación + sanitización
5. **Observabilidad**: Logging completo con AlphaShield

---

## Invariantes Garantizados

### A) Create → Persist → Visible

**Regla**: Cuando el usuario crea una entidad, SIEMPRE debe:
1. Aparecer inmediatamente en la UI (optimistic update)
2. Persistirse en la base de datos (online) o en outbox (offline)
3. Ser visible en la lista/panel sin necesidad de refresh manual

**Implementación**:
- Optimistic update al cache de React Query
- Insert a Supabase (online) o outbox (offline)
- Invalidación automática de queries relacionadas
- Reconciliación de IDs temporales con IDs reales

**Ejemplo**: Crear una cuenta en TradeHub
```typescript
// Usuario hace click en "Create Account"
await createEntity({
  table: 'accounts',
  entityName: 'Account',
  module: 'tradehub',
  payload: { name: 'My Propfirm', category_id: '...' },
  optimistic: true,
  dedupe: { enabled: true, fields: ['user_id', 'name'] }
});

// Resultado:
// 1. Cuenta aparece en panel INMEDIATAMENTE (optimistic)
// 2. Se persiste en DB (o outbox si offline)
// 3. Query de cuentas se invalida y refetch
// 4. Usuario ve la cuenta en la lista SIN refresh
```

### B) Errores Visibles + Logging

**Regla**: Ningún error debe pasar silenciosamente.

**Implementación**:
- Todo error se muestra al usuario (toast/banner)
- Todo error se loggea en AlphaShield (app_logs)
- Fingerprint para deduplicación de errores
- Metadata sanitizada (sin tokens/secrets)

**Ejemplo**: Error al crear cuenta duplicada
```typescript
// Usuario intenta crear cuenta con nombre existente
// Sistema detecta duplicado (dedupe check)
// UI: "Ya existe una cuenta con ese nombre"
// AlphaShield: log con fingerprint='account_duplicate_name'
```

### C) Offline Outbox + Sync

**Regla**: Las escrituras offline NUNCA se pierden.

**Implementación**:
- Si offline: operación se encola en IndexedDB outbox
- Optimistic update en UI (usuario ve cambio)
- Al volver online: sync automático con retries=3
- Conflictos se detectan y muestran UI de resolución

**Ejemplo**: Crear trade offline
```typescript
// Usuario está offline
// Crea trade → outbox entry + optimistic update
// Usuario ve trade en lista
// Vuelve online → sync automático
// Trade se confirma en servidor
```

### D) Conflictos con Versionado

**Regla**: Conflictos se detectan y el usuario elige qué conservar.

**Implementación**:
- Detectar conflicto con `updated_at` o hash
- Mostrar UI: "Tu versión" vs "Servidor"
- Botones:
  - "Conservar mi versión" (overwrite)
  - "Conservar servidor" (discard local)
- Safe Mode si excede retries

**Ejemplo**: Editar cuenta offline mientras alguien más la editó
```typescript
// Conflicto detectado durante sync
// UI muestra modal:
// - Tu versión: { name: 'Account A', balance: 5000 }
// - Servidor: { name: 'Account A Updated', balance: 6000 }
// Usuario elige opción
```

### E) Anti-Duplicados Schema-Derived

**Regla**: Claves de deduplicación derivadas 100% del schema real.

**Implementación**:
- Parsear `supabase/migrations/*.sql` para UNIQUE constraints
- Si no hay constraint: derivar de campos NOT NULL + UI required
- Si incertidumbre: marcar como UNDETERMINED → NO bloquear, solo advertir
- Documentar en `docs/DEDUPE_KEYS.md`

**Ejemplo**: Accounts
```typescript
// Schema: UNIQUE(user_id, name_lower) WHERE deleted_at IS NULL
// Dedupe config:
{
  enabled: true,
  fields: ['user_id', 'name_lower'],
  source: 'UNIQUE_CONSTRAINT',
  strictMode: true // Bloquea insert si duplicado
}
```

---

## Arquitectura

### Componentes Principales

```
src/lib/alphacore/
├── moduleRegistry.ts    # Registry de módulos y tablas
├── types.ts             # Tipos base (BaseFields, MutationMetadata, etc.)
├── contracts.ts         # Contratos de entidades (schema-derived)
├── queryKeys.ts         # Factory de query keys para React Query
├── mutations.ts         # [FASE 2] Wrapper de mutaciones
├── dedupe.ts            # [FASE 4] Anti-duplicados
└── offlineBridge.ts     # [FASE 3] Bridge online/offline
```

### Módulos Registrados

| Module     | Route                  | Tables                                    |
|------------|------------------------|-------------------------------------------|
| logs       | /dashboard/logs        | categories, tags, logs, log_attachments   |
| terminal   | /dashboard/terminal    | instruments, terminal_news, terminal_events, terminal_evidence_reports |
| tradehub   | /dashboard/tradehub    | account_categories, accounts, setups, trades, tv_analysis_evidence, weekly_reports |
| journal    | /dashboard/journal     | logs (reuses logs table)                  |
| tradermap  | /dashboard/tradermap   | tradermap_user_level, tradermap_goals, tradermap_quarters |
| treasury   | /dashboard/treasury    | treasury_configs, treasury_wallets, treasury_transactions, treasury_budgets, treasury_payouts, treasury_calendar_events |
| business   | /dashboard/business    | business_costs, business_milestones, business_sops, business_decision_tasks, business_llc_info |

### Subsecciones (Ejemplos)

**TradeHub**:
- accounts: account_categories, accounts
- newTradesLog: trades, setups
- evidenceVault: tv_analysis_evidence
- playbook: setups, trades (read-only stats)
- reports: weekly_reports, trades

**Treasury**:
- overview: treasury_configs, treasury_wallets, treasury_transactions
- milestone: treasury_configs
- cashflow: treasury_transactions, treasury_payouts
- calendario: treasury_calendar_events
- splits: treasury_configs
- umbral: treasury_configs
- antiDD: treasury_configs
- heatmap: treasury_transactions

**Business**:
- health: business_costs, trades
- kpis: business_costs, trades
- pl: business_costs, trades
- runway: business_costs, trades
- roadmap: business_milestones
- sops: business_sops, business_sop_items, business_sop_runs
- decisions: business_decision_tasks
- llc: business_llc_info

---

## Query Keys Estándar

**Estructura**:
```typescript
interface QueryKey {
  scope: 'list' | 'detail' | 'aggregate';
  module: ModuleName;
  table: string;
  subsection?: SubsectionName;
  filters?: Record<string, any>;
  entityId?: string;
}
```

**Ejemplos**:
```typescript
// Lista de cuentas
queryKeys.list('tradehub', 'accounts')
// => { scope: 'list', module: 'tradehub', table: 'accounts', filters: {} }

// Detalle de cuenta
queryKeys.detail('tradehub', 'accounts', '123e4567-...')
// => { scope: 'detail', module: 'tradehub', table: 'accounts', entityId: '...' }

// Aggregate de costos
queryKeys.aggregate('business', 'business_costs', { month: '2024-01' })
// => { scope: 'aggregate', module: 'business', table: 'business_costs', filters: {...} }
```

**Serialización (React Query)**:
```typescript
serializeKey(queryKeys.list('tradehub', 'accounts', { trash: false }))
// => ['list', 'tradehub', 'accounts', { trash: false }]
```

---

## Entity Contracts

Todos los contratos derivan directamente de `supabase/migrations/*.sql`.

**BaseFields** (presentes en TODAS las tablas):
```typescript
interface BaseFields {
  id: string; // UUID
  user_id: string; // FK auth.users
  created_at: string; // timestamptz
  updated_at: string; // timestamptz
  deleted_at: string | null; // soft-delete
  sort_index?: number; // ordenamiento flexible
}
```

**Ejemplo: Account**:
```typescript
interface Account extends BaseFields {
  name: string; // NOT NULL
  category_id: string; // NOT NULL, FK account_categories
  account_size?: number | null;
  current_balance?: number | null;
  operation_state?: string | null;
  phase_status?: string | null;
  role?: string | null;
  withdrawals_enabled: boolean; // DEFAULT true
}
```

**Regla CRÍTICA**: NO inventar campos. Si falta información:
- Marcar campo como `?` (opcional)
- Comentar `// TODO: verify in migration`
- Revisar migration para confirmar tipo y constraints

---

## Mutation Pipeline (FASE 2 - Pendiente)

**API Propuesta**:
```typescript
async function createEntity<T extends keyof EntityContractMap>(params: {
  table: T;
  entityName: string;
  module: ModuleName;
  subsection?: SubsectionName;
  payload: Partial<EntityContractMap[T]>;
  optimistic?: OptimisticConfig;
  dedupe?: DedupeConfig;
  queryKeyToInvalidate?: QueryKey;
}): Promise<MutationResult<EntityContractMap[T]>>

async function updateEntity<T extends keyof EntityContractMap>(params: {
  table: T;
  entityId: string;
  entityName: string;
  module: ModuleName;
  subsection?: SubsectionName;
  payload: Partial<EntityContractMap[T]>;
  optimistic?: OptimisticConfig;
  queryKeyToInvalidate?: QueryKey;
}): Promise<MutationResult<EntityContractMap[T]>>

async function softDeleteEntity<T extends keyof EntityContractMap>(params: {
  table: T;
  entityId: string;
  entityName: string;
  module: ModuleName;
  subsection?: SubsectionName;
  queryKeyToInvalidate?: QueryKey;
}): Promise<MutationResult<void>>
```

**Flujo**:
1. Pre-check: dedupe (si habilitado)
2. Optimistic update (si habilitado)
3. Supabase write (online) o outbox enqueue (offline)
4. OnSuccess:
   - Reconcile IDs (temp → real)
   - Invalidate queries
   - Log info
5. OnError:
   - Rollback optimistic
   - Log error (AlphaShield)
   - Show toast/banner
   - Manejo de 23505 (unique violation)

---

## Offline Outbox (FASE 3 - Pendiente)

**Schema (IndexedDB)**:
```typescript
interface OutboxEntry {
  id: string; // UUID
  operation: 'create' | 'update' | 'delete' | 'restore';
  table: string;
  payload: any;
  createdAt: number; // Date.now()
  retryCount: number;
  status: 'pending' | 'synced' | 'failed' | 'conflict';
  lastError?: string;
  fingerprint?: string;
  metadata: MutationMetadata;
}
```

**Sync Strategy**:
- Auto-sync al volver online (listener `window.addEventListener('online')`)
- Botón manual "Sync" en UI AlphaShield
- Retries = 3 (confirmado)
- Si excede retries → status='conflict' → UI de resolución

**Conflictos**:
- Comparar `updated_at` local vs servidor
- Si difieren: mostrar modal con ambas versiones
- Usuario elige:
  - Keep Local: overwrite servidor (si RLS permite)
  - Keep Server: descartar local
- Si Safe Mode activo: deshabilitar writes

---

## Anti-Duplicados (FASE 4 - Pendiente)

**Fuentes de Verdad** (en orden):
1. **UNIQUE INDEX/CONSTRAINT** en migrations → clave oficial
2. **Campos NOT NULL + UI required** → clave derivada
3. **Incertidumbre** → marcar UNDETERMINED, NO bloquear

**Ejemplo: Categories**:
```sql
-- Migration 002_logs_schema.sql
CREATE UNIQUE INDEX categories_user_name_uq 
  ON public.categories(user_id, name_lower) 
  WHERE deleted_at IS NULL;
```
```typescript
// Dedupe config
{
  table: 'categories',
  fields: ['user_id', 'name_lower'],
  source: 'UNIQUE_CONSTRAINT',
  strictMode: true
}
```

**Runtime Behavior**:
- `UNIQUE_CONSTRAINT`: pre-check SELECT + catch 23505
- `DERIVED_FROM_UI_DB`: pre-check SELECT
- `UNDETERMINED`: solo log warn, NO bloquear

**Documentación**: `docs/DEDUPE_KEYS.md` (FASE 4)

---

## AlphaShield Integration (FASE 5 - Pendiente)

**Logging**:
- Toda mutación loggea: info (success), warn (no crítico), error (crítico)
- Metadata:
  - `area`: ModuleName
  - `message`: descripción operación
  - `meta`: payload sanitizado (sin secrets)
  - `fingerprint`: hash deduplicación
  - `url`, `user_agent` (cliente)

**Safe Mode**:
- Trigger: 3 errores críticos en 60s
- Efecto:
  - `localStorage.setItem('safeMode', 'true')`
  - Banner discreto en UI: "Safe Mode activo"
  - Deshabilitar botones Create/Save (wrapper respeta check)
  - Botón "Salir de Safe Mode"

**UI** (`/dashboard/logs/system`):
- Top Bugs (7 días, group by fingerprint)
- Copy Debug Bundle (últimos 20 errores + estado)
- Copy Codex Fix Prompt (template para Claude/GPT)
- Sync Outbox button
- Push subscription status

---

## Testing Checklist (FASE 7 - Pendiente)

### AlphaCore Tests

- [ ] **Crear cuenta** → aparece inmediatamente en panel
- [ ] **Crear journal** → aparece inmediatamente en lista
- [ ] **Offline create** → outbox + sync cuando vuelve online
- [ ] **Conflicto** → UI muestra versión local vs servidor
- [ ] **Safe Mode** → se activa tras 3 errores, bloquea writes
- [ ] **Dedupe** → bloquea duplicado cuando strictMode=true
- [ ] **Error handling** → toast visible + log AlphaShield
- [ ] **Optimistic rollback** → revierte cambio si falla

### Integration Tests

- [ ] TradeHub → Accounts CRUD
- [ ] TradeHub → New Trades Log CRUD
- [ ] Journal PT → validación mood + tags + text
- [ ] Treasury → Calendario create offline
- [ ] Business → Milestone create

---

## Roadmap

### ✅ FASE 0-1: Foundation (Sprint 11.1)
- [x] Leer docs (AGENTS.md, APP_MAP.md, MIGRATION_PLAN.md)
- [x] Identificar rutas reales
- [x] Confirmar AlphaShield UI existe
- [x] Crear moduleRegistry.ts
- [x] Crear types.ts
- [x] Crear contracts.ts (schema-derived)
- [x] Crear queryKeys.ts
- [x] Crear docs/ALPHACORE_SPEC.md

### 🔄 FASE 2: Mutation Pipeline (Sprint 11.2)
- [ ] Crear mutations.ts (createEntity, updateEntity, softDeleteEntity)
- [ ] Implementar optimistic updates
- [ ] Implementar error handling + AlphaShield logging
- [ ] Implementar dedupe pre-check (básico)
- [ ] Migrar 1 flujo piloto: Accounts "Create account"
- [ ] Validar: crear cuenta → aparece sin refresh

### 🔄 FASE 3: Offline + Conflicts (Sprint 11.3)
- [ ] Crear offline/idb.ts (IndexedDB helper)
- [ ] Crear offline/outbox.ts (outbox schema + CRUD)
- [ ] Crear offlineBridge.ts (online/offline router)
- [ ] Implementar sync automático + manual
- [ ] Implementar UI de conflictos (modal versionado)
- [ ] Migrar 1 flujo piloto: TradeHub New Trades Log offline
- [ ] Validar: offline create → outbox → sync → confirm

### 🔄 FASE 4: Anti-Duplicados (Sprint 11.4)
- [ ] Parsear migrations para UNIQUE constraints
- [ ] Generar dedupe.ts con claves derivadas
- [ ] Documentar docs/DEDUPE_KEYS.md
- [ ] Implementar runtime dedupe checks
- [ ] Manejar error 23505 (unique violation)
- [ ] Validar: no permite duplicados donde hay constraint

### 🔄 FASE 5: AlphaShield Extensions (Sprint 11.5)
- [ ] Asegurar sanitización en logs (sin secrets)
- [ ] Implementar Safe Mode automático (3 errores / 60s)
- [ ] UI Top Bugs (group by fingerprint, 7 días)
- [ ] UI Copy Debug Bundle
- [ ] UI Copy Codex Fix Prompt
- [ ] UI Sync Outbox button
- [ ] Validar: Safe Mode bloquea writes correctamente

### 🔄 FASE 6: Journal PT Validation (Sprint 11.6)
- [ ] Validación UI: mood + tags + text (obligatorios)
- [ ] Integrar createEntity wrapper
- [ ] Validar: no permite guardar sin campos requeridos

### 🔄 FASE 7: QA (Sprint 11.6)
- [ ] Crear script `verify:all` (lint + build + e2e + lhci)
- [ ] Actualizar TESTING_CHECKLIST.md
- [ ] Actualizar KNOWN_ISSUES.md
- [ ] Ejecutar full QA
- [ ] Fix issues encontrados

---

## Criterios de Aceptación (Global)

- [ ] Crear→Guardar→Mostrar funciona en: Accounts + Journal + 1 piloto TradeHub/Treasury
- [ ] Offline writes funcionan con outbox + sync + retries=3
- [ ] Conflictos muestran UI versionado (Tu vs Servidor)
- [ ] Dedupe existe y es schema-derived; docs/DEDUPE_KEYS.md
- [ ] AlphaShield muestra Top Bugs + Debug Bundle + Fix Prompt + Safe Mode
- [ ] verify:all corre local (o scripts parciales con output claro)

---

## Rollback Plan

**Archivos a revertir**:
```bash
git restore src/lib/alphacore/*
git restore src/lib/offline/*
git restore src/lib/alphashield/* # Si modificado
git restore docs/ALPHACORE_SPEC.md
git restore docs/DEDUPE_KEYS.md
git restore src/app/dashboard/tradehub/* # Si migrado
git restore src/components/tradehub/* # Si migrado
```

**Comando rápido**:
```bash
git revert <commit-hash>
# o
git restore .
```

---

## Referencias

- [AGENTS.md](../../AGENTS.md): Reglas generales del proyecto
- [APP_MAP.md](../../APP_MAP.md): Pantallas y módulos
- [MIGRATION_PLAN.md](../../MIGRATION_PLAN.md): Plan de migración Base44 → Next.js
- [Supabase Migrations](../../supabase/migrations/): Schema real de DB
- [AlphaShield Logger](../alphashield/logger.ts): Sistema de logging existente
- [Safe Mode](../alphashield/safeMode.ts): Sistema Safe Mode existente

---

**Documento vivo**: Este spec se actualiza conforme avanzan las fases.
