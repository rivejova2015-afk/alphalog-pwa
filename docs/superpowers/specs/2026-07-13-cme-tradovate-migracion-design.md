# Migración de CME/Tradovate a Postgres propio — Diseño

## Contexto

AlphaLog ya migró (Etapa 1a, sesión previa) las tablas de cripto y de forex/MT5
(`algorithms`, `bot_instances`, `bot_accounts`, `coinarb_telemetry`, etc.) del
Supabase Cloud original al Postgres propio de `lattice-server`. Las tablas de
futuros CME/Tradovate quedaron fuera de ese alcance y **siguen viviendo en
Supabase hoy**: `algo_cme_accounts`, `cme_connections`, `cme_equity_snapshots`,
`cme_positions`, `cme_risk_configs`, `cme_signals`, `cme_trades_propfirm`,
`cme_trades_real`.

Este es el primer sub-proyecto de una hoja de ruta de 4 piezas para dejar
forex/futuros 100% funcionales, en este orden acordado con el usuario:

1. **Migrar CME/Tradovate a lattice-server** (este documento)
2. Conectar una cuenta prop firm real (Tradovate) y validar de punta a punta
3. Enjambre de terminales MT4/MT5 (Docker + Wine), spec aparte
4. Broker real IBKR/TradeStation/Rithmic (hoy 0% construido, "coming soon")

El motor de ejecución (`dispatchTradovate`, en
`src/lib/engine/dispatchers/tradovate.ts`) ya es maduro: consciente de
posición, SL/TP por ATR, sizing Kelly opcional, ~40 tests, y un interruptor
global `DISPATCH_MODE` que por defecto es `'shadow'` (nunca ejecuta real sin
configuración explícita). Este spec no toca ese motor — solo dónde vive el
dato que lo alimenta.

## Hallazgos clave de la investigación (antes de diseñar)

- **Las 8 tablas tienen 0 filas hoy** (confirmado por consulta directa a
  Supabase). No hay cutover en vivo, no hay riesgo de escritura concurrente,
  no hace falta runbook de migración de datos — solo esquema + código.
- **Las 8 tablas dependen de RLS de Supabase** (`auth.uid() = user_id` en
  cada política de SELECT/UPDATE/DELETE). El Postgres crudo no tiene RLS.
  Spot-check de 2 de las 17 rutas/crons CME (`cme-accounts`, `cme/connect`)
  muestra que **ya filtran explícitamente por `.eq('user_id', user.id)`** en
  la query, no dependen solo de RLS — mejor de lo que se temía. La tarea real
  no es "agregar el chequeo en todos lados" (como si faltara en todas), sino
  **verificar las 17 rutas/crons una por una** y arreglar puntualmente
  cualquiera que sí dependa solo de RLS (mismo patrón de bug que se encontró
  una vez en `bot/pair/route.ts` durante la Etapa 1a — no asumir que no va a
  repetirse en alguna de las 15 restantes sin revisar).
- **Las FK ya están satisfechas, con un ajuste al escribir el schema**:
  `cme_trades_propfirm`, `cme_trades_real`, `cme_positions` y `cme_signals`
  referencian `algorithms.id` (ya migrada); el resto son internas al propio
  grupo de tablas CME. **Excepción a corregir al portar el schema**:
  `algo_cme_accounts.user_id` en Supabase referencia `auth.users` (el
  esquema interno de Supabase Auth, que nunca se migró ni debe recrearse) —
  en `data/alphalog/schema.sql` esa FK debe apuntar a la tabla espejo
  `public.users` que ya existe ahí (el mismo patrón que ya usan
  `algorithms.user_id`/`bot_accounts.user_id`), no a un esquema `auth`
  literal.
- Los CHECK constraints existentes (status/direction/broker_type/etc.) son
  simples `CHECK (col = ANY (ARRAY[...]))` sobre `text` — ningún ENUM nativo
  de Postgres, se portan tal cual sin conversión especial. Dato lateral útil
  para el sub-proyecto 2: `algo_cme_accounts_propfirm_provider_check` ya
  limita `provider_name` a `Apex`, `Lucid Trading`, `MyFundedFutures`,
  `Tradeify` cuando `account_type='propfirm'` — esa es la lista de firmas
  ya contempladas por el schema actual.
- **El Vault de Supabase** (`store_vault_secret`/`read_vault_secret`, RPCs
  usadas para cifrar el token OAuth de Tradovate) solo las usa
  `src/lib/cme/vault.ts` — blast radius acotado, reemplazo limpio.
- **lattice-server ya tiene su propio vault de secretos**: `api/src/lib/crypto.ts`
  (AES-256-GCM puro, `node:crypto`, sin dependencia de Prisma/Fastify — se
  puede copiar/reusar en `alphalog-pwa` sin fricción) y una tabla `"Secret"`
  ya existente (`userId, project, name, ciphertext, iv, authTag`, única por
  `(userId, project, name)`), cuyo propio comentario en el schema dice
  `project: "lattice" | "alphalog" | ...` — **fue diseñada desde el principio
  para reusarse entre proyectos**. No hace falta crear una tabla nueva:
  se guarda con `project='alphalog-cme'`, `name=<cme_connections.id>`.
- **Gotcha real encontrado — la tabla `"Secret"` vive en la base `lattice`,
  no en `alphalog_bots`, y su FK apunta al `"User"` de lattice-server (un
  único usuario, `02cea22f-...`), que NO es el mismo UUID que
  `alphalog_bots.users` (`304a1a34-...`, el usuario real de AlphaLog) — son
  dos sistemas de usuarios distintos, sin correspondencia de IDs.**
  Insertar con el `user_id` de AlphaLog violaría la FK. Resolución: al
  guardar el token, usar siempre el único `userId` de lattice-server como
  ancla de la fila (el sistema es de un solo operador; `project`+`name` ya
  desambiguan de sobra sin necesitar el `user_id` de AlphaLog). Esto también
  implica dos hallazgos más de infraestructura, confirmados por consulta
  directa:
  - El rol `alphalog` (el que ya usa `ALPHALOG_PG_URL` hoy) **puede
    conectarse** a la base `lattice` (`has_database_privilege = true`) pero
    **no tiene ningún permiso sobre `"Secret"`** (`SELECT`/`INSERT` =
    `false`). Hace falta un `GRANT SELECT, INSERT, UPDATE ON "Secret" TO
    alphalog;` una sola vez, antes de que el código pueda usarla.
  - `ENCRYPTION_KEY` (la que usa `api/src/lib/crypto.ts` en lattice-server)
    **no es la misma variable** que `DATA_ENCRYPTION_KEY`, ya deployada como
    Fly secret en `alphalog-pwa` (para otro propósito, preexistente). Nunca
    asumir que son intercambiables — hay que tomar el valor real de
    `ENCRYPTION_KEY` del `.env` de lattice-server y configurarlo como un Fly
    secret nuevo y claramente nombrado (ej. `LATTICE_ENCRYPTION_KEY`) en
    `alphalog-pwa`.
  Esto también implica una **segunda conexión Postgres** (a la base `lattice`, distinta
  de la conexión a `alphalog_bots`) — no se puede hacer un JOIN cruzado en
  una sola query; el código debe leer `cme_connections.id` primero y después
  consultar `"Secret"` por separado.
- **Sin triggers** en ninguna de las 8 tablas CME (confirmado por consulta
  directa) — no hay lógica de base de datos oculta que replicar además de
  columnas/constraints/índices.
- **No hay suscripciones Realtime de Supabase** en los componentes de
  frontend de CME (`CmePositionsPanel`, `CmeTradesTable`, etc.) — todo es
  polling por `fetch()`, así que no se rompe nada de UI en vivo al migrar.

## Arquitectura

Mismo patrón que las dos migraciones anteriores de esta sesión:

1. Agregar las 8 tablas (con sus columnas, constraints e índices reales,
   introspectados desde Supabase — no adivinados) a
   `lattice-server/data/alphalog/schema.sql`.
2. Ampliar el union type `InScopeTable` del shim
   (`alphalog-pwa/src/lib/pg/client.ts`) para incluir las 8 tablas nuevas.
3. Reescribir cada call site que hoy usa `createClient()`/Supabase para las
   tablas CME, pasando a `getPgClient()` — agregando el chequeo explícito de
   `user_id` donde antes lo daba la RLS.
4. Reemplazar `lib/cme/vault.ts` (llamadas RPC a Supabase Vault) por
   `INSERT`/`SELECT` directos contra la tabla `"Secret"` **ya existente** en
   la base `lattice` (no `alphalog_bots` — conexión Postgres separada),
   usando `project='alphalog-cme'`, `name=<cme_connections.id>`, y el único
   `userId` de lattice-server como ancla de la fila (ver hallazgo de FK
   arriba). Cifrado con el mismo AES-256-GCM de `api/src/lib/crypto.ts`
   (función copiada/reusada tal cual, mismo `ENCRYPTION_KEY` compartido vía
   variable de entorno).
5. Sin tarea de migración de datos para las 8 tablas CME (0 filas) — la
   única "migración" real es de esquema + código. El cliente Postgres para
   la base `lattice` es nuevo (hoy `alphalog-pwa` solo habla con
   `alphalog_bots`), así que sí hay una pieza nueva de conexión/config, aunque
   no de datos.

## Componentes a tocar

- `src/lib/cme/vault.ts` — reemplazo del backend de almacenamiento del token.
- `src/lib/cme/tradovate.ts`, `src/lib/cme/order-executor.ts` — cualquier
  llamada Supabase directa (no solo las que ya reciben `svc` como parámetro).
- `src/lib/engine/dispatchers/tradovate.ts` — sigue recibiendo `svc` como
  parámetro; cambia qué implementación se le inyecta desde los call sites.
- Rutas API (12, inventario completo — cada una se verifica individualmente
  por el chequeo explícito de `user_id`, no se asume que ya lo tiene):
  `/api/cme/connect`, `/api/cme/connect/[cmeAccountId]`, `/api/cme/connections`,
  `/api/cme/account`, `/api/cme/account/equity-snapshots`, `/api/cme/kill-switch`,
  `/api/cme/positions`, `/api/cme/positions/[id]/close`, `/api/cme/risk-config`,
  `/api/cme/signal`, `/api/cme/trades/propfirm`, `/api/cme/trades/real`,
  `/api/intelligence/algorithms/cme-accounts`.
- Crons (5, ya corren en vivo en `alphalog-cron`, Fly.io):
  `/api/cron/cme/position-sync`, `risk-monitor`, `equity-sync`,
  `connection-heartbeat`, `daily-report`. Más
  `/api/cron/algorithms/tradovate-poll` y `/api/cron/bars/tradovate-fetch`,
  que ya viven fuera de `cron/cme/` pero también tocan estas tablas.
- `data/alphalog/schema.sql` (lattice-server) — 8 tablas nuevas.
- **Sin tabla nueva para secretos** — se reusa `"Secret"` (base `lattice`,
  ya existente), con `project='alphalog-cme'`. Nuevo: un cliente/pool
  Postgres en `alphalog-pwa` apuntando a la base `lattice` (hoy solo existe
  uno apuntando a `alphalog_bots`), y la función `encrypt`/`decrypt` de
  `api/src/lib/crypto.ts` copiada a `alphalog-pwa` (mismo `ENCRYPTION_KEY`).

## Manejo de errores

Sin cambios de comportamiento — el fail-open ya existente en
`dispatchTradovate` (getPositions/getCashBalance fallan → sigue con valores
por defecto, nunca cuelga el dispatcher) se mantiene intacto, ya que no se
toca esa lógica, solo el cliente de datos que recibe como parámetro.

## Verificación

1. `tsc --noEmit` limpio + suite de tests de `alphalog-pwa` completa
   (incluye los tests de `vault.ts`, `dispatchers/tradovate.ts` ya existentes,
   actualizados para el nuevo cliente).
2. Smoke-test manual: crear una fila de prueba en `algo_cme_accounts` +
   `cme_connections` contra el Postgres de lattice-server, simular un ciclo
   de `dispatchSignal` en modo `shadow`, confirmar que escribe correctamente
   en `cme_signals` y que el token (falso, de prueba) se guarda/lee cifrado
   sin pasar por Supabase.
3. Confirmar que los 4 crons de CME (`position-sync`, `risk-monitor`,
   `equity-sync`, `connection-heartbeat`) corren sin error contra 0 filas
   reales (deben ser no-op silenciosos, como ya documenta el propio
   `crontab`).
4. Limpieza de la fila de prueba antes de pasar al sub-proyecto 2.

## Fuera de alcance (este spec)

- Conectar una cuenta Tradovate real (sub-proyecto 2, spec aparte).
- Cualquier cambio a la lógica de `dispatchTradovate` en sí (ATR, Kelly,
  reversión de posición) — se migra el dato, no el motor.
- El enjambre MT4/MT5 y el broker real IBKR/TradeStation (sub-proyectos 3 y 4).
