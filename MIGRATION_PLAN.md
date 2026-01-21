# MIGRATION_PLAN - AlphaLog

Plan de migraci ón: **Base44 → Next.js 16 + Supabase PWA** (sin cambiar diseño global).

---

## Objetivo General

✅ Next.js PWA full (offline, installable, push notifications)  
✅ Supabase backend (Auth + PostgreSQL)  
✅ Mantener UX/diseño actual (Radix UI, TailwindCSS)  
✅ Fase 1: Core (Auth + Dashboards + CRUD básico)  
✅ Fase 2: Real-time + Offline + PWA  

---

## Hoja de Ruta (6 Sprints)

```
Semana 1: Sprints 1-2 (Setup + Auth) — 2-3h c/u
  Sprint 1: Proyecto base, Supabase, schema
  Sprint 2: Supabase Auth, middleware

Semana 2: Sprints 3-4 (Pages + CRUD) — 2-3h c/u
  Sprint 3: Dashboard, Accounts, Analytics
  Sprint 4: Terminal, Journal, Goals, Setups

Semana 3: Sprints 5-6 (Real-time + PWA) — 2-3h c/u
  Sprint 5: Server functions, live data
  Sprint 6: Offline + Push + Lighthouse

Total: 12-18 horas → MVP ready
```

---

## Sprint 1: Proyecto Base + Supabase Setup (2-3h)
**Objetivo**: Next.js ready, Supabase configured, DB schema

### Tareas
- [ ] **T1.1**: Validar scaffold Next.js (package.json, tsconfig, manifest)
  - Verificar TailwindCSS v4 funcionando
  - Asegurar public/manifest.ts, public/sw.js existen

- [ ] **T1.2**: Crear Supabase project
  - Obtener SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
  - Documentar en .env.local.example

- [ ] **T1.3**: Instalar @supabase/supabase-js
  - npm install @supabase/supabase-js
  - Crear lib/supabase/client.ts (client-side instance)
  - Crear lib/supabase/server.ts (si route handlers necesarios)

- [ ] **T1.4**: Crear SQL schema + migrations
  - Analizar entidades Base44 (Account, Trade, JournalEntry, etc.)
  - Crear supabase/migrations/001_init_schema.sql
  - Tablas: accounts, trades, journal_entries, goals, setups, treasury, etc.
  - Seed datos de prueba (opcional)

- [ ] **T1.5**: Validar setup
  - npm run build sin errores
  - npm run dev, navegar a / (Home)
  - Conectar a Supabase: console.log(await supabase.from('accounts').select())

### Checklist de Terminación
- [ ] Next.js project builds sin errores
- [ ] Supabase project creado + credenciales en .env.local
- [ ] Database schema migrada (6+ tablas principales)
- [ ] lib/supabase/client.ts funcionando
- [ ] Connection test exitoso

### Rollback
```bash
rm -rf .next
git checkout -- package.json src/
npm install
```

---

## Sprint 2: Supabase Auth + Middleware (2-3h)
**Objetivo**: Auth flow seguro, rutas protegidas

### Tareas
- [ ] **T2.1**: Implementar Supabase Auth en Next.js
  - Crear app/(auth)/login/page.tsx (Supabase form)
  - Crear app/(auth)/signup/page.tsx (registro)
  - Usar supabase.auth.signInWithPassword(), signUp()

- [ ] **T2.2**: Crear middleware protector
  - Crear middleware.ts en root
  - Verificar sesión: supabase.auth.getSession()
  - Redirigir no autenticados a /login

- [ ] **T2.3**: Providers + Contexto
  - Crear app/(dashboard)/layout.tsx con Supabase provider
  - Reemplazar Base44 AuthContext con Supabase session
  - Pasar user via context

- [ ] **T2.4**: Logout
  - Crear app/api/auth/logout/route.ts O botón en Dashboard
  - supabase.auth.signOut()

- [ ] **T2.5**: Test auth flow
  - Signup → email verification (si enabled)
  - Login → redirige a Dashboard
  - Logout → redirige a Login
  - Try /dashboard sin login → redirige a /login
  - Refresh → session persiste

### Checklist de Terminación
- [ ] Signup/Login pages funcionales
- [ ] Middleware protege rutas
- [ ] Logout funciona
- [ ] Session persiste en refresh
- [ ] No regressions en Home

### Rollback
```bash
git checkout -- app/ middleware.ts
npm run dev
```

---

## Sprint 3: Dashboard + Accounts + Analytics (2-3h)
**Objetivo**: Migrar 3 páginas principales, CRUD básico

### Tareas
- [ ] **T3.1**: Migrar Dashboard
  - Crear app/(dashboard)/page.tsx
  - Reemplazar useQuery(['accounts']) con Supabase query
  - Calcular stats: P&L, Win rate (desde trades table)
  - Mantener layout/componentes UI (Radix)

- [ ] **T3.2**: Migrar Accounts
  - Crear app/(dashboard)/accounts/page.tsx
  - CRUD: listar, crear, editar, eliminar cuentas
  - Usar useMutation con supabase.from('accounts').insert()
  - Mantener dialogs, forms, validación

- [ ] **T3.3**: Migrar Analytics
  - Crear app/(dashboard)/analytics/page.tsx
  - Queries: trades con filtro status = 'Closed'
  - Recharts charts (mantener igual)
  - Calcular metrics (Win rate, Profit factor, etc.)

- [ ] **T3.4**: Crear Navigation
  - Crear components/Navigation.tsx (sidebar o topbar)
  - Links a Dashboard, Accounts, Analytics, Terminal
  - Logout button

- [ ] **T3.5**: Test CRUD
  - Crear cuenta → verifica en DB
  - Editar → cambio persiste
  - Eliminar → soft delete (is_deleted = true)
  - Listar → muestra datos correctos

### Checklist de Terminación
- [ ] 3 páginas migradas sin errors
- [ ] CRUD funciona (C, R, U, D)
- [ ] React Query caching funciona
- [ ] UI mantiene estilo original
- [ ] No Base44 hardcodes

### Rollback
```bash
git checkout -- app/(dashboard)/page.tsx app/(dashboard)/accounts/ app/(dashboard)/analytics/
```

---

## Sprint 4: Terminal + Journal + Goals + Setups (2-3h)
**Objetivo**: Migrar páginas secundarias

### Tareas
- [ ] **T4.1**: Migrar Terminal (página compleja)
  - Crear app/(dashboard)/terminal/page.tsx
  - Mantener tabs: Dossier, Market Drivers, Calendar, Evidence, Search, Reports
  - Reemplazar Base44 queries de TerminalNews, TerminalEvent, etc.
  - Mantener componentes: CalendarView, EvidenceView, SearchView

- [ ] **T4.2**: Migrar Journal
  - Crear app/(dashboard)/journal/page.tsx
  - CRUD de entries (date, title, content, mood, tags)
  - Mantener dialogs, formatting

- [ ] **T4.3**: Migrar Goals
  - Crear app/(dashboard)/goals/page.tsx
  - CRUD de goals (meta, target, progreso)
  - Progress bar visualization

- [ ] **T4.4**: Migrar Setups
  - Crear app/(dashboard)/setups/page.tsx
  - CRUD de trading setups
  - Campos: nombre, descripción, parámetros, checklist

- [ ] **T4.5**: Test todo
  - Navegar entre páginas sin errors
  - CRUD funciona en cada
  - Cache actualiza correctamente

### Checklist de Terminación
- [ ] 4 páginas nuevas migradas
- [ ] Terminal (más compleja) funciona
- [ ] Navegación entre todas las páginas
- [ ] Estilos consistentes

### Rollback
```bash
git checkout -- app/(dashboard)/{terminal,journal,goals,setups}/
```

---

## Sprint 5: Server Functions + Real-time Data (2-3h)
**Objetivo**: Live data, webhooks, edge functions

### Tareas
- [ ] **T5.1**: Convertir receiveMT5Data.ts → Supabase Edge Function
  - Crear supabase/functions/receive-mt5-data/index.ts
  - Endpoint: POST /functions/v1/receive-mt5-data
  - Valida symbol, bid, ask, last
  - Guarda en live_market_data table

- [ ] **T5.2**: Convertir generateScheduledReport.ts → Supabase Edge Function
  - Crear supabase/functions/generate-scheduled-report/index.ts
  - Obtiene datos: news, events, claims, structures, pools
  - Integra con IA (OpenAI key en env)
  - Guarda report en reports table

- [ ] **T5.3**: Real-time subscriptions (opcional pero recomendado)
  - Dashboard: subscribe a cambios en accounts → auto-update
  - Terminal: subscribe a live_market_data → live prices
  - supabase.from('table').on('*', callback).subscribe()

- [ ] **T5.4**: Webhook handlers
  - Documentar endpoint para MT5: /api/webhooks/mt5
  - Route handler que llama receive-mt5-data function

- [ ] **T5.5**: Test
  - POST a webhook → valida data en DB
  - Schedule report → verifica output
  - Real-time sub → verifica updates

### Checklist de Terminación
- [ ] 2 Edge Functions deployed
- [ ] Webhooks reciben datos correctamente
- [ ] Real-time funciona (si implementado)
- [ ] No errores en logs de Supabase

### Rollback
```bash
supabase functions delete receive-mt5-data
supabase functions delete generate-scheduled-report
```

---

## Sprint 6: PWA + Offline + Push (2-3h)
**Objetivo**: App offline-ready, installable, notificaciones

### Tareas
- [ ] **T6.1**: Service Worker Implementation
  - Implementar public/sw.js:
    - Cache estático (CSS, JS, componentes)
    - Cache dinámico (API responses)
    - Offline fallback (página)
  - Estrategia: Network-first para datos, Cache-first para assets

- [ ] **T6.2**: Manifest Validation
  - Verificar src/app/manifest.ts:
    - name, short_name, theme_color, background_color
    - icons: 192x192, 512x512 (generar si falta)
    - start_url: /
    - display: standalone

- [ ] **T6.3**: Offline-First Data
  - Usar IndexedDB para cache persistente (opcional)
  - Detectar offline: navigator.onLine
  - Mostrar indicator en UI (Conectado/Offline)
  - Queue mutations offline, sync cuando vuelva online

- [ ] **T6.4**: Push Notifications (opcional)
  - Registrar service worker para push
  - Supabase send notification endpoint
  - Pedir permiso al usuario
  - Trigger: reporte generado, trade cerrado

- [ ] **T6.5**: Lighthouse Audit
  - Correr Lighthouse en /
  - Objetivos: Performance ≥90, PWA ≥90, Accessibility ≥90, SEO ≥90
  - Fixear issues encontrados

### Checklist de Terminación
- [ ] App funciona sin internet (core pages)
- [ ] Manifest valida (PWA installable)
- [ ] Service Worker registrado, cachea funciona
- [ ] Lighthouse PWA score ≥90
- [ ] Push notifications setup (si tiempo)

### Rollback
```bash
rm -rf public/sw.js
git checkout -- src/app/manifest.ts
```

---

## Backlog (Post-MVP)

### Sprint 7: Trading Pages (importante pero POST-MVP)
- [ ] Migrar TradesHub + TradesMenu
- [ ] CRUD de trades (crear, listar, cerrar)
- [ ] Filtros avanzados
- [ ] Stats por cuenta

### Sprint 8-9: Business, Treasury, Map
- [ ] Business + Treasury (Sprint 8)
- [ ] Map (Sprint 9, si critical)

### Sprint 10-12: Polish + Testing
- [ ] Unit tests (Jest)
- [ ] E2E tests (Playwright)
- [ ] Performance optimization

---

## Criterios de Éxito

✅ **Sprint 1-2**: App boots, auth works, no Base44 errors
✅ **Sprint 3-4**: 7+ páginas migradas, CRUD funciona
✅ **Sprint 5**: Server functions en Supabase, webhooks reciben datos
✅ **Sprint 6**: App offline-ready, PWA score ≥90, installable

---

## Testing Checklist (Manual)

- [ ] Signup → Email verification
- [ ] Login → Dashboard carga
- [ ] Create account → Lista actualiza
- [ ] Edit → Cambios persisten
- [ ] Delete → Eliminado
- [ ] Offline: WiFi off → App funciona
- [ ] Logout → Redirige a login
- [ ] Mobile: Responsive en phones
- [ ] Lighthouse: Performance ≥90, PWA ≥90

---

## Rollback General

### Si algo falla en Sprint X:
```bash
git log --oneline | head -20
git revert HEAD --no-edit
npm run dev
```

### Si Supabase schema roto:
1. Backup database (SQL export desde dashboard)
2. DROP TABLE IF EXISTS table_name CASCADE;
3. Re-run migration: supabase migrations up

### Si Auth roto:
```bash
rm -rf .next
localStorage.clear()
sessionStorage.clear()
npm run dev
```

---

## Dependencias Nuevas (Sprint 1)

```json
{
  "@supabase/supabase-js": "^2.40+",
  "@tanstack/react-query": "^5.84+" (ya existe),
  "next-themes": "^0.4+" (ya existe),
  "@radix-ui/*": "*" (ya existe),
  "recharts": "^2.15+" (ya existe),
  "date-fns": "^3.6+" (ya existe),
  "zod": "^3.24+" (ya existe)
}
```

**Remover**:
- @base44/sdk
- @base44/vite-plugin
- react-router-dom
- vite
- @vitejs/*

---

## Estimación Total

| Sprint | Horas | Status |
|--------|-------|--------|
| 1 | 2-3h | ⏳ |
| 2 | 2-3h | ⏳ |
| 3 | 2-3h | ⏳ |
| 4 | 2-3h | ⏳ |
| 5 | 2-3h | ⏳ |
| 6 | 2-3h | ⏳ |
| **Total** | **12-18h** | |
| Backlog | TBD | Backlog |

**Línea de tiempo**: 3 semanas (1-2 sprints/día) → MVP ready

---

## Documentación Post-Migración

Post-Sprint 6, actualizar:
- [ ] README.md con instrucciones Supabase
- [ ] .env.local.example con todas las vars
- [ ] docs/ARCHITECTURE.md (stack, patterns)
- [ ] docs/DATABASE.md (schema, ERD)
- [ ] docs/DEPLOYMENT.md (Vercel, Supabase)
