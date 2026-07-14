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
  cada política de SELECT/UPDATE/DELETE). El Postgres crudo no tiene RLS —
  cada ruta que las toque necesita un chequeo explícito de `user_id` en el
  código de la aplicación (mismo patrón que ya se aplicó a
  `bot/pair/route.ts` en la Etapa 1a).
- **Las FK ya están satisfechas**: `cme_trades_propfirm`, `cme_trades_real`,
  `cme_positions` y `cme_signals` referencian `algorithms.id` (ya migrada);
  el resto de las FK son internas al propio grupo de tablas CME.
- **El Vault de Supabase** (`store_vault_secret`/`read_vault_secret`, RPCs
  usadas para cifrar el token OAuth de Tradovate) solo las usa
  `src/lib/cme/vault.ts` — blast radius acotado, reemplazo limpio.
- **lattice-server ya tiene su propio vault de secretos**: el endpoint
  `api/src/routes/secrets.ts`, cifrado AES-256-GCM vía `api/src/lib/crypto.ts`
  con `ENCRYPTION_KEY`. Se reutiliza ese mismo cifrado en vez de inventar uno
  nuevo.
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
   `INSERT`/`SELECT` directos contra una tabla `secrets` en el Postgres de
   lattice-server, cifrando con el mismo AES-256-GCM que ya usa
   `api/src/lib/crypto.ts` (mismo `ENCRYPTION_KEY`, compartido vía variable
   de entorno — igual que ya se comparte con otras piezas de este proyecto).
5. Sin tarea de migración de datos (0 filas) — la única "migración" real es
   de esquema + código.

## Componentes a tocar

- `src/lib/cme/vault.ts` — reemplazo del backend de almacenamiento del token.
- `src/lib/cme/tradovate.ts`, `src/lib/cme/order-executor.ts` — cualquier
  llamada Supabase directa (no solo las que ya reciben `svc` como parámetro).
- `src/lib/engine/dispatchers/tradovate.ts` — sigue recibiendo `svc` como
  parámetro; cambia qué implementación se le inyecta desde los call sites.
- Rutas API: `/api/cme/connect`, `/api/cme/connections`,
  `/api/cme/trades/propfirm`, `/api/intelligence/algorithms/cme-accounts`.
- Crons (ya corren en vivo en `alphalog-cron`, Fly.io):
  `/api/cron/cme/position-sync`, `risk-monitor`, `equity-sync`,
  `connection-heartbeat`, `daily-report`, `/api/cron/algorithms/tradovate-poll`,
  `/api/cron/bars/tradovate-fetch`.
- `data/alphalog/schema.sql` (lattice-server) — 8 tablas nuevas.
- Una tabla `secrets` (o reutilizar la ya existente de lattice-server, a
  decidir en el plan de implementación) para el token cifrado de Tradovate.

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
