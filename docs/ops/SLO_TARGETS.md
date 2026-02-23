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
2. RLS coverage
   - `npm run security:check-rls`
3. Calidad build
   - `npm run lint`
   - `npm run build`
4. Budget de frontend
   - `npm run perf:bundle-budget`

## Cadencia recomendada

- Diario: health + errores Sentry.
- Semanal: RLS coverage + bundle budget.
- Mensual: simulacro de rollback + restore.
