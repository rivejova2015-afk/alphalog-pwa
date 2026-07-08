# Migrar tablas de bots de AlphaLog a Postgres propio (self-hosted) — diseño

## Contexto

AlphaLog (`alphalog-pwa`, desplegado en Fly.io) usa hoy un único proyecto **Supabase Cloud**
(130+ tablas, ~2.5 años de historial) para todo: auth, datos de trading, CME, tesorería,
backtests. El usuario quiere dejar de depender de Supabase (ni la nube ni su stack de
software) y mover lo que se pueda a infraestructura 100% propia (`lattice-server`, corriendo
en su PC de casa), empezando por las tablas de los **algoritmos/bots que están activos ahora**
(todos en **paper trading**, sin dinero real en juego).

## Alcance de esta primera etapa

**Incluido:**
- Tablas críticas de bots (~25): `bot_instances`, `bot_accounts`, `bot_commands`,
  `bot_command_status`, `trading_algorithms`, `algorithms`, `trades`, `paper_trades`,
  `algo_paper_trades`, `coinarb_positions`, `coinarb_decisions`, `coinarb_smc_signals`,
  `coinarb_telemetry`, `bot_events`, `bot_skills`, `accounts` (contexto requerido), y
  relacionadas.
- Los 2 EAs de MT5 (`GoldRangeBasketR`, `AlphaLogTelemetry`) y el bot Node.js `coinarb-50x`,
  ambos corriendo en Fly.io.

**Explícitamente fuera de esta etapa** (queda en Supabase Cloud, sin tocar):
- CME (`cme_connections`, `cme_positions`, `cme_trades_*`), tesorería, `backtest_results`,
  auth de usuarios humanos (login web con Google/email), UI del dashboard de AlphaLog.
- Cualquier feature que dependa de Supabase Auth, Realtime o PostgREST para la parte
  **humana** de la app (login, panel web) — eso puede ser una etapa futura aparte.

## Decisión clave: "no depender de Supabase" es más simple de lo esperado

Los bots **no usan Supabase Auth ni Realtime** — se autentican con su propio mecanismo
(HMAC firmado, `bot_instances.webhook_secret_hash`), y escriben datos por inserts directos
a Postgres vía `@supabase/supabase-js` con la service-role key (en el fondo, "Postgres con
permisos elevados", sin nada del resto del stack de Supabase de por medio).

Por eso, para estas tablas, "no depender de Supabase" se reduce a:
1. Un **Postgres plano** (no el Postgres interno de Supabase) — `lattice-server` ya corre
   uno propio (`lattice-server-postgres-1`, el que usa la API de Lattice), separado del
   Postgres interno del contenedor de Supabase.
2. Reemplazar `@supabase/supabase-js` por **`postgres.js`** (cliente Postgres plano, liviano,
   con buen soporte de TypeScript — más simple que `pg` clásico para este caso) en el código
   que hoy escribe estas tablas.

## Arquitectura

```
   Fly.io (alphalog-pwa + coinarb-50x)          PC de casa (lattice-server)
   ┌─────────────────────────────┐             ┌───────────────────────┐
   │  Rutas API + bot Node.js    │             │ lattice-server-        │
   │  usando "pg"/"postgres.js"  │──Headscale──▶│ postgres-1              │
   │  (ya no @supabase/js)       │   (WG E2E)   │ + base "alphalog_bots"  │
   │  + sidecar Tailscale        │             │ (Postgres plano)        │
   └─────────────────────────────┘             └───────────────────────┘
        (CME/tesorería/backtests/auth siguen en Supabase Cloud, sin cambios)
```

- **Red**: Fly.io no puede llegar directo a una PC detrás de CGNAT. Se agrega un sidecar de
  **Tailscale** a los contenedores de `alphalog-pwa` y `coinarb-50x` (patrón oficial de
  Tailscale para Fly.io: arranca `tailscaled` + `tailscale up` con una llave de registro de
  la red Headscale existente, antes de levantar la app). Una vez conectado, Fly.io ve la PC
  por su IP Headscale (`100.64.0.1`), igual que el celular del usuario.
- **Base de datos**: nueva base `alphalog_bots` (aislada, no comparte esquema con las tablas
  propias de Lattice) dentro de `lattice-server-postgres-1`.
- **Esquema**: se aplican las migraciones ya existentes de AlphaLog (filtradas a las tablas
  en alcance) contra `alphalog_bots`, para tener la estructura idéntica (columnas, tipos,
  constraints, políticas RLS que apliquen — RLS de Postgres funciona igual sin Supabase
  encima, solo se pierde el helper `auth.uid()` de Supabase; dado que estas tablas no usan
  Supabase Auth para los bots, esto no debería requerir cambios de políticas).

## Componentes a construir/modificar

1. **`lattice-server`**: crear la base `alphalog_bots`, exponerla vía Headscale (bind más
   allá de `localhost`, protegido por contraseña fuerte + solo alcanzable desde la red
   Headscale — no exponer a la LAN/internet), aplicar el esquema filtrado.
2. **`alphalog-pwa`**: en las rutas server-side que hoy usan el cliente de Supabase para
   escribir/leer las tablas en alcance (`/api/webhooks/mt5`, `/api/webhooks/telemetry`,
   `/api/bot/pair`, `/api/ops/cron/coinarb-heartbeat`, y cualquier otra que toque las tablas
   listadas), reemplazar las llamadas por un cliente Postgres plano. El resto de la app
   (auth de usuarios, CME, tesorería) sigue usando Supabase sin cambios.
3. **`coinarb-50x`**: mismo reemplazo en el daemon Node.js (hoy escribe directo con
   service-role key).
4. **Fly.io (ambas apps)**: Dockerfile/entrypoint con sidecar Tailscale; nuevos secrets
   (connection string de Postgres, llave de registro Headscale) vía `fly secrets set`.
5. **Migración de datos**: `pg_dump`/`pg_restore` (solo tablas en alcance) desde Supabase
   Cloud hacia `alphalog_bots`.

## Runbook de corte (ventana de mantenimiento corta)

1. Backup completo de las tablas en alcance en Supabase Cloud (además del backup normal).
2. `pg_dump --data-only` (tablas en alcance) → `pg_restore` en `alphalog_bots`.
3. Pausar los EAs de MT5 y el bot Coinarb (ventana corta — es paper trading, sin riesgo de
   dinero real).
4. Deploy del código nuevo (cliente Postgres + sidecar Tailscale) a Fly.io.
5. Verificar que Fly.io alcanza `alphalog_bots` por Headscale (`tailscale status`, conexión
   de prueba).
6. Reactivar los bots.
7. Monitorear un rato que los datos entren correctamente (comparar actividad esperada).

## Rollback y seguridad

- El código anterior (con `@supabase/supabase-js` en estas rutas) queda etiquetado en git —
  si algo falla, `fly deploy` de esa versión revierte en minutos.
- Supabase Cloud se mantiene activo (sin escrituras nuevas de estas tablas) durante 1-2
  semanas después del corte, como red de seguridad, antes de evaluar cancelar/reducir la
  suscripción (una vez migrado también el resto de tablas en una etapa futura).

## Riesgos

- **Migraciones de AlphaLog no fueron pensadas para correr fuera de Supabase**: pueden tener
  extensiones o funciones específicas de Supabase (`auth.uid()`, `pg_net`, etc.) en el
  esquema de las tablas en alcance — hay que revisar cada migración relevante y adaptar lo
  que no aplique a Postgres plano.
- **`coinarb-50x` es un daemon separado con su propio ciclo de deploy** — hay que coordinar
  que ambos (`alphalog-pwa` y `coinarb-50x`) migren al mismo tiempo, ya que comparten tablas.
- **Ventana de mantenimiento**: aunque es paper trading, un corte mal cronometrado podría
  perder heartbeats/eventos que ocurran durante la pausa — aceptable dado que no hay dinero
  real en juego, pero vale la pena documentarlo.

## Fuera de alcance (explícito)

Auth de usuarios humanos, UI del dashboard, CME, tesorería, `backtest_results`, Realtime,
cancelación de la suscripción de Supabase (se evalúa después de la ventana de seguridad).
