# KNOWN_ISSUES - AlphaLog

Problemas y limitaciones del export Base44 → Next.js + Supabase.
Priorizadas por impacto en la migración.

---

## P0 (Bloqueantes)

### 1. Base44 SDK Required
- **Problema**: @base44/sdk + @base44/vite-plugin son propietarios, no disponibles post-export
- **Impacto**: No se puede compilar sin ellos, bloquea TODO
- **Solución**: Migrar 100% a Supabase + PostgreSQL
- **Sprint**: 1-3

### 2. React Router vs Next.js App Router
- **Problema**: react-router-dom v6 incompatible con Next.js App Router
- **Impacto**: Conflicto de rutas, compilación falla
- **Solución**: Eliminar react-router, usar app/ directory
- **Sprint**: 1

### 3. Vite Build System Incompatible
- **Problema**: vite.config.js con base44 plugin no compatible
- **Impacto**: Build falla en Next.js
- **Solución**: Usar Next.js build system
- **Sprint**: 1

### 4. Auth Token Management Inseguro
- **Problema**: appParams.token hardcodeado en cliente, expuesto
- **Impacto**: Riesgo de seguridad crítica
- **Solución**: Supabase Auth con httpOnly sessions
- **Sprint**: 2

### 5. Missing Database Schema
- **Problema**: No existe SQL schema para entidades Base44 (Account, Trade, etc.)
- **Impacto**: No se pueden crear tablas en Supabase sin schema
- **Solución**: Inferir schema del código, crear migrations SQL
- **Sprint**: 1

---

## P1 (Importantes)

### 6. Server Functions (Deno → Supabase Edge Functions)
- **Problema**: receiveMT5Data.ts, generateScheduledReport.ts usan Deno
- **Impacto**: No se ejecutan en Supabase sin conversión
- **Solución**: Convertir a Supabase Edge Functions (TypeScript)
- **Sprint**: 5

### 7. Missing Translations Module
- **Problema**: useTranslation() importado en Terminal, Dashboard pero no existe
- **Impacto**: Runtime error en componentes
- **Solución**: Implementar i18n (next-i18next) o remover importes
- **Archivos afectados**: Terminal.jsx, Dashboard.jsx
- **Sprint**: 3

### 8. Duplicate Toast Libraries
- **Problema**: react-hot-toast + sonner ambos en package.json
- **Impacto**: Bloat de dependencias, confusión
- **Solución**: Elegir uno (recomendado: Sonner, moderno)
- **Sprint**: 1

### 9. Three.js Posiblemente Unused
- **Problema**: Declarado en package.json pero sin importes visibles
- **Impacto**: Bloat de dependencias
- **Solución**: Auditar Map.jsx, remover si no usado
- **Sprint**: 1

### 10. React Leaflet v4 Legacy
- **Problema**: react-leaflet v4 deprecated, v5+ requiere cambios API
- **Impacto**: Map.jsx puede no funcionar sin actualización
- **Solución**: Actualizar a v5 o skipear Map (backlog)
- **Sprint**: 4 (si critical) o Backlog

### 11. Missing .env Configuration
- **Problema**: No existe .env.local documentado para Next.js
- **Impacto**: Dev server falla sin SUPABASE_URL, SUPABASE_ANON_KEY
- **Solución**: Crear .env.local.example con variables críticas
- **Variables**:
  ```
  NEXT_PUBLIC_SUPABASE_URL=
  NEXT_PUBLIC_SUPABASE_ANON_KEY=
  SUPABASE_SERVICE_ROLE_KEY=
  NEXT_PUBLIC_APP_NAME=AlphaLog
  ```
- **Sprint**: 1

### 12. Incomplete Service Worker Implementation
- **Estado**: IMPLEMENTADO
- **Problema**: public/sw.js ya está generado (Workbox) y ahora tiene fallback de documento a /offline; falta validar offline real en páginas críticas.
- **Impacto**: Riesgo de offline parcial si rutas críticas no cachean como se espera.
- **Solución**: Verificar navegación offline (Home/Dashboard/Logs/Terminal) y confirmar fallback estable.
- **Sprint**: 6

### 13. Stripe Integration Incomplete
- **Problema**: @stripe/react-stripe-js en package.json pero sin implementación visible
- **Impacto**: Si necesario para pagos, no funciona
- **Solución**: Remover o implementar en Treasury
- **Sprint**: 1 (audit) → 4 (si necesario)

---

## P2 (Mejoras)

### 14. TypeScript Partial Coverage
- **Problema**: Código es JSX (sin tipos), Next.js necesita TSX
- **Impacto**: Sin type safety, harder to maintain
- **Solución**: Migrar gradualmente JSX → TSX (por página/sprint)
- **Sprint**: 3+ (post-MVP)

### 15. No Error Handling Middleware
- **Problema**: Catch blocks básicos, sin logging centralizado
- **Impacto**: Debugging complicado, errores silenciosos
- **Solución**: Error boundary + logger (Sentry optional)
- **Sprint**: 2

### 16. No Tests
- **Problema**: Sin tests unitarios o E2E
- **Impacto**: Regressions fáciles, confianza baja
- **Solución**: Agregar Jest + Playwright (backlog)
- **Sprint**: Backlog

### 17. No Image Optimization
- **Problema**: Sin next/image, lazy loading subóptimo
- **Impacto**: PWA performance subóptimo
- **Solución**: Usar next/image, optimizar assets
- **Sprint**: 5+ (post-MVP)

### 18. No Lighthouse Audit
- **Problema**: PWA score desconocido
- **Impacto**: No se sabe si PWA es real (offline, installable, etc.)
- **Solución**: Correr Lighthouse, fixear issues
- **Sprint**: 6

---

## Dependencias Problemáticas

| Librería | Razón | Acción |
|----------|-------|--------|
| @base44/sdk | Propietaria, no disponible | REMOVE |
| @base44/vite-plugin | Incompatible con Next.js | REMOVE |
| react-router-dom | Conflicto con App Router | REMOVE |
| vite | Reemplazado por Next.js | REMOVE |
| three | Posiblemente unused | AUDIT → REMOVE |
| next-themes | Compatible | KEEP |
| @tanstack/react-query | Excelente, compatible | KEEP |
| @radix-ui/* | Compatible, reutilizable | KEEP |
| recharts | Compatible | KEEP |
| react-leaflet | v4 legacy, actualizar a v5 | UPDATE |
| react-hot-toast / sonner | Duplicado, elegir uno | CONSOLIDATE |
| @stripe/react-stripe-js | Si no usado | AUDIT → REMOVE |

---

## Red Flags de Arquitectura

⚠️ AuthContext hardcodeando token → cambiar a session-based
⚠️ No error boundaries → agregar React error boundary
⚠️ Envs en código → externalizar, usar .env.local
⚠️ Queries sin types → tipar con Zod/TypeScript
⚠️ No API layer abstraction → crear lib/supabase/client.ts
