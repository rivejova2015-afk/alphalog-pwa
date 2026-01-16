# TESTING_CHECKLIST - AlphaLog Migration

Checklist de pruebas y rollback para la migración Base44 → Next.js + Supabase.

---

## Pruebas Manuales (Post-Sprint)

### Sprint 1-2: Auth & Setup
- [ ] **Dev environment**
  - [ ] `npm install` sin errores
  - [ ] `npm run build` sin errores
  - [ ] `npm run dev` → localhost:3000 carga
  - [ ] `.env.local` tiene NEXT_PUBLIC_SUPABASE_URL, SUPABASE_ANON_KEY
  
- [ ] **Supabase connectivity**
  - [ ] Console: `await supabase.from('accounts').select()` retorna []
  - [ ] No errores de CORS
  - [ ] Migrations migradas correctamente

### Sprint 2: Auth Flow
- [ ] **Signup**
  - [ ] Navegar a `/signup`
  - [ ] Completar formulario (email, password)
  - [ ] Submit → success message o email verification
  - [ ] Si email verification enabled: verifica en inbox o console

- [ ] **Login**
  - [ ] Navegar a `/login`
  - [ ] Ingresar credenciales correctas
  - [ ] Login exitoso → redirige a Dashboard (`/`)
  - [ ] Dashboard muestra nombre del usuario o greeting

- [ ] **Protected Routes**
  - [ ] Sin login: intenta acceder `/accounts` → redirige a `/login`
  - [ ] Con login: `/accounts` carga normalmente

- [ ] **Session Persistence**
  - [ ] Estar logueado en Dashboard
  - [ ] Refrescar página (F5)
  - [ ] Session persiste, no redirige a login
  - [ ] Logout y refrescar → redirige a login

- [ ] **Logout**
  - [ ] Estar logueado en Dashboard
  - [ ] Click Logout button
  - [ ] Redirige a `/login`
  - [ ] Back button no deja volver a Dashboard

### Sprint 3-4: CRUD Operations
- [ ] **Create (Accounts)**
  - [ ] `/accounts` → Click "New Account"
  - [ ] Completar formulario (nombre, balance, etc.)
  - [ ] Submit → Success toast
  - [ ] Lista se actualiza con nueva cuenta
  - [ ] Verificar en DB Supabase (dashboard)

- [ ] **Read (Accounts)**
  - [ ] `/accounts` → Lista muestra todas las cuentas
  - [ ] Filtros funcionan (si existen)
  - [ ] Sorting funciona (si existe)
  - [ ] Loading skeleton aparece si toma tiempo

- [ ] **Update (Accounts)**
  - [ ] `/accounts` → Click Edit en una cuenta
  - [ ] Cambiar datos (nombre, balance)
  - [ ] Submit → Success toast
  - [ ] Lista se actualiza
  - [ ] Verificar cambios en DB Supabase

- [ ] **Delete (Accounts)**
  - [ ] `/accounts` → Click Delete en una cuenta
  - [ ] Confirmar eliminación
  - [ ] Success toast
  - [ ] Cuenta desaparece de lista
  - [ ] Verificar is_deleted = true en DB

- [ ] **Repear CRUD para**: Analytics, Journal, Goals, Setups
  - Similar a Accounts pero con datos específicos

### Sprint 5: Real-time & Webhooks
- [ ] **Real-time Updates** (si implementado)
  - [ ] 2 browsers abiertos del mismo usuario
  - [ ] En Browser A: crear/editar cuenta
  - [ ] En Browser B: lista actualiza automáticamente sin refresh

- [ ] **MT5 Webhook**
  - [ ] POST a `https://localhost:3000/api/webhooks/mt5` (o endpoint que definas)
  - [ ] Body: `{ symbol: "EURUSD", bid: 1.1000, ask: 1.1005, last: 1.1002 }`
  - [ ] Respuesta: `{ ok: true, data: {...} }`
  - [ ] Verificar en `live_market_data` table en Supabase

- [ ] **Scheduled Report** (si implementado)
  - [ ] Crear ReportSchedule con instrumento
  - [ ] Trigger cron o manual
  - [ ] Verificar resultado en `reports` table
  - [ ] Datos incluyen: news, events, claims, IA analysis

### Sprint 6: PWA & Offline
- [ ] **Service Worker Registration**
  - [ ] Dev tools → Applications → Service Workers
  - [ ] Status: "activated and running"
  - [ ] Verifica `public/sw.js` es cargado

- [ ] **Offline Functionality**
  - [ ] Chrome DevTools → Network → Offline
  - [ ] Navegar `/`, `/dashboard`, `/accounts`
  - [ ] Pages cargan desde cache (sin spinner)
  - [ ] Si intentas crear/editar: enqueue mutation (si implementado)

- [ ] **Manifest & Installability**
  - [ ] Chrome DevTools → Applications → Manifest
  - [ ] name, short_name, icons presentes
  - [ ] display: standalone
  - [ ] iOS: Home screen → Add to Home Screen → funciona
  - [ ] Android: Menu (3 dots) → Install app → funciona

- [ ] **Push Notifications** (si implementado)
  - [ ] Browser pide permiso para notificaciones
  - [ ] Permite permiso
  - [ ] Trigger evento (report generado, trade cerrado)
  - [ ] Notificación aparece en OS (no solo browser)

- [ ] **Lighthouse Audit**
  - [ ] Open DevTools → Lighthouse
  - [ ] Select: Performance, PWA, Accessibility, SEO
  - [ ] Click "Analyze page load"
  - [ ] Verificar scores:
    - [ ] Performance ≥ 90
    - [ ] PWA ≥ 90
    - [ ] Accessibility ≥ 90
    - [ ] SEO ≥ 90
  - [ ] Si < 90: revisar report y fixear issues prioritarios

---

## Pruebas Automatizadas (Post-MVP, Opcional)

### Unit Tests (Jest)
```bash
npm run test
```
- [ ] lib/supabase/* functions funcionan
- [ ] Utils (calcular stats, filtering) correctas
- [ ] Error handling funciona

### E2E Tests (Playwright)
```bash
npm run test:e2e
```
- [ ] Sign up → email verification → login
- [ ] Dashboard load → lists data
- [ ] Create account → appears in list
- [ ] Logout → redirect to login

---

## Responsiveness Testing

### Desktop (1920x1080)
- [ ] Dashboard layout correcto
- [ ] Navbar visible, responsive
- [ ] Tables/cards bien organizadas
- [ ] No overflow de contenido

### Tablet (768x1024)
- [ ] Navbar → hamburger menu (si aplica)
- [ ] Sidebar → collapses o drawer
- [ ] Tables → scroll horizontales si necesario
- [ ] Buttons/inputs tamaño táctil

### Mobile (375x667)
- [ ] Full stack layout (no 2 columnas)
- [ ] Navbar hamburger menu
- [ ] Bottom navigation (si aplica)
- [ ] Forms legibles
- [ ] Botones clickeables (min 44x44px)

---

## Performance Benchmarks

### Load Time
- [ ] First Contentful Paint (FCP): < 2s
- [ ] Largest Contentful Paint (LCP): < 2.5s
- [ ] Cumulative Layout Shift (CLS): < 0.1

### API Performance
- [ ] Supabase query (accounts list): < 500ms
- [ ] Dashboard load (3+ queries): < 1.5s
- [ ] Auth check (middleware): < 100ms

### Build Size
```bash
npm run build
# Check .next/static size
```
- [ ] JS bundle: < 200KB (gzipped)
- [ ] CSS bundle: < 50KB (gzipped)
- [ ] No unused dependencies

---

## Browser Compatibility

- [ ] Chrome 120+ (Chromium-based)
- [ ] Firefox 121+
- [ ] Safari 17+ (macOS)
- [ ] Safari iOS 17+ (mobile)
- [ ] Edge 120+

---

## Security Checklist

- [ ] No hardcoded secrets en código
- [ ] Supabase key is PUBLIC_ANON (no service role en frontend)
- [ ] Middleware verifica session antes de cada request
- [ ] CORS configurado correctamente (solo Supabase)
- [ ] Content Security Policy headers si aplica
- [ ] SQL injection: Supabase parameterized queries (no template strings)
- [ ] XSS: React auto-escapa content (salvo dangerouslySetInnerHTML)

---

## Rollback Procedures

### Quick Rollback (< 5 min)
Si todo falla y necesitas revertir últimos cambios:
```bash
# Ver últimos commits
git log --oneline | head -10

# Revertir último commit
git revert HEAD --no-edit

# O restore archivo específico
git restore app/(dashboard)/page.tsx

# Reiniciar dev server
npm run dev
```

### Full Rollback (Volver a Base44 original)
Si migration fue un desastre total:
```bash
# Checkout última commit estable antes de Sprint 1
git checkout <commit-hash-antes-migration>

# Limpiar node_modules, .next
rm -rf node_modules .next
npm install

# Restaurar .env original
git checkout -- .env.local

npm run dev
```

### Database Rollback
Si schema SQL roto:
1. **Supabase Dashboard → SQL Editor**
   - Copiar dump actual (backup)
   - DROP TABLE IF EXISTS <corrupted_table> CASCADE;
   
2. **Re-run migration**
   ```bash
   supabase db push --dry-run  # Preview
   supabase db push             # Apply
   ```

3. **Seed datos si necesario**
   ```bash
   supabase seed run
   ```

### Auth Rollback
Si Supabase auth roto:
```bash
# Clear all auth data locally
rm -rf .next
localStorage.clear()
sessionStorage.clear()

# Try login with test account
npm run dev
# Go to /login, use test credentials
```

### Supabase Project Recovery
Si proyecto entero inservible:
1. **Create new Supabase project**
2. **Restore from backup** (si tienes)
3. **Or re-run migrations** en nuevo proyecto:
   ```bash
   supabase projects list
   supabase link --project-ref <nuevo-project-id>
   supabase db push
   supabase seed run
   ```

---

## Sign-Off

- [ ] Sprint 1 completed and tested
- [ ] Sprint 2 completed and tested
- [ ] Sprint 3 completed and tested
- [ ] Sprint 4 completed and tested
- [ ] Sprint 5 completed and tested
- [ ] Sprint 6 completed and tested
- [ ] All critical tests passing
- [ ] Lighthouse score ≥ 90 (all categories)
- [ ] No P0 issues open
- [ ] Documentation updated
- [ ] Ready for production deployment

**Migration Status**: ⏳ Ready to start  
**Last Updated**: 2026-01-15  
**Next Review**: Post-Sprint 1
