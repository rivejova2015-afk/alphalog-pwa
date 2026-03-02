# SLO Targets (AlphaLog)

Esta guia define los objetivos operativos minimos para produccion.

## Objetivos por modulo

- **API Health (`/api/health`)**
  - Disponibilidad mensual: **>= 99.5%**
  - Latencia p95: **< 800ms**
  - Error ratio (5xx): **< 1%**

- **Bot Runtime (MT5 control-plane)**
  - Heartbeat fresco (`botRuntime`): **>= 99% del tiempo**
  - ACK de comandos de prueba: **< 60s**
  - Pendings vencidos (`S1`): **0**

- **Supabase DB**
  - Errores de consulta bloqueantes: **0**
  - RLS coverage: **100% tablas criticas**

## Umbrales de severidad

- **S1 (bloqueante):**
  - `/api/health` en `error`
  - Bot heartbeat stale sostenido
  - Pending commands con timeout critico

- **S2 (funcional):**
  - `/api/health` en `degraded` > 15 minutos
  - Incremento de errores de endpoint sin caida total

- **S3 (menor):**
  - Regresiones no bloqueantes de performance
  - Alertas puntuales sin impacto sostenido

## Verificaciones operativas

1. Health endpoint
   - `curl https://www.alphalog.io/api/health`
2. Bot SLO monitor (Forex + Futuros)
   - `npm run ops:bot-slo-monitor -- --baseUrl https://www.alphalog.io --window-min 15 --market-policy auto`
3. RLS coverage
   - `npm run security:check-rls`
4. Calidad build
   - `npm run lint`
   - `npm run build`
5. Budget de frontend
   - `npm run perf:bundle-budget`

## Cadencia recomendada

- Diario: health + errores Sentry.
- Cada 15 min: `ops:bot-slo-monitor` (scheduler externo), con `failFastOn s1` en ventanas largas.
- Cada 15 min (opcional): `ops:bot-auto-recovery -- --dryRun=false` para reaccion automatica a S1 criticos con cooldown.
- Diario (fin del dia): `ops:bot-daily-summary` para consolidar evidencia operacional.
- Semanal: RLS coverage + bundle budget.
- Mensual: simulacro de rollback + restore.

## Politica mercado cerrado (Bot SLO)

- Perfil Forex:
  - abierto desde domingo 17:00 PR hasta viernes 17:00 PR.
- Perfil Futuros:
  - abierto desde domingo 18:00 PR hasta viernes 17:00 PR.
- En `market-policy=auto`, `STALE_HEARTBEAT` fuera de horario se clasifica como `S2` (informativo), no `S1`.
- `PENDING_COMMAND_TIMEOUT` permanece `S1` aunque el mercado este cerrado.
