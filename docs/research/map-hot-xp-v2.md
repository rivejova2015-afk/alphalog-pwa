# Map Hot XP / Gamification — V2 Architecture Research

> Read-only research + design. NO production code, NO migrations written.
> Author: engineering session 2026-06-10. Audience: single user (the owner).

---

## RESUMEN EJECUTIVO

El sistema de XP/niveles legacy de TraderMap está **muerto en la UI**: ninguna pantalla
consume `/api/tradermap/level`, y el único endpoint que lo lee devuelve un registro que
**nunca se incrementa** (la RPC `upsert_user_level_state` solo inicializa a level 1 / xp 0).
El motor `progressEngine.ts` sí corre en cada cierre de trade (`onTradeClosedSaved`), pero
escribe a `progress_events` + `progress_map_state` — tablas de un sub-sistema (`progress_map_*`)
cuyas pantallas ya fueron redirigidas a `/map-hot/*` vía `next.config.ts`. Es decir: trabajo
de cómputo que no se renderiza en ningún lado. Map Hot, por su parte, es puramente de
seguimiento de objetivos (goals con `current_value` editado **a mano**, milestones por
trimestre, snapshots diarios). No hay solapamiento funcional: Map Hot = tracking de metas;
TraderMap XP = gamificación de actividad. Son conceptos distintos.

**Recomendación: Opción B — XP nuevo, liviano, nativo de Map Hot.** El motor legacy
(`progressEngine.ts`, ~635 líneas) está sobre-diseñado para 1 usuario (15 niveles con misiones,
thresholds, fail-safe/rebuild, heat states, pending-sync) y acoplado a `progress_ecosystem_config`
que casi seguro no está configurado en prod (de ahí que `onTradeClosedSaved` haga short-circuit).
Resucitarlo (Opción A) arrastra deuda y complejidad que contradice el valor "no over-engineering".
Un sistema nuevo de ~1 tabla de eventos + ~1 de estado, con fórmula de niveles simple
(`level = floor(sqrt(xp/100))+1`) y eventos atados a milestones de Map Hot (completar milestone,
completar goal, alcanzar pace), entrega el 90% del valor de gamificación con el 15% de la
superficie de código. Se renderiza como un badge de nivel + barra de XP en `/map-hot/progress`.
Se integra con el outbox AlphaCore (XP otorgado al drenar la mutación que cierra el goal/milestone)
y respeta RLS owner-only + tabla de eventos inmutable (sin soft-delete, igual que `progress_events`).

**Parking lot:** deprecar y dropear `progress_*` + `user_level_state` + `progressEngine.ts` +
`/api/tradermap/*` en la misma migration que introduce el XP nuevo (son código muerto verificable).
El esfuerzo total es bajo (1 migration + ~3 archivos + 1 widget); plan en 3 fases abajo.

---

## 1. Diagnóstico

### 1.1 Qué hace TraderMap legacy (XP/niveles)

**Configuración de XP** (`src/lib/tradermap/xpConfig.ts:6-11`):
```
trade_complete: 10
goal_complete: 500
```
Solo dos tipos de recompensa están definidos como constantes; `goal_complete` ni siquiera se usa.

**Motor de progreso** (`src/lib/tradermap/progressEngine.ts`):
- `onTradeClosedSaved(supabase, userId, trade)` (`progressEngine.ts:551-634`) — hook llamado
  cuando se cierra un trade. Flujo:
  1. Verifica `status === 'closed'` o `exit_date` presente (`:561-565`).
  2. Lee `progress_ecosystem_config` (tabla del sub-sistema `progress_map_*`, migration 025).
     **Si no hay `core_account_id`, retorna `null` y no hace nada** (`:567-573`).
  3. Si el trade pertenece a una cuenta core/satélite, inserta una fila en `progress_events`
     con `xp_delta = 10` (dedup por `ref_id`) (`:588-609`).
  4. Llama `recomputeProgress` (`:611-612`).
- `recomputeProgress(supabase, userId)` (`progressEngine.ts:313-549`) — recalcula 16 métricas
  (winrate, consistency, confidence, streak, drawdown, flow, precision, etc.), evalúa misiones
  por nivel contra thresholds, calcula 15 niveles con estados (`locked`/`active`/`completed`/
  `fail_safe`/`rebuild`), heat state (`green`/`amber`/`red`), y hace upsert a
  `progress_map_state` + `progress_level_state`. **El XP que escribe a `progress_map_state`
  es `xp_total: metrics.closed_trades * 10`** (`:510`) — recomputado, no acumulado.

**Endpoint de nivel** (`src/app/api/tradermap/level/route.ts`):
- `GET /api/tradermap/level` lee `user_level_state` (`:20-24`).
- Si no existe el registro, llama la RPC `upsert_user_level_state` que **inserta level=1,
  xp_total=0 y nunca más lo toca** (`008_tradermap_schema.sql:247-255`).

**Tablas que sobreviven** (migration `116_drop_tradermap_legacy.sql`):
- `user_level_state` (`008_tradermap_schema.sql:204-242`): `level`, `xp_total`, `streak_days`,
  `last_activity_date`. RLS owner-only. **Sin INSERT/incrementos en runtime.**
- `progress_events` (`008_tradermap_schema.sql:154-199`): event-sourced, inmutable (sin
  soft-delete, sin DELETE policy), `xp_delta`, `event_type` ∈ {trade, evidence, report,
  goal_complete, manual}.
- `progress_map_*` (migration 025): `progress_ecosystem_config`, `progress_map_state`,
  `progress_level_state`, `progress_map_levels`, `progress_map_thresholds`, `progress_pending_sync`.

### 1.2 Qué hace Map Hot hoy

- **Goals** (`map_hot_goals`, migration `109_map_hot_schema.sql:22-44`): `name`, `timeframe`
  ∈ {annual, quarterly, monthly, weekly}, `target_value`, `current_value`, `unit`, `status`
  ∈ {ON_TRACK, BELOW_PACE, EXCEEDED, WARNING}, `due_date`. Soft-delete. **`current_value` se
  edita a mano** desde el form (`GoalGrid.client.tsx:134-141` envía `current_value` del input;
  no hay cómputo automático desde trades). Status se deriva con `computeGoalStatus`
  (`src/lib/map-hot/goalStatus.ts:3-10`): EXCEEDED ≥100%, ON_TRACK ≥70%, BELOW_PACE ≥40%, else WARNING.
- **Goal links** (`map_hot_goal_links`, `:95-103`): N:N goals ↔ `algorithms`. Hard-delete.
- **Milestones** (`map_hot_milestones`, `:137-158`): trimestrales (`year`, `quarter`, `label`,
  `target_amount`, `status` ∈ {completed, active, upcoming}). 1 por (user, year, quarter).
  Status puede derivarse por fecha (`src/lib/map-hot/milestoneStatus.ts:11-23`).
- **Snapshots** (`map_hot_goal_snapshots`, migration 110): serie temporal diaria de
  `current_value` por goal, escrita por cron. Alimenta `GoalHistoryChart`.
- **UI**: `/map-hot/goals` (grid + CRUD), `/map-hot/progress` (donut + tabla + chart + at-risk),
  `/map-hot/planning` (milestones/annual vision). Nav en `Sidebar.client.tsx:45-51`.

### 1.3 ¿Se pisan? ¿El XP legacy está vivo o muerto?

**No se pisan conceptualmente.** Map Hot reemplazó a TraderMap **solo en goals/milestones**
(migration 116 ya dropeó `tradermap_goals` + `tradermap_goal_quarters`; tenían 0 filas en prod).
La gamificación (XP/niveles) **nunca tuvo equivalente en Map Hot**.

**El XP legacy está muerto en la UI.** Evidencia:
- Cero componentes consumen `/api/tradermap/level` (grep en `src/components` → 0 resultados).
- `user_level_state.xp_total` nunca se incrementa: solo lo inicializa la RPC a 0.
- `onTradeClosedSaved` (que sí corre en `trades/route.ts:311` y `trades/[id]/route.ts:187`)
  escribe a `progress_events` + `progress_map_state`, **no a `user_level_state`**, y además
  hace short-circuit si `progress_ecosystem_config.core_account_id` es null — lo cual es casi
  seguro el estado en prod (las pantallas `progress-map` ya no están en el nav; redirigidas a
  `/map-hot/*` en `next.config.ts:128,153-154`).
- Resultado: cómputo de XP/métricas que se persiste en tablas que ninguna pantalla lee.

**Conclusión:** hoy hay dos costos sin beneficio: (a) `onTradeClosedSaved` corre en el hot path
de creación/edición de trades sin renderizarse en ningún lado, y (b) 8 tablas + 1 motor de 635
líneas mantenidos como "parking lot" para una decisión nunca tomada.

---

## 2. Opciones arquitectónicas

### Opción A — Resucitar / portar el engine TraderMap

Reusar `progressEngine.ts` + `user_level_state` + `progress_events`, cablear nuevos eventos
de Map Hot (completar milestone/goal) al `progress_events` existente y exponer un widget.

**Pros:**
- Tablas ya existen, con RLS e inmutabilidad correctas.
- El patrón event-sourced (`progress_events`) es sólido y auditable.
- Dedup por `ref_id` ya implementado.

**Contras:**
- El motor está acoplado a `progress_ecosystem_config` + `progress_map_levels/thresholds/state`
  (sub-sistema de 6 tablas) que habría que configurar/mantener. Para 1 usuario es overkill masivo.
- `recomputeProgress` (235 líneas) calcula 16 métricas + 15 niveles con misiones + fail-safe/
  rebuild/heat — features que nadie pidió para Map Hot.
- `user_level_state` y `progress_map_state` tienen **dos fuentes de verdad de XP divergentes**
  (`user_level_state.xp_total` nunca escrito vs `progress_map_state.xp_total` recomputado). Heredar
  esa confusión es deuda.
- Correr `recomputeProgress` en cada cierre de trade es caro (múltiples queries) y ya está en el
  hot path sin valor; resucitarlo lo legitima.

### Opción B — XP nuevo, liviano, nativo de Map Hot (RECOMENDADA)

Tablas nuevas mínimas, fórmula de niveles simple, eventos atados a hitos de Map Hot
(no a cada trade). Detalle en sección 4.

**Pros:**
- Superficie mínima: ~2 tablas + ~1 helper puro + ~1 widget. Testeable con funciones puras
  (como `goalStatus.ts`/`milestoneStatus.ts` ya lo son).
- Eventos alineados a lo que el usuario realmente ve y celebra en Map Hot (completar metas/
  milestones), no a un proxy ruidoso (cada trade da 10 XP independiente de calidad).
- Acumulación correcta de XP (event-sourced sumado), una sola fuente de verdad.
- Encaja con offline-first: el XP se otorga server-side al persistir el evento de dominio que
  ya pasa por el outbox.

**Contras:**
- Es código nuevo (aunque poco) — hay que escribir migration + endpoints + UI.
- Duplica conceptualmente el patrón `progress_events` que ya existía (pero ese está muerto).

### Opción C — No hacer gamificación / posponer

Dropear el legacy muerto y no construir XP. Map Hot queda como tracking puro.

**Pros:**
- Cero código nuevo. Máxima simplicidad. Elimina el cómputo muerto del hot path de trades.
- Para 1 usuario dueño y disciplinado, la gamificación puede ser ruido (no hay competencia social).

**Contras:**
- Se pierde el feedback loop motivacional que justificaba TraderMap originalmente.
- "V2 con XP" quedaba como expectativa documentada; cerrar sin entregarlo es una decisión, no un default.

### Opción D — XP "derivado" sin tabla de estado (computed-on-read)

No persistir `xp_total`; calcular XP y nivel **en el momento de leer**, agregando sobre eventos
de dominio ya existentes (milestones `completed`, goals `EXCEEDED`). Una sola tabla de eventos
(o incluso ninguna si se deriva de `map_hot_milestones.status` + snapshots).

**Pros:**
- Sin tabla de estado que mantener sincronizada (no hay drift posible).
- Aún más simple que B si se deriva de datos existentes.

**Contras:**
- No captura eventos "puntuales" (ej. racha diaria, primer goal de la semana) que no dejan rastro
  en el estado actual de una tabla de dominio.
- Recalcular en cada lectura es barato para 1 usuario pero no escala a histórico largo sin un
  índice/materialización. Para "celebrar" un level-up necesitás saber el estado previo → requiere
  algo de persistencia de todos modos.

---

## 3. Recomendación

**Opción B (XP nuevo liviano), con la fase de derivación de la Opción D como atajo inicial.**

Razones, ponderadas para el contexto (1 usuario dueño, mobile-first PWA, anti-over-engineering):

1. **El legacy no es reutilizable con buena conciencia.** `progressEngine.ts` resuelve un problema
   de 15 niveles con misiones/thresholds/fail-safe que nadie tiene. Portarlo (A) es más trabajo de
   *entender y desacoplar* que escribir 80 líneas nuevas y claras.
2. **Eventos de calidad > eventos de volumen.** Dar XP por completar metas/milestones (lo que el
   usuario realmente persigue en Map Hot) es semánticamente correcto. Dar 10 XP por cada trade
   cerrado (legacy) premia actividad, no progreso — anti-patrón para un trader que debe operar menos.
3. **Una sola fuente de verdad.** El legacy tiene dos columnas `xp_total` que divergen. Empezar
   limpio elimina esa clase de bug.
4. **Encaja en el patrón del proyecto.** `goalStatus.ts`/`milestoneStatus.ts` son helpers puros
   testeados; la fórmula de niveles vive igual, con tests directos. RLS owner-only + tabla de
   eventos inmutable replican `progress_events` sin su equipaje.
5. **Mobile-first:** un badge de nivel + barra de XP en `/map-hot/progress` es ligero y no requiere
   el dashboard de 16 métricas del legacy.

Si se quiere el mínimo absoluto primero, **arrancar con D** (derivar XP de milestones completados
+ goals EXCEEDED, computed-on-read) y promover a B (persistir eventos) solo cuando se quiera
celebrar level-ups o premiar eventos puntuales. Ambas comparten el mismo helper de niveles.

**Si el dueño decide que la gamificación no aporta → Opción C** es perfectamente válida y la más
barata; en ese caso el único trabajo es la limpieza del parking lot (sección 5).

---

## 4. Diseño del XP nuevo (si se construye)

### 4.1 Modelo de datos — **MIGRATION NUEVA** (propuesta, no escrita)

> Sigue el patrón canónico: RLS `auth.uid() = user_id`, índices parciales, comentarios.

**Tabla `map_hot_xp_events`** (event-sourced, inmutable — espejo conceptual de `progress_events`):
```
id            uuid pk default gen_random_uuid()
user_id       uuid not null references auth.users(id) on delete cascade
event_type    text not null   -- check in ('goal_completed','milestone_completed',
                              --            'goal_on_pace','weekly_streak','manual')
ref_table     text            -- 'map_hot_goals' | 'map_hot_milestones' | null
ref_id        uuid            -- id de la fila origen (para dedup)
xp_delta      int  not null default 0   -- check (xp_delta >= 0)
metadata      jsonb
occurred_at   timestamptz not null default now()
created_at    timestamptz not null default now()
-- SIN deleted_at: inmutable. RLS: SELECT + INSERT owner-only, sin UPDATE/DELETE.
-- Dedup: unique index parcial (user_id, event_type, ref_id) where ref_id is not null.
```

**Tabla `map_hot_xp_state`** (1 fila por usuario — espejo de `user_level_state`):
```
user_id          uuid pk references auth.users(id) on delete cascade
xp_total         int not null default 0   -- check >= 0
level            int not null default 1   -- derivado de xp_total, cacheado
last_event_at    timestamptz
updated_at       timestamptz not null default now()
-- RLS owner-only SELECT/UPDATE. INSERT vía upsert server-side.
```
> Alternativa Opción D: omitir `map_hot_xp_state` y derivar `xp_total = sum(xp_delta)` on-read.
> Mantener la tabla de estado solo si se quiere detectar transición de nivel (level-up toast).

### 4.2 Eventos y valores de XP

| Evento | Disparador | XP | Dedup |
|---|---|---|---|
| `goal_completed` | goal pasa a `EXCEEDED` (current ≥ target) | 100 × peso por timeframe* | por `ref_id` (goal) |
| `milestone_completed` | `map_hot_milestones.status` → `completed` con target alcanzado | 250 | por `ref_id` (milestone) |
| `goal_on_pace` | goal entra a `ON_TRACK` desde estado inferior | 20 | por `ref_id` (1ª vez) |
| `weekly_streak` | ≥1 update de goal en N semanas consecutivas | 30 | por semana ISO |
| `manual` | ajuste manual (debug/import) | variable | sin dedup |

*Peso por timeframe (un goal anual vale más que uno semanal): weekly ×1, monthly ×2,
quarterly ×4, annual ×8. Mantiene la fórmula honesta sin inflar XP con metas triviales.

> Nota: deliberadamente **NO** se otorga XP por trade individual (a diferencia del legacy).
> Eso evita premiar overtrading y desacopla XP del hot path de `trades`.

### 4.3 Fórmula de niveles

Curva cuadrática suave (XP requerido crece con el nivel), helper puro testeable:
```
levelForXp(xp)   = floor(sqrt(xp / 100)) + 1          // L1=0, L2=100, L3=400, L4=900, L5=1600...
xpForLevel(L)    = (L - 1)^2 * 100
progressInLevel  = (xp - xpForLevel(L)) / (xpForLevel(L+1) - xpForLevel(L))  // 0..1 para la barra
```
Vive en `src/lib/map-hot/xpLevel.ts` (nuevo), con tests directos como `goalStatus.test.ts`.

### 4.4 Dónde se renderiza

- **Primario:** header de `/map-hot/progress` — un `XpLevelBadge.client.tsx` (nuevo): "Nivel N"
  + barra de progreso al siguiente nivel + XP total. Server-fetch del estado, prop-drilled
  (mismo patrón que `DashboardPerformancePanel`).
- **Secundario:** toast Sonner de "¡Nivel N alcanzado!" cuando `level` sube (requiere
  `map_hot_xp_state` para conocer el nivel previo).
- **Opcional:** mini-badge en el sidebar junto a "Map Hot".

### 4.5 Integración con offline-first (outbox AlphaCore) + RLS/soft-delete

- **El XP se otorga server-side, dentro del endpoint de dominio que ya drena el outbox.** Ejemplo:
  cuando `PUT /api/map-hot/goals/[id]` recalcula `status` y detecta transición a `EXCEEDED`,
  inserta el `map_hot_xp_events` + upsert de `map_hot_xp_state` en la misma request. Como ese PUT
  ya es drenable por el outbox (patrón `bodyMode='direct'` de AlphaCore), el XP se concede
  automáticamente al reconectar, sin lógica offline adicional en el cliente.
- **Idempotencia:** el unique index `(user_id, event_type, ref_id)` garantiza que si el outbox
  reintenta el PUT, el XP no se duplica (INSERT con `on conflict do nothing`). Crítico porque el
  outbox puede reintentar.
- **RLS:** owner-only en ambas tablas, idéntico a `map_hot_goals`.
- **Soft-delete:** `map_hot_xp_events` es **inmutable** (sin `deleted_at`, sin DELETE policy) —
  igual que `progress_events`. Si un goal se borra (soft-delete), su evento de XP **no se
  revierte** (el logro ocurrió). `map_hot_xp_state` no usa soft-delete (es estado, 1 fila).

### 4.6 Qué es migration nueva (resumen)

- **NUEVO:** `map_hot_xp_events` + `map_hot_xp_state` (+ RPC `award_map_hot_xp` opcional para
  atomicidad insert-evento + upsert-estado en `security definer`).
- **NUEVO:** schemas Zod (`mapHotXpEventSchema`) en `src/lib/validation/schemas.ts` +
  autoFix si hay endpoint de escritura manual.
- **NUEVO:** helper `src/lib/map-hot/xpLevel.ts` + tests.
- **MODIFICADO:** `PUT /api/map-hot/goals/[id]` y `PUT /api/map-hot/milestones/[id]` para
  detectar transición y conceder XP.

---

## 5. Decisión sobre el parking lot

**Deprecar y dropear el legacy TraderMap en la misma migration que introduce el XP nuevo
(o en una migration de limpieza si se elige Opción C).**

Es código muerto verificable:
- `user_level_state` — leído solo por `/api/tradermap/level`, que **ningún componente llama**.
  XP nunca incrementado.
- `progress_events` + `progress_map_*` (config/state/level_state/levels/thresholds/pending_sync)
  — escritos por `progressEngine.ts`, que corre en el hot path de trades pero **no se renderiza**
  (pantallas redirigidas a `/map-hot/*`).
- `/api/tradermap/*` (level + 5 rutas `progress-map/*`) — sin consumidores de UI.

**Acciones de limpieza propuestas (migration + code):**
1. `DROP TABLE` (CASCADE): `user_level_state`, `progress_events`, y las `progress_*` de migration 025.
2. `DROP FUNCTION upsert_user_level_state`.
3. **Quitar la llamada `onTradeClosedSaved`** de `trades/route.ts:311` y `trades/[id]/route.ts:187`
   (elimina cómputo muerto del hot path — beneficio de performance inmediato).
4. Borrar `src/lib/tradermap/progressEngine.ts`, `xpConfig.ts`, `src/lib/progress-map/*` y
   `src/app/api/tradermap/*` (verificar que no haya otros imports — grep ya muestra que solo
   se importan entre ellos + los dos trades routes).
5. Limpiar referencias en `next.config.ts` (los redirects `/dashboard/tradermap → /map-hot/goals`
   se mantienen por compat de URLs viejas; eso está bien).

> Por qué no "migrar datos": `tradermap_goals` ya estaba vacío (0 filas, migration 116).
> `progress_events`/`user_level_state` contienen, a lo sumo, XP basura recomputado de un sistema
> que nadie vio. No hay nada que conservar.

---

## 6. Plan por fases (esfuerzo relativo)

### Camino recomendado (Opción B)

**Fase 0 — Limpieza del parking lot (esfuerzo: S)**
- Quitar `onTradeClosedSaved` de los 2 trades routes; borrar `progressEngine.ts`, `xpConfig.ts`,
  `progress-map/*`, `/api/tradermap/*`.
- Migration: drop de `user_level_state`, `progress_events`, `progress_*`, RPC.
- Actualizar CLAUDE.md (sacar el parking lot del estado).
- *Entregable:* hot path de trades más limpio, -8 tablas, -635 líneas. Sin features nuevas.
- *Independiente:* se puede mergear aunque la decisión de XP siga pendiente.

**Fase 1 — Fundaciones XP (esfuerzo: S/M)**
- Migration nueva: `map_hot_xp_events` + `map_hot_xp_state` (+ RPC `award_map_hot_xp`).
- Helper `xpLevel.ts` + tests. Schemas Zod.
- *Entregable:* infraestructura, sin UI todavía.

**Fase 2 — Concesión de XP (esfuerzo: M)**
- Modificar PUT de goals + milestones para detectar transición → conceder XP idempotente.
- Endpoint `GET /api/map-hot/xp` (estado actual).
- Tests de transición + idempotencia (simular reintento de outbox).
- *Entregable:* XP se acumula correctamente (verificable por API).

**Fase 3 — UI + celebración (esfuerzo: S)**
- `XpLevelBadge.client.tsx` en `/map-hot/progress` (badge + barra).
- Toast de level-up. Opcional: mini-badge en sidebar.
- E2E smoke: completar goal → ver XP subir.
- *Entregable:* gamificación visible end-to-end.

**Total Opción B: ~S + S/M + M + S** — bajo/medio. Sin tocar arquitectura; todo sigue patrones
existentes (RLS, Zod, soft-delete selectivo, helpers puros, outbox).

### Camino mínimo (Opción C)

**Solo Fase 0.** Esfuerzo S. Cierra el tema declarando "sin gamificación en Map Hot V2".

### Atajo (Opción D primero)

Fase 0 + Fase 1 (solo tabla de eventos) + un `GET /api/map-hot/xp` que agrega on-read +
Fase 3 sin level-up toast. Promover a estado persistido (B completo) si se quiere celebrar
transiciones. Esfuerzo: S + S.

---

## Referencias de archivos (absolutas)

- `/home/user/alphalog-pwa/src/lib/tradermap/progressEngine.ts` — motor legacy (`onTradeClosedSaved` :551, `recomputeProgress` :313, xp_total recomputado :510).
- `/home/user/alphalog-pwa/src/lib/tradermap/xpConfig.ts` — valores XP legacy (:6-11).
- `/home/user/alphalog-pwa/src/app/api/tradermap/level/route.ts` — único lector de `user_level_state`, sin consumidores de UI.
- `/home/user/alphalog-pwa/src/app/api/tradehub/trades/route.ts:311` y `/home/user/alphalog-pwa/src/app/api/tradehub/trades/[id]/route.ts:187` — call sites de `onTradeClosedSaved` en el hot path.
- `/home/user/alphalog-pwa/supabase/migrations/008_tradermap_schema.sql` — `progress_events`, `user_level_state`, RPC `upsert_user_level_state`.
- `/home/user/alphalog-pwa/supabase/migrations/025_progress_map.sql` — `progress_map_*` (config/state/levels/thresholds/pending_sync).
- `/home/user/alphalog-pwa/supabase/migrations/116_drop_tradermap_legacy.sql` — ya dropeó `tradermap_goals`/`_quarters`; comentario que "mantiene" XP.
- `/home/user/alphalog-pwa/supabase/migrations/109_map_hot_schema.sql` — `map_hot_goals`/`_links`/`_milestones`.
- `/home/user/alphalog-pwa/supabase/migrations/110_map_hot_goal_snapshots.sql` — serie temporal diaria.
- `/home/user/alphalog-pwa/src/lib/map-hot/goalStatus.ts` y `milestoneStatus.ts` — helpers puros (modelo a seguir para `xpLevel.ts`).
- `/home/user/alphalog-pwa/src/components/map-hot/GoalGrid.client.tsx` — `current_value` editado a mano (:134-141).
- `/home/user/alphalog-pwa/src/app/map-hot/progress/page.tsx` — home propuesto del badge de XP.
- `/home/user/alphalog-pwa/src/components/layout/Sidebar.client.tsx:45-51` — nav Map Hot.
- `/home/user/alphalog-pwa/next.config.ts:128,153-154` — redirects tradermap → map-hot.
