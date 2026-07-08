# Migrar tablas de bots de AlphaLog a Postgres propio (self-hosted) — diseño

## Contexto

AlphaLog (`alphalog-pwa`, desplegado en Fly.io) usa hoy un único proyecto **Supabase Cloud**
(130+ tablas, ~2.5 años de historial) para todo: auth, datos de trading, CME, tesorería,
backtests. El usuario quiere dejar de depender de Supabase (ni la nube ni su stack de
software) y mover lo que se pueda a infraestructura 100% propia (`lattice-server`, corriendo
en su PC de casa), empezando por las tablas de los **algoritmos/bots que están activos ahora**
(todos en **paper trading**, sin dinero real en juego).

Una auditoría profunda del código (ver sección "Hallazgos de la auditoría") encontró
dependencias más complejas de lo esperado — por eso esta etapa se divide en **1a** (este
spec) y **1b** (spec aparte, futuro).

## División en dos etapas

- **Etapa 1a (este spec)**: migrar el **flujo de datos de los bots** — lo que escriben los
  EAs de MT5 y el bot Coinarb, más las rutas/cron que leen esos datos para paneles y
  reportes. Todo esto es **server-side**, sin necesidad de sistema de usuarios/auth propio.
- **Etapa 1b (spec futuro, separado)**: la **UI de control humano** (`BotControlWorkspace`,
  `BotControlSelector`, `NewStrategyWizard`) que hoy consulta Supabase **directo desde el
  navegador** — requiere construir una tabla de usuarios propia y reemplazar RLS por
  autorización a nivel de aplicación. Es la parte más laboriosa, se deja para después.

## Alcance de la Etapa 1a

**Tablas en alcance** (elegidas porque el flujo de datos de bots — escritura por EAs/Coinarb,
lectura por cron/paneles server-side — las toca; se excluyen `bots`, `bot_settings_global`,
`bot_settings_override`, que la auditoría confirmó que **solo** las usa la UI de control de
la Etapa 1b y por lo tanto no hace falta tocarlas ahora):

`bot_instances`, `bot_accounts`, `bot_commands`, `bot_command_status`, `trading_algorithms`,
`algorithms`, `trades`, `paper_trades`, `algo_paper_trades`, `coinarb_positions`,
`coinarb_decisions`, `coinarb_smc_signals`, `coinarb_telemetry`, `bot_events`, `bot_skills`,
`accounts`.

**Código en alcance** (todo server-side, confirmado por la auditoría — ninguno necesita
cambios de auth/RLS porque los bots se autentican con su propio HMAC, no con Supabase Auth):

- Rutas API: `/api/webhooks/mt5`, `/api/webhooks/telemetry`, `/api/bot/pair`,
  `/api/dashboard/command-center`, `/api/treasury/*` (payouts/export/calendar-events),
  `/api/coinarb/*` (stats/decisions/positions/telemetry), `/api/cron/business/alerts`,
  `/api/cron/algorithms/paper-review`, `/api/ops/cron/bot-*` (auto-recovery, daily-verify,
  slo-monitor, heartbeat-monitor, coinarb-heartbeat).
- Librerías: `src/lib/treasury/queries.ts`, `src/lib/dashboard/queries.ts`,
  `src/lib/bot/skills/skill-manager.ts`, `src/lib/bot/arbitrage/pair-monitor.ts`,
  `src/lib/bot/arbitrage/risk-guard.ts`, `src/lib/quality-gates/runner.ts`.
- Cliente central: `src/lib/supabase/server.ts` (punto único de entrada — el swap se hace
  ahí y se propaga).
- Bot Coinarb (`coinarb/` dentro del mismo repo, deploy aparte en Fly.io):
  `src/trading/spot-positions.ts`, `src/ops/decision-logger.ts`,
  `src/ops/smc-signal-persist.ts`, `src/core/loop.ts`, `src/core/config.ts`,
  `src/ops/command-poller.ts`.

**Caso especial — 3 mutaciones puntuales de la UI que SÍ tocan tablas en alcance:**
`BotControlWorkspace`/`BotControlSelector` insertan/actualizan `bot_commands` y
`bot_command_status` (pausar/reanudar un bot), y `NewStrategyWizard` inserta en `algorithms`.
Si migramos esas tablas pero la UI sigue escribiéndoles directo a Supabase Cloud, quedan
desincronizadas (el bot nunca ve el comando de pausa, por ejemplo). Para no romper esas 3
interacciones puntuales sin construir todo el sistema de auth de la Etapa 1b, esta etapa
**sí incluye** 3 rutas API mínimas (sin sistema de usuarios propio — reusan la sesión de
Supabase Auth que ya existe hoy, solo para validar quién es el usuario, y escriben al
Postgres propio) que reemplazan esas 3 llamadas directas del navegador:
`POST /api/bot-control/command` (pausar/reanudar), `POST /api/bot-control/command-status`,
`POST /api/bot-control/algorithms`. Esto NO es la Etapa 1b completa (no se toca RLS de las
demás 14 tablas ni se crea una tabla de usuarios propia) — es el mínimo para que la UI no se
rompa mientras migran estas tablas puntuales.

**Explícitamente fuera de la Etapa 1a:**
- El resto de la UI de `BotControlWorkspace`/`BotControlSelector`/`NewStrategyWizard` que
  solo lee/escribe `bots`, `bot_settings_global`, `bot_settings_override` (quedan en
  Supabase Cloud, sin tocar, hasta la Etapa 1b).
- CME, tesorería (fuera de las 3 rutas de solo-lectura ya listadas arriba), `backtest_results`.
- Auth de usuarios humanos, Realtime (confirmado que no se usa en las tablas en alcance),
  cancelación de la suscripción de Supabase.

## Decisión clave: "no depender de Supabase" es más simple de lo esperado para 1a

Los bots **no usan Supabase Auth ni Realtime** — se autentican con su propio mecanismo
(HMAC firmado, `bot_instances.webhook_secret_hash`), y escriben datos por inserts directos
a Postgres vía `@supabase/supabase-js` con la service-role key (en el fondo, "Postgres con
permisos elevados", sin nada del resto del stack de Supabase de por medio).

Por eso, para el código listado arriba, "no depender de Supabase" se reduce a:
1. Un **Postgres plano** (no el Postgres interno de Supabase) — `lattice-server` ya corre
   uno propio (`lattice-server-postgres-1`, el que usa la API de Lattice), separado del
   Postgres interno del contenedor de Supabase.
2. Reemplazar `@supabase/supabase-js` por **`postgres.js`** (cliente Postgres plano, liviano,
   con buen soporte de TypeScript) en `src/lib/supabase/server.ts` y en el cliente propio del
   bot Coinarb — como todo pasa por ese punto central, el reemplazo se propaga sin tocar cada
   ruta una por una.
3. Las 3 rutas nuevas de "caso especial" (arriba) sí necesitan código nuevo, no solo swap.

## Arquitectura

```
   Fly.io (alphalog-pwa + coinarb bot)          PC de casa (lattice-server)
   ┌─────────────────────────────┐             ┌───────────────────────┐
   │  Rutas API + bot Node.js    │             │ lattice-server-        │
   │  usando "postgres.js"      │──Headscale──▶│ postgres-1              │
   │  (ya no @supabase/js)       │   (WG E2E)   │ + base "alphalog_bots"  │
   │  + sidecar Tailscale        │             │ (Postgres plano)        │
   └─────────────────────────────┘             └───────────────────────┘
   (bots/bot_settings_*/CME/tesorería/backtests/auth siguen en Supabase Cloud)
```

- **Red**: Fly.io no puede llegar directo a una PC detrás de CGNAT. Se agrega un sidecar de
  **Tailscale** a los contenedores de `alphalog-pwa` y del bot Coinarb (patrón oficial de
  Tailscale para Fly.io: arranca `tailscaled` + `tailscale up` con una llave de registro de
  la red Headscale existente, antes de levantar la app). Una vez conectado, Fly.io ve la PC
  por su IP Headscale (`100.64.0.1`), igual que el celular del usuario.
- **Base de datos**: nueva base `alphalog_bots` (aislada, no comparte esquema con las tablas
  propias de Lattice) dentro de `lattice-server-postgres-1`.
- **Esquema**: se aplican las migraciones ya existentes de AlphaLog (filtradas a las 16
  tablas en alcance) contra `alphalog_bots`. Las políticas RLS de esas migraciones (basadas
  en `auth.uid()`) **no se copian** — para el código en alcance no hacen falta, porque nada
  de ese código depende de sesión de usuario (son bots con HMAC propio o cron jobs
  internos). Las 3 rutas de "caso especial" hacen su propio chequeo simple de sesión antes
  de escribir (ver más abajo), sin necesitar RLS de Postgres.
- **Users/FKs**: las 16 tablas en alcance tienen `user_id` con FK a `auth.users` (de
  Supabase). Como esta etapa es de un solo usuario (el dueño de AlphaLog), se crea una tabla
  `public.users` mínima de **una sola fila** (mismo UUID que ya tiene hoy en Supabase, para
  no romper datos migrados) y se repuntan ahí las FKs — preserva integridad referencial sin
  construir un sistema de usuarios completo, y deja la puerta abierta para sumar más filas en
  la Etapa 1b si hiciera falta.

## Componentes a construir/modificar

1. **`lattice-server`**: crear la base `alphalog_bots`, exponerla vía Headscale (bind más
   allá de `localhost`, protegido por contraseña fuerte + solo alcanzable desde la red
   Headscale — no exponer a la LAN/internet), aplicar el esquema de las 16 tablas (sin RLS,
   con `user_id` con FK a una tabla `public.users` de una sola fila).
2. **`alphalog-pwa`**: reemplazar `@supabase/supabase-js` por `postgres.js` en
   `src/lib/supabase/server.ts` (punto central) y en las librerías listadas arriba. Agregar
   las 3 rutas nuevas (`/api/bot-control/command`, `/command-status`, `/algorithms`) que
   reemplazan las llamadas directas del navegador para esas 3 mutaciones puntuales — estas
   rutas siguen usando la sesión de Supabase Auth existente solo para saber "quién sos"
   (auth de usuarios humanos no se toca en esta etapa), pero escriben al Postgres propio.
3. **Bot Coinarb**: mismo reemplazo de cliente en sus 6 archivos listados.
4. **Fly.io (ambas apps)**: Dockerfile/entrypoint con sidecar Tailscale; nuevos secrets
   (connection string de Postgres, llave de registro Headscale) vía `fly secrets set`.
5. **Migración de datos**: `pg_dump`/`pg_restore` (solo las 16 tablas) desde Supabase Cloud
   hacia `alphalog_bots`.

## Runbook de corte (ventana de mantenimiento corta)

1. Backup completo de las 16 tablas en Supabase Cloud (además del backup normal).
2. `pg_dump --data-only` (esas tablas) → `pg_restore` en `alphalog_bots`.
3. Pausar los EAs de MT5 y el bot Coinarb (ventana corta — es paper trading, sin riesgo de
   dinero real).
4. Deploy del código nuevo (cliente Postgres + sidecar Tailscale + 3 rutas nuevas) a Fly.io.
5. Verificar que Fly.io alcanza `alphalog_bots` por Headscale (`tailscale status`, conexión
   de prueba).
6. Reactivar los bots.
7. Probar las 3 mutaciones de UI (pausar/reanudar un bot, crear una estrategia) para
   confirmar que escriben al lugar correcto.
8. Monitorear un rato que los datos entren correctamente (comparar actividad esperada).

## Rollback y seguridad

- El código anterior (con `@supabase/supabase-js` en estas rutas) queda etiquetado en git —
  si algo falla, `fly deploy` de esa versión revierte en minutos.
- Supabase Cloud se mantiene activo (sin escrituras nuevas de estas 16 tablas) durante 1-2
  semanas después del corte, como red de seguridad, antes de evaluar cancelar/reducir la
  suscripción (recién tiene sentido evaluar cancelación después de completar también la
  Etapa 1b y el resto de tablas, en etapas futuras).

## Hallazgos de la auditoría (que dieron forma a este diseño)

- **3 componentes de UI consultan Supabase directo desde el navegador** para `bots`,
  `bot_accounts`, `bot_instances`, `bot_commands`, `bot_command_status`,
  `bot_settings_global`, `bot_settings_override`, `algorithms` — la mayoría de esas tablas
  quedan fuera de esta etapa (van en la 1b), excepto las 3 mutaciones puntuales ya cubiertas
  arriba.
- **RLS con `auth.uid()`** en las 17 tablas originales — no se replica para el código en
  alcance (no lo necesita), se deja pendiente para la 1b si se migran las tablas que sí lo
  necesitan.
- **FKs a `auth.users`** en todas las tablas — resuelto con la columna `user_id` sin FK real
  (o FK a una tabla de una fila), dado que es un solo usuario.
- **Sin extensiones de Supabase** (`pg_net`, `pg_cron`, `vault`) en las tablas en alcance —
  sin bloqueos ahí.
- **Sin Realtime** en las tablas en alcance — sin bloqueos ahí.
- **Cliente centralizado** (`src/lib/supabase/server.ts`) — facilita mucho el swap.

## Riesgos

- **Las 3 rutas nuevas son código nuevo real**, no solo un swap de librería — hay que
  escribirlas y probarlas con cuidado (son las únicas que le muestran datos de vuelta a un
  humano en este alcance).
- **El bot Coinarb es un deploy aparte** en Fly.io — hay que coordinar que ambos
  (`alphalog-pwa` y el bot) migren al mismo tiempo, ya que comparten tablas.
- **Ventana de mantenimiento**: aunque es paper trading, un corte mal cronometrado podría
  perder heartbeats/eventos que ocurran durante la pausa — aceptable dado que no hay dinero
  real en juego, pero vale la pena documentarlo.
- **Migraciones de AlphaLog no fueron pensadas para correr fuera de Supabase**: hay que
  revisar cada migración de las 16 tablas y adaptar lo que no aplique a Postgres plano
  (quitar RLS, ajustar la FK de `user_id`).

## Fuera de alcance (explícito)

Etapa 1b completa (UI de control con auth/RLS propios para `bots`/`bot_settings_*`), auth de
usuarios humanos en general, CME, tesorería (salvo las rutas de solo-lectura ya listadas),
`backtest_results`, cancelación de la suscripción de Supabase.
