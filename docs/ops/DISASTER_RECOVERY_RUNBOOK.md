# Disaster Recovery Runbook

Objetivo: recuperar operacion de AlphaLog ante incidentes de despliegue, datos o runtime bot.

## 1) Preparacion minima

- Produccion activa en Vercel (`www.alphalog.io`)
- Backups de Supabase habilitados
- Secrets en Vercel + Vault (no repo, no temp)
- Acceso operativo a:
  - GitHub main
  - Vercel project
  - Supabase project

## 2) Deteccion y clasificacion

1. Confirmar impacto:
   - API: `GET /api/health`
   - UI: smoke principal (`/dashboard`, `/dashboard/tradehub`, `/dashboard/terminal`)
2. Clasificar:
   - **S1**: caida total / corrupcion de datos / auth roto
   - **S2**: funciones degradadas sin caida total
   - **S3**: incidencia menor

## 3) Contencion inmediata

- Si el ultimo deploy rompe:
  1. Promover deployment estable anterior en Vercel.
  2. Confirmar alias `www.alphalog.io`.
- Si el problema es de secretos:
  1. Rotar secreto comprometido.
  2. Redeploy.
  3. Ejecutar `npm run ops:cleanup-temp-secrets`.
- Si el problema es bot runtime:
  1. Revisar `botRuntime` y `botFunctions` en health.
  2. Verificar `bot_instances.last_heartbeat_at`.

## 4) Recuperacion de datos (Supabase)

1. Congelar escrituras del modulo afectado (feature flag o bloqueo temporal API).
2. Validar alcance de datos afectados.
3. Restaurar desde backup/PITR en entorno de restauracion.
4. Verificar integridad:
   - tablas criticas
   - RLS
   - consistencia de FK
5. Ejecutar plan de cutover a produccion solo cuando el entorno restaurado pase smoke.

## 5) Verificacion post-recuperacion

- `npm run lint`
- `npm run build`
- `npm run test:e2e` (o subset critico)
- `npm run security:check-rls`
- `npm run perf:bundle-budget`
- Health en `ok` o `degraded` controlado con causa identificada.

## 6) Simulacro mensual obligatorio

1. Simular rollback de deploy.
2. Simular restore parcial de datos.
3. Verificar tiempos:
   - MTTD
   - MTTR
4. Documentar gaps y acciones correctivas.

## 7) Cierre de incidente

- Postmortem con:
  - causa raiz
  - linea de tiempo
  - impacto
  - acciones preventivas
- Abrir tareas en backlog con prioridad y owner.
