# TESTING_CHECKLIST - AlphaLog Migration

Checklist de pruebas y rollback para la migración Base44 → Next.js + Supabase.

---

## Sprint 10.9: Playwright E2E Testing

### Setup for E2E Testing
1. Create `.env.local` in project root (copy from `.env.example`)
2. Set E2E variables:
   ```bash
   E2E_EMAIL=test@alphalog.local
   E2E_PASSWORD=Test@123456
   PLAYWRIGHT_BASE_URL=http://localhost:3000
   ```
3. Ensure test user account exists in Supabase with email/password auth
4. Install Playwright:
   ```bash
   npm install @playwright/test
   ```

### Test Execution

#### Run all E2E tests
```bash
npm run test:e2e
```

#### Run specific test file
```bash
npm run test:e2e -- tests/e2e/auth.spec.ts
```

#### Run in debug mode (opens inspector)
```bash
npm run test:e2e:debug
```

#### Run in UI mode (interactive)
```bash
npm run test:e2e:ui
```

#### View HTML report
```bash
npm run test:e2e:report
```

#### Run verify:all (build + e2e + audit)
```bash
npm run verify:all
```

---

## Sprint 10.6–10.9: AlphaShield Complete Verification

### ✅ Sprint 10.6: Sprint Audit + verify:all

**Verification Command**:
```bash
npm run verify:all
```

**What it does**:
1. Runs `npm run build` — Compiles Next.js application
2. Runs `npm run test:e2e` — Executes 24+ Playwright tests
3. Runs `npm run audit:sprints` — Compares planned vs implemented

**Expected Output**:
```
✓ Build successful (0 errors)
✓ E2E tests passing (24+ tests)
✓ Audit report generated: docs/SPRINT_AUDIT.md
```

**Success Criteria**:
- [ ] Build time < 5 seconds
- [ ] All 24+ E2E tests pass
- [ ] Audit shows 4/4 sprints complete
- [ ] No TypeScript errors

---

### ✅ Sprint 10.7: app_logs + logger + ingest + 30-day retention

**Database Verification**:
```sql
-- Check app_logs table exists
SELECT table_name FROM information_schema.tables 
WHERE table_name='app_logs';

-- Verify RLS policies (owner-only access)
SELECT policyname FROM pg_policies 
WHERE tablename = 'app_logs';

-- Check indexes
SELECT indexname FROM pg_indexes 
WHERE tablename = 'app_logs';
```

**Expected**: 1 table, 2 RLS policies, 4 indexes

**API Endpoint Verification**:
```bash
# Test ingest endpoint
curl -X POST http://localhost:3000/api/logs/ingest \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "level": "ERROR",
    "area": "Dashboard",
    "message": "Test error",
    "fingerprint": "test-error-1"
  }'

# Expected response:
# { "success": true, "message": "Log recorded" }
```

**Logger Library Test**:
```typescript
// src/lib/logger.ts should export:
import { logger } from '@/lib/logger';

logger.error('Test', 'This is a test error', { 
  context: { userId: '123' } 
});
// Should appear in /dashboard/logs/system after 2 seconds
```

**Retention Verification** (after 30 days):
```sql
-- Verify cleanup job runs
SELECT COUNT(*) as active_logs 
FROM app_logs 
WHERE user_id = '[USER_ID]' 
  AND expires_at > NOW();
```

**Success Criteria**:
- [ ] app_logs table in Supabase
- [ ] RLS policies enforced (owner-only)
- [ ] Deduplication working (fingerprint-based)
- [ ] Rate limiting active (5 req/min)
- [ ] No secrets logged (redaction working)
- [ ] 30-day retention configured
- [ ] Cleanup job operational

---

### ✅ Sprint 10.8: UI /dashboard/logs/system

**Navigation Verification**:
```bash
# 1. Start dev server
npm run dev

# 2. Navigate to
http://localhost:3000/dashboard/logs/system

# 3. Verify page loads without errors
```

**Features to Verify**:
- [ ] Page loads without blank content
- [ ] Real-time log streaming works
- [ ] Filter by level (ERROR, WARN, INFO, DEBUG)
- [ ] Filter by area/component
- [ ] Search by message
- [ ] Pagination works (50 logs per page)

**Debug Bundle Verification**:
```bash
# 1. Click "Export Debug Bundle" button
# 2. Verify JSON file downloads with:
#    - id, level, area, message, details, created_at
# 3. File should be named: debug-bundle-TIMESTAMP.json
```

**Copy Codex Fix Prompt**:
```bash
# 1. Select any error log
# 2. Click "Copy Fix Prompt"
# 3. Verify clipboard has:
#    - Error message
#    - Area/component
#    - Timestamp
#    - Sensitive data masked
# 4. Paste in ChatGPT/Claude for AI fix suggestion
```

**Safe Mode**:
```bash
# 1. Toggle Safe Mode switch
# 2. Verify shows only ERROR + WARN logs
# 3. Toggle off to see all levels again
```

**Success Criteria**:
- [ ] Page loads without errors
- [ ] All filters working
- [ ] Search finding logs
- [ ] Export generating valid JSON
- [ ] Copy Prompt formatted correctly
- [ ] Safe Mode reducing verbosity
- [ ] No design changes to rest of app
- [ ] No secrets visible in logs

---

### ✅ Sprint 10.9: Playwright E2E Tests

**Test Execution** (from above section)

**Expected Results**:
```
8 test suites, 24+ test cases
├── auth.spec.ts (3 tests)
├── navigation.spec.ts (7 tests)
├── tradehub.spec.ts (2 tests)
├── treasury.spec.ts (2 tests)
├── business.spec.ts (2 tests)
├── logs.spec.ts (2 tests)
├── tradermap.spec.ts (3 tests)
└── smoke.spec.ts (3 tests)

✓ All tests passing (24+ passed)
```

**Test Scenarios Verified**:
- [ ] Login with email/password works
- [ ] Invalid credentials show error
- [ ] Dashboard loads without blank page
- [ ] All 7 modules accessible
- [ ] Create trade workflow complete
- [ ] Create treasury item workflow complete
- [ ] Create business item workflow complete
- [ ] Create log entry workflow complete
- [ ] Cross-module navigation error-free
- [ ] Session persists across navigation

**Success Criteria**:
- [ ] 24+ tests passing
- [ ] No flaky tests
- [ ] All modules covered
- [ ] Create workflows working
- [ ] No blank pages detected
- [ ] HTML report generating
- [ ] Screenshots on failure working

---

### 🎯 Complete Verification (All Sprints 10.6–10.9)

**Master Checklist**:
```bash
# 1. Build verification
npm run build
# Expected: Success, < 5 seconds, 0 TypeScript errors

# 2. E2E tests verification
npm run test:e2e
# Expected: 24+ tests passing

# 3. Audit verification
npm run audit:sprints
# Expected: Generates docs/SPRINT_AUDIT.md

# 4. Full verification (all three)
npm run verify:all
# Expected: All three succeed
```

**Manual Testing Checklist**:
- [ ] Visit http://localhost:3000/auth/login
- [ ] Login with test@alphalog.local / Test@123456
- [ ] Navigate /dashboard (no blank page)
- [ ] Visit /dashboard/tradehub (create trade)
- [ ] Visit /dashboard/treasury (create item)
- [ ] Visit /dashboard/business (create item)
- [ ] Visit /dashboard/logs (create entry + view system logs)
- [ ] Visit /dashboard/terminal (loads)
- [ ] Visit /dashboard/tradermap (loads)
- [ ] Logout (redirects to /auth/login)

**Security Verification**:
- [ ] No passwords in browser console logs
- [ ] No API keys visible in network tab
- [ ] No sensitive data in app_logs table
- [ ] Deduplication preventing duplicate logs
- [ ] Rate limiting preventing log flooding
- [ ] RLS policies blocking cross-user access

**Performance Verification**:
- [ ] Page load < 3 seconds
- [ ] Tests complete < 5 minutes
- [ ] Build < 5 seconds
- [ ] API responses < 200ms

---

### 🔄 Quick Rollback (Any Sprint)

**If anything breaks**:
```bash
# 1. See logs/error details
npm run dev

# 2. Check recent changes
git log --oneline -10

# 3. Revert last commit (if safe)
git revert HEAD

# 4. Or rollback specific file
git checkout -- [FILE_PATH]

# 5. Rebuild and test
npm run build
npm run test:e2e
```

**Complete Rollback** (if needed):
See next section "Rollback Plan" below

### E2E Test Suite Overview

#### 1. Authentication Tests (`tests/e2e/auth.spec.ts`)
- [ ] Login with email/password
- [ ] Show error on invalid credentials
- [ ] Logout successfully

**Run**: `npm run test:e2e -- tests/e2e/auth.spec.ts`

#### 2. Navigation Tests (`tests/e2e/navigation.spec.ts`)
- [ ] Dashboard loads without blank page
- [ ] TradeHub module accessible
- [ ] Treasury module accessible
- [ ] Business module accessible
- [ ] TraderMap module accessible
- [ ] Terminal module accessible
- [ ] Logs module accessible

**Run**: `npm run test:e2e -- tests/e2e/navigation.spec.ts`

#### 3. TradeHub Create Flow (`tests/e2e/tradehub.spec.ts`)
- [ ] Create new trade with entry/exit prices
- [ ] Verify item appears in list
- [ ] No blank page

**Run**: `npm run test:e2e -- tests/e2e/tradehub.spec.ts`

#### 4. Treasury Create Flow (`tests/e2e/treasury.spec.ts`)
- [ ] Create new treasury item with amount
- [ ] Verify item in list
- [ ] No blank page

**Run**: `npm run test:e2e -- tests/e2e/treasury.spec.ts`

#### 5. Business Create Flow (`tests/e2e/business.spec.ts`)
- [ ] Create new business item
- [ ] Verify item in list
- [ ] No blank page

**Run**: `npm run test:e2e -- tests/e2e/business.spec.ts`

#### 6. Logs Create Flow (`tests/e2e/logs.spec.ts`)
- [ ] Create new log entry
- [ ] Verify log in list
- [ ] No blank page

**Run**: `npm run test:e2e -- tests/e2e/logs.spec.ts`

#### 7. TraderMap Tests (`tests/e2e/tradermap.spec.ts`)
- [ ] Load without blank page
- [ ] Interactive map or content visible
- [ ] Navigation works

**Run**: `npm run test:e2e -- tests/e2e/tradermap.spec.ts`

#### 8. Smoke Tests (`tests/e2e/smoke.spec.ts`)
- [ ] All modules load without blank pages
- [ ] Navigate between modules without errors
- [ ] Maintain logged-in state

**Run**: `npm run test:e2e -- tests/e2e/smoke.spec.ts`

### Troubleshooting E2E Tests

**Issue**: Tests fail with "page.goto: net::ERR_CONNECTION_REFUSED"
- **Solution**: Make sure `npm run dev` is running in another terminal
- Or set `PLAYWRIGHT_BASE_URL` to correct URL

**Issue**: Login fails with "No matching element found"
- **Solution**: Verify test account exists in Supabase
- Check E2E_EMAIL and E2E_PASSWORD in `.env.local`
- Verify form field selectors match your login page

---

## Prod 24/7 + iOS/PC (Sprint 14)

### Health Endpoints
- Open https://dominio.com/health → shows "ok" (200)
- Open https://dominio.com/api/health → returns `{ ok: true, ts }`

### Manifest
- Open https://dominio.com/manifest.webmanifest → served OK

### iOS A2HS
- Safari → open prod → Share → Add to Home Screen → open standalone
- Login → redirected to /dashboard without white screen

### PC PWA
- Install from browser → open app → login → /dashboard

### Service Worker
- DevTools Application → SW active
- Ensure /auth/*, /auth/callback, /api/auth/* are network-only
- Ensure URLs with `code`/`state` query params are not cached

### Offline (read-only)
- Visit /dashboard once online to warm cache
- Go offline → reload → assets load and minimal view renders

### Push Diagnostics
- Visit /dashboard/logs/pwa
- Check SW status, notification permission, and subscription
- Click "Activar notificaciones" → grant permission
- Click "Suscribirse" → creates subscription
- Click "Test Push" → sends notification (or shows clear message if not configured)

**Issue**: Tests timeout on "waitForURL"
- **Solution**: Increase timeout: `await page.waitForURL(..., { timeout: 20000 })`
- Check if authentication is working manually

**Issue**: "Session expired" errors
- **Solution**: Playwright tests may not preserve session cookies properly
- Each test re-authenticates (see auth.fixture.ts)

### Quick Local Test

1. **Terminal 1**: Start dev server
   ```bash
   npm run dev
   ```

2. **Terminal 2**: Run E2E tests
   ```bash
   npm run test:e2e
   ```

3. **View results**:
   ```bash
   npm run test:e2e:report
   ```

### CI/CD Considerations

For GitHub Actions or other CI:
1. Set environment variables in secrets
2. Use `--headed` flag to see browser (optional)
3. E2E tests run AFTER build in `verify:all`
4. Ensure test database has test user account
5. Consider using `--workers=1` for serial execution

### Notes

- Tests use flexible selectors to handle multiple UI variations
- Form fields are optional (tests gracefully skip if create form not available)
- All tests validate "no blank page" as minimum requirement
- Tests are designed for LOCAL testing (no external dependencies)
- OAuth/Google login NOT supported in E2E (email/password only)

---

## Sprint 10.8: AlphaShield UI (System Diagnostics)

### Setup
- [ ] Sprint 10.7 completed (logging system working)
- [ ] Safe mode utilities imported into logger
- [ ] System page accessible at `/dashboard/logs/system`

### Test 1: System Diagnostics Display
1. Navigate to `/dashboard/logs/system`
2. Verify page loads without errors
3. Check System Status section shows:
   - [ ] Connection status (Online/Offline)
   - [ ] Service Worker status
   - [ ] Manifest detection
   - [ ] Push subscription status
4. Verify all badges display correctly (green for active, gray for inactive)

### Test 2: Recent Errors Display
1. Open DevTools console, trigger error: `await logger.error('test', 'Test error')`
2. Go to `/dashboard/logs/system`
3. Verify Recent Errors section shows the error
4. Check error details:
   - [ ] Area displayed
   - [ ] Message shown
   - [ ] Timestamp correct
   - [ ] Fingerprint shown on expand
5. Verify list updates every 5 seconds

### Test 3: Safe Mode Activation
1. Trigger 3 errors rapidly in console:
   ```javascript
   import { logger } from '@/lib/alphashield/logger';
   for (let i = 0; i < 3; i++) {
     await logger.error('test', `Error ${i}`, new Error('test'));
   }
   ```
2. Verify Safe Mode banner appears at `/dashboard/logs/system`
3. Refresh page → banner should still appear (persisted in localStorage)
4. Click "Salir" button
5. Verify banner disappears
6. Verify error counter reset in localStorage

### Test 4: Safe Mode UI Integration
1. Activate Safe Mode (trigger 3 errors)
2. Navigate to other dashboard pages (tradehub, treasury, etc.)
3. Verify Safe Mode banner appears at top of all dashboard pages
4. Verify write buttons (Create, Save) are disabled/hidden
5. Test `shouldDisableWrites()` helper returns true

### Test 5: Debug Bundle Generation
1. Navigate to `/dashboard/logs/system`
2. Scroll to "Debug Bundle" section
3. Click "Copy JSON" button
4. Paste in text editor: `Ctrl+V`
5. Verify JSON contains:
   - [ ] timestamp
   - [ ] url
   - [ ] userAgent
   - [ ] safeMode flag
   - [ ] systemDiagnostics object
   - [ ] recentErrors array (≤20 items)
   - [ ] queueSize number
6. Verify NO sensitive data:
   - [ ] Search for "token" → should not find any real tokens
   - [ ] Search for "password" → should show `[REDACTED]`
   - [ ] Search for "secret" → should show `[REDACTED]`

### Test 6: Codex Fix Prompt Generation
1. Navigate to `/dashboard/logs/system`
2. Scroll to "Codex Fix Prompt" section
3. Click "Copy Prompt" button
4. Paste in text editor
5. Verify prompt includes:
   - [ ] Problem summary with top error
   - [ ] Error frequency (occurrence count)
   - [ ] Likely files affected (inferred from area)
   - [ ] System context (online, SW, push)
   - [ ] Steps to reproduce
   - [ ] Debug bundle as JSON
6. Verify prompt is well-formatted and ready for Claude/GPT

### Test 7: Offline Detection
1. Open DevTools → Network tab
2. Toggle offline mode
3. Go to `/dashboard/logs/system`
4. Verify System Diagnostics shows "Offline"
5. Wait for auto-update (should reflect within 1 sec)
6. Come back online
7. Verify shows "Online"

### Test 8: No Blank Page
1. Hard refresh `/dashboard/logs/system` multiple times
2. Test with slow 3G network throttling
3. Verify page always shows content (never blank)
4. Verify graceful error handling if diagnostics fail

### Test 9: Copy to Clipboard Feedback
1. Click "Copy JSON" button
2. Verify button changes to "✓ Copied" for 2 seconds
3. Verify text actually copied (paste elsewhere)
4. Click "Copy Prompt" button
5. Verify same feedback behavior
6. Test on multiple browsers (Chrome, Firefox, Safari)

### Test 10: Integration with Logger
1. Ensure logger has registered safe mode callback
2. Trigger error in app: `await logger.error('area', 'msg', error)`
3. Verify error counter increments (check localStorage)
4. Trigger 3 total errors within 60s window
5. Verify safe mode activates automatically
6. Check `/dashboard/logs/system` shows Safe Mode Active message

---

## ⚡ Quick Verification Commands (Updated)

### Sprint Audit


### Sprint Audit
Comparar lo planeado (MIGRATION_PLAN.md) vs lo implementado en código:

```bash
npm run audit:sprints
```

**Output**: Genera `docs/SPRINT_AUDIT.md` con:
- ✅/⚠️/❌ estado de cada Sprint (1-6)
- Rutas implementadas vs esperadas
- Endpoints implementados vs esperados  
- Migraciones en supabase/migrations
- Edge functions en supabase/functions

**Uso**: Verificar antes de cada sprint que lo anterior está completo.

### Full Verification
Build + Audit en un comando:

```bash
npm run verify:all
```

**Verifica**:
1. ✅ Build compila sin errores (`npm run build`)
2. ✅ Audit genera reporte (`npm run audit:sprints`)

**Uso**: Cierre de sprint, antes de merge a main.

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

### Sprint 3.1: Logs & Categories (Nuevo)
- [ ] **Migration 002 Applied**
  - [ ] Console: `await supabase.from('categories').select()` retorna []
  - [ ] `await supabase.from('logs').select()` retorna []
  - [ ] `await supabase.from('tags').select()` retorna []
  - [ ] `await supabase.from('log_attachments').select()` retorna []
  - [ ] Triggers y índices creados sin errores

- [ ] **Categories CRUD** (Owner-only RLS)
  - [ ] **Create**: POST `/api/categories` con name → crea en DB con auth.uid()
  - [ ] **Read**: GET `/api/categories` → lista solo del usuario (RLS enforced)
  - [ ] **Update**: PATCH `/api/categories/{id}` → actualiza solo si auth.uid() = user_id
  - [ ] **Delete (Soft)**: DELETE `/api/categories/{id}` → sets deleted_at = now()
  - [ ] **Restore**: PATCH `/api/categories/{id}/restore` → sets deleted_at = null

- [ ] **Anti-duplicados: Categories**
  - [ ] Usuario A crea categoría "Trading"
  - [ ] Usuario A intenta crear otro "Trading" → error UNIQUE CONSTRAINT (name_lower)
  - [ ] Usuario A crea "trading" (lower) → error (case-insensitive)
  - [ ] Usuario A borra "Trading" (soft-delete)
  - [ ] Usuario A puede crear "Trading" nuevamente (unique index ignora deleted_at)
  - [ ] Usuario B puede crear "Trading" (su propio user_id, independiente)

- [ ] **Tags CRUD** (Owner-only RLS)
  - [ ] **Create**: POST `/api/tags` con name → crea con auth.uid()
  - [ ] **Read**: GET `/api/tags` → lista solo del usuario (RLS)
  - [ ] **Update**: PATCH `/api/tags/{id}`
  - [ ] **Delete (Soft)**: DELETE `/api/tags/{id}`
  - [ ] **Anti-duplicados**: mismo que categories (name_lower unique per user)

- [ ] **Logs CRUD** (Owner-only RLS, category_id obligatorio)
  - [ ] **Create**: POST `/api/logs` con { title, notes, categoryId, tags?, files? }
    - [ ] title y notes no vacíos
    - [ ] categoryId obligatorio (NOT NULL)
    - [ ] Si no existe category → error foreign key
    - [ ] created_day_utc generado automáticamente
    - [ ] created_at = now() (server side)
  - [ ] **Read**: GET `/api/logs?categoryId=...&tags=...&dateRange=...&page=...`
    - [ ] Solo logs del usuario (RLS: deleted_at is null)
    - [ ] Paginación funciona (cursor-based o offset)
    - [ ] Filtros por categoryId, tags, rango de fecha
    - [ ] Ordenamiento por created_at desc
  - [ ] **Update**: PATCH `/api/logs/{id}` con { title, notes, categoryId, tags }
    - [ ] Actualiza updated_at automáticamente (trigger)
    - [ ] No permite borrar category_id (siempre obligatorio)
  - [ ] **Delete (Soft)**: DELETE `/api/logs/{id}` → sets deleted_at = now()

- [ ] **Anti-duplicados: Logs (mismo día UTC)**
  - [ ] Usuario A crea log "Day Trading Note" el 2026-01-17
  - [ ] Usuario A intenta crear otro "Day Trading Note" el 2026-01-17 → error UNIQUE CONSTRAINT
  - [ ] Usuario A crea "day trading note" (lower) mismo día → error (case-insensitive)
  - [ ] Usuario A crea "Day Trading Note" el 2026-01-18 → OK (otro día)
  - [ ] Usuario A borra log original (soft-delete)
  - [ ] Usuario A puede crear "Day Trading Note" el 2026-01-17 nuevamente (unique ignora deleted_at)
  - [ ] Usuario B puede crear "Day Trading Note" el 2026-01-17 (independiente por user_id)

- [ ] **Log Tags Association (N:M)**
  - [ ] Crear log con tags: POST `/api/logs` con { ..., tags: [tag_id_1, tag_id_2] }
  - [ ] Registros en log_tags creados para ambos tags
  - [ ] GET `/api/logs/{id}` retorna tags asociados (joined)
  - [ ] PATCH `/api/logs/{id}` con nuevos tags: reemplaza asociaciones
  - [ ] DELETE log → cascada borra registros en log_tags

- [ ] **Attachments Multiple** (Storage + RLS)
  - [ ] **Upload**: POST `/api/logs/{id}/attachments` con FormData(file)
    - [ ] Archivo sube a bucket `log_attachments` con path: `${user_id}/${log_id}/${uuid}_${filename}`
    - [ ] Registro en log_attachments creado (filename, mime_type, size_bytes)
    - [ ] sorted_index asignado (0, 1, 2...)
  - [ ] **Read**: GET `/api/logs/{id}/attachments`
    - [ ] Lista attachments del log (RLS: solo si auth.uid() = user_id)
    - [ ] Genera signed URL para descargar (válida 1 hora)
  - [ ] **Download**: Signed URL funciona (descarga archivo sin auth nuevamente)
  - [ ] **Delete (Soft)**: DELETE `/api/logs/{id}/attachments/{attachmentId}`
    - [ ] sets deleted_at = now() en DB
    - [ ] Archivo en storage se mantiene (no borra de verdad)
  - [ ] **Permanent Delete**: DELETE `/api/logs/{id}/attachments/{attachmentId}?permanent=true`
    - [ ] Borra registro de DB
    - [ ] Borra archivo de storage (si implementado)

- [ ] **RLS Enforcement** (2 usuarios)
  - [ ] **Setup**: 2 cuentas test (user_a@test.com, user_b@test.com)
  - [ ] User A: crea categoría "Private Trading" + log "Secret Note"
  - [ ] User A: session token válido
  - [ ] **A cannot see B's data**:
    - [ ] GET `/api/categories` (User B token) → no ve "Private Trading"
    - [ ] GET `/api/logs` (User B token) → no ve "Secret Note"
    - [ ] PATCH `/api/logs/{user_a_log_id}` (User B token) → error RLS
    - [ ] DELETE `/api/logs/{user_a_log_id}` (User B token) → error RLS
  - [ ] **B cannot update A's data**:
    - [ ] POST `/api/logs` (User B) con category_id de User A → error (RLS in join)
    - [ ] PATCH `/api/logs/{user_a_log_id}` (User B) → error RLS policy

- [ ] **Soft-Delete & Papelera**
  - [ ] Crear log, luego DELETE → soft-delete (deleted_at = now())
  - [ ] GET `/api/logs` → no aparece (RLS: deleted_at is null)
  - [ ] GET `/api/logs/trash` (nuevo endpoint) → lista logs con deleted_at not null
  - [ ] PATCH `/api/logs/{id}/restore` → sets deleted_at = null
  - [ ] Aparece nuevamente en GET `/api/logs`
  - [ ] DELETE `/api/logs/{id}?permanent=true` → borra para siempre de BD

- [ ] **Edge Cases**
  - [ ] Crear log con categoryId null → error NOT NULL CONSTRAINT
  - [ ] Crear log con categoryId inexistente → error FOREIGN KEY CONSTRAINT
  - [ ] Crear log con title = "" (vacío) → error CHECK CONSTRAINT (length > 0)
  - [ ] Crear log con notes = "" → error CHECK CONSTRAINT
  - [ ] UPDATE log: cambiar category_id a null → error NOT NULL
  - [ ] DELETE category con logs asociados → error FOREIGN KEY (on delete restrict)
  - [ ] DELETE tag con logs asociados → cascada OK (no borra logs, solo asociaciones)

### Sprint 4.1: TradeHub > Accounts CRUD (Nuevo)
- [ ] **Migration 003 Applied**
  - [ ] Console: `await supabase.from('account_categories').select()` retorna []
  - [ ] `await supabase.from('accounts').select()` retorna []
  - [ ] Triggers y índices creados sin errores
  - [ ] RLS policies en ambas tablas

- [ ] **Account Categories CRUD** (Owner-only RLS)
  - [ ] **Create**: POST `/api/account-categories` con name
    - [ ] name_lower GENERATED automáticamente (lowercase)
    - [ ] sort_index asignado
    - [ ] created_at = now() (server side)
  - [ ] **Read**: GET `/api/account-categories`
    - [ ] Lista solo categorías del usuario (deleted_at is null)
    - [ ] RLS enforced
  - [ ] **Seed Default Categories**: Button en AccountDialog
    - [ ] Click "Crear categorías sugeridas" (si no existen)
    - [ ] POST `/api/account-categories` con 5 categorías:
      - [ ] Propfirm Forex
      - [ ] Propfirm Futuros
      - [ ] Forex Real
      - [ ] Futuros Real
      - [ ] Opciones
    - [ ] Todas creadas con user_id = auth.uid()
  - [ ] **Anti-duplicados**: Categories
    - [ ] Usuario A crea "Propfirm Forex"
    - [ ] Usuario A intenta crear otro "Propfirm Forex" → error 409 UNIQUE CONSTRAINT
    - [ ] Usuario A intenta "propfirm forex" (lower) → error (case-insensitive via name_lower)
    - [ ] Usuario A borra categoría (soft-delete)
    - [ ] Usuario A puede crear "Propfirm Forex" nuevamente (unique index ignora deleted_at)
    - [ ] Usuario B puede crear "Propfirm Forex" (independiente)

- [ ] **Accounts CRUD** (Owner-only RLS, category_id obligatorio)
  - [ ] **Create**: POST `/api/accounts` con { name, categoryId, accountSize?, currentBalance?, ... }
    - [ ] name obligatorio (required)
    - [ ] categoryId obligatorio (NOT NULL FK)
    - [ ] Si categoryId no existe → error 404
    - [ ] Si categoryId pertenece a otro usuario → error (RLS join)
    - [ ] Campos opcionales: accountSize, currentBalance, operationState, phaseStatus, role, withdrawalsEnabled
    - [ ] created_at = now() (server side)
    - [ ] sort_index asignado
  - [ ] **Read**: GET `/api/accounts?trash=false|true`
    - [ ] ?trash=false → lista cuentas activas (deleted_at is null)
    - [ ] ?trash=true → lista cuentas eliminadas (deleted_at not null)
    - [ ] Solo del usuario logueado (RLS: auth.uid() = user_id)
    - [ ] Join con account_categories (incluye nombre categoría)
    - [ ] Ordenamiento por sort_index
  - [ ] **Update**: PATCH `/api/accounts/{id}` con { name, categoryId, accountSize, ... }
    - [ ] Actualiza updated_at automáticamente (trigger)
    - [ ] No permite null en category_id
    - [ ] Verifica propriedad (user_id match)
  - [ ] **Delete (Soft)**: DELETE `/api/accounts/{id}`
    - [ ] sets deleted_at = now()
    - [ ] NO borra de verdad
    - [ ] Desaparece de GET `/api/accounts?trash=false`
    - [ ] Aparece en GET `/api/accounts?trash=true`

- [ ] **Anti-duplicados: Accounts**
  - [ ] Usuario A crea account "Prop Account 1" en categoría "Propfirm Forex"
  - [ ] Usuario A intenta crear otro "Prop Account 1" en misma categoría → error UNIQUE CONSTRAINT
  - [ ] Usuario A intenta "prop account 1" (lower) → error (case-insensitive)
  - [ ] Usuario A crea "Prop Account 1" en categoría diferente "Forex Real" → OK (name_lower es único)
  - [ ] Usuario A borra cuenta original (soft-delete)
  - [ ] Usuario A puede crear "Prop Account 1" en "Propfirm Forex" nuevamente
  - [ ] Usuario B puede crear "Prop Account 1" (independiente)

- [ ] **Restore from Trash**
  - [ ] Crear account, luego DELETE → soft-delete (deleted_at = now())
  - [ ] GET `/api/accounts?trash=false` → no aparece
  - [ ] GET `/api/accounts?trash=true` → aparece
  - [ ] Click "RESTAURAR" button en trash
  - [ ] PATCH `/api/accounts/{id}` con { restore: true }
    - [ ] sets deleted_at = null
    - [ ] Aparece nuevamente en GET `/api/accounts?trash=false`
    - [ ] Desaparece de GET `/api/accounts?trash=true`

- [ ] **Empty Trash (Hard-Delete)**
  - [ ] Crear 2-3 accounts, eliminar todos (soft-delete)
  - [ ] GET `/api/accounts?trash=true` → muestra 2-3 accounts eliminadas
  - [ ] Click "VACIAR PAPELERA" button
  - [ ] Strong confirmation modal: "¿Estás seguro? Se eliminarán PERMANENTEMENTE..."
  - [ ] Confirm → POST `/api/accounts/trash/empty`
    - [ ] Hard-delete: DELETE FROM accounts WHERE user_id = $1 AND deleted_at IS NOT NULL
    - [ ] GET `/api/accounts?trash=true` → ahora vacío
    - [ ] Verificar en DB Supabase: registros borrados completamente
  - [ ] Cancel en modal → no pasa nada, trash mantiene items

- [ ] **RLS Enforcement** (2 usuarios)
  - [ ] **Setup**: 2 cuentas test (user_a@test.com, user_b@test.com)
  - [ ] User A: crea categoría "Propfirm Forex" + account "Private Account"
  - [ ] **A cannot see B's data**:
    - [ ] GET `/api/account-categories` (User B token) → no ve "Propfirm Forex"
    - [ ] GET `/api/accounts?trash=false` (User B token) → no ve "Private Account"
    - [ ] PATCH `/api/accounts/{user_a_account_id}` (User B token) → error RLS
    - [ ] DELETE `/api/accounts/{user_a_account_id}` (User B token) → error RLS
  - [ ] **B cannot hijack A's categories**:
    - [ ] POST `/api/accounts` (User B) con categoryId de User A → error RLS (join falla)

- [ ] **TradeHub Page Navigation**
  - [ ] Estar en `/dashboard` (protegido)
  - [ ] Click en "TradeHub" o navegar a `/dashboard/tradehub`
  - [ ] Página carga sin errores
  - [ ] Ve sección "📋 Cuentas" con AccountsPanel
  - [ ] Ve header "TradeHub" + grid layout

- [ ] **UI Integration**
  - [ ] **AccountsPanel**: lista cuentas en cards o table
    - [ ] botón "+ Nueva Cuenta"
    - [ ] Botón "EDITAR" en cada cuenta → abre AccountDialog
    - [ ] Botón "BORRAR" en cada cuenta → confirma soft-delete
    - [ ] Checkbox "Ver papelera" → toggle between active/trash
    - [ ] Si en papelera: botón "RESTAURAR" + "VACIAR PAPELERA"
  - [ ] **AccountDialog Modal**: create/edit form
    - [ ] name (required text input)
    - [ ] categoryId (required dropdown)
    - [ ] accountSize, currentBalance, etc. (optional fields)
    - [ ] Si no hay categorías: "Crear categorías sugeridas" button
    - [ ] Click seed → crea 5 defaults, dropdown actualiza
    - [ ] Submit → POST (create) o PATCH (update)
    - [ ] Validación: no permite submit si name o categoryId vacíos
  - [ ] **AccountCategorySelect**: dropdown component
    - [ ] Muestra lista de categorías ordenada
    - [ ] Si vacía: "Crear categorías sugeridas" button (optional)
    - [ ] onChange actualiza parent state

- [ ] **Edge Cases**
  - [ ] Crear account con categoryId null → error 400
  - [ ] Crear account con categoryId inexistente → error 404
  - [ ] Crear account con name = "" (vacío) → error 400
  - [ ] UPDATE account: cambiar categoryId a inexistente → error 404
  - [ ] DELETE categoría con accounts asociadas → error FOREIGN KEY (ON DELETE CASCADE)
    - [ ] Alternativamente: si ON DELETE CASCADE, todas las accounts se soft-delete
  - [ ] Restaurar account pero categoría fue eliminada → error (FK constraint)
  - [ ] 2 usuarios simultáneamente crear account con mismo nombre → ambos OK (different user_id)

### Sprint 4.2: Terminal (News, Calendar, Evidence) (Nuevo)
- [ ] **Migration 004 Applied**
  - [ ] Console: `await supabase.from('instruments').select()` → 2 rows (US500, XAUUSD)
  - [ ] `await supabase.from('terminal_news').select()` → [] (no data yet)
  - [ ] `await supabase.from('terminal_events').select()` → [] (no data yet)
  - [ ] `await supabase.from('terminal_evidence_reports').select()` → [] (no data yet)
  - [ ] Triggers y índices creados sin errores

- [ ] **Instruments (Global, Read-Only)**
  - [ ] GET `/api/terminal/instruments`
    - [ ] Retorna 2 instrumentos: US500, XAUUSD
    - [ ] Ordenados por sort_index (US500 primero)
    - [ ] No requiere auth (global read-only)
  - [ ] Verificar RLS: select authenticated, no insert/update/delete policies
  - [ ] User cannot create/modify/delete instruments

- [ ] **News CRUD** (instrument_id obligatorio)
  - [ ] **Create**: POST `/api/terminal/news`
    - [ ] Requiere: instrumentId, title
    - [ ] Opcionales: url, source, relevancy_score (0-100), impact_label (High/Medium/Low)
    - [ ] Si instrumentId no existe → error 404
    - [ ] timestamp_utc generado automáticamente = now()
  - [ ] **Read**: GET `/api/terminal/news?instrumentId={id}`
    - [ ] Solo noticias del usuario (RLS: deleted_at is null)
    - [ ] Ordenado por timestamp_utc desc
  - [ ] **Update**: PATCH `/api/terminal/news/{id}`
    - [ ] Actualiza campos (title, url, source, relevancy_score, impact_label)
  - [ ] **Delete (Soft)**: DELETE `/api/terminal/news/{id}`
    - [ ] Sets deleted_at = now()

- [ ] **Calendar Events CRUD** (instrument_id obligatorio)
  - [ ] **Create**: POST `/api/terminal/events`
    - [ ] Requiere: instrumentId, name, timestamp_utc
    - [ ] Opcionales: impact (High/Medium/Low)
    - [ ] Si instrumentId no existe → error 404
  - [ ] **Read**: GET `/api/terminal/events?instrumentId={id}`
    - [ ] Solo eventos del usuario (RLS: deleted_at is null)
    - [ ] Ordenado por timestamp_utc asc (próximos primero)
  - [ ] **Update**: PATCH `/api/terminal/events/{id}`
    - [ ] Actualiza campos (name, impact, timestamp_utc)
  - [ ] **Delete (Soft)**: DELETE `/api/terminal/events/{id}`
    - [ ] Sets deleted_at = now()

- [ ] **Evidence Reports CRUD** (instrument_id OPCIONAL)
  - [ ] **Create**: POST `/api/terminal/evidence`
    - [ ] Requiere: title, content
    - [ ] Opcionales: instrument_id (null allowed)
    - [ ] created_at = now() (server side)
  - [ ] **Read**: GET `/api/terminal/evidence`
    - [ ] Solo reportes del usuario (RLS: deleted_at is null)
    - [ ] Ordenado por created_at desc
  - [ ] **Update**: PATCH `/api/terminal/evidence/{id}`
    - [ ] Actualiza campos (title, content, instrument_id)
  - [ ] **Delete (Soft)**: DELETE `/api/terminal/evidence/{id}`
    - [ ] Sets deleted_at = now() (cascada: adjuntos también soft-delete)

- [ ] **Evidence Generate (IA Stub)**
  - [ ] POST `/api/terminal/evidence/generate`
    - [ ] Body: { instrumentId?: string, title: string }
    - [ ] Requiere sesión, sin auth → 401
    - [ ] Genera content en español (stub placeholder)
    - [ ] Inserta reporte en DB
    - [ ] Responde: { ok: true, reportId, title, content }
  - [ ] Contenido es stub simulado (no IA real)
  - [ ] Usuario puede editar contenido después

- [ ] **Evidence Attachments** (multi-upload, 100MB max, bloquear exe/bat)
  - [ ] **Upload**: POST `/api/terminal/evidence/{reportId}/attachments`
    - [ ] FormData con file
    - [ ] Path storage: `${userId}/terminal/evidence/${reportId}/${uuid}_${filename}`
    - [ ] Valida: size ≤ 100MB
    - [ ] Bloquea: .exe, .bat extensiones
    - [ ] Retorna: { id, filename, mime_type, size_bytes, ...}
  - [ ] **Read**: GET `/api/terminal/evidence/{reportId}/attachments`
    - [ ] Lista adjuntos del reporte (RLS: solo si user_id = auth.uid())
    - [ ] Ordenado por created_at asc
  - [ ] **Delete (Soft)**: DELETE `/api/terminal/evidence/{reportId}/attachments/{attachmentId}`
    - [ ] Sets deleted_at = now() en metadata
    - [ ] Best-effort: intenta borrar archivo de storage
  - [ ] **Signed URL**: GET `/api/terminal/evidence/{reportId}/attachments/{attachmentId}/signed-url`
    - [ ] Retorna signedUrl válida por 60 segundos
    - [ ] URL permite descargar archivo sin auth adicional

- [ ] **Terminal Page Navigation**
  - [ ] Navegar a `/dashboard/terminal`
  - [ ] Página carga sin errores
  - [ ] Tab navigation visible: 📰 Noticias, 📅 Calendario, 📊 Evidencia, 🔍 Búsqueda

- [ ] **NewsPanel UI**
  - [ ] Dropdown de instrumentos (obligatorio)
  - [ ] Botón "+ Nueva Noticia"
  - [ ] Form: title, url, source, relevancy_score, impact_label
  - [ ] Lista de noticias con: título, fuente, fecha, botones editar/borrar
  - [ ] Click editar abre form prefilled
  - [ ] Click borrar: soft-delete con confirmación

- [ ] **CalendarPanel UI**
  - [ ] Dropdown de instrumentos (obligatorio)
  - [ ] Botón "+ Nuevo Evento"
  - [ ] Form: name, impact, timestamp_utc (date-time picker)
  - [ ] Lista ordenada por fecha (próximos primero)
  - [ ] Cada evento muestra: nombre, fecha, impacto, botones editar/borrar
  - [ ] Click editar abre form prefilled
  - [ ] Click borrar: soft-delete con confirmación

- [ ] **EvidenceReports UI**
  - [ ] 2-column layout: lista + detalle
  - [ ] Botón "+ Nuevo Reporte"
  - [ ] Form: title, instrument (opcional), botón "🤖 Generar con IA (stub)"
  - [ ] Click generar → POST /api/terminal/evidence/generate
    - [ ] Content se autocompleta en textarea
    - [ ] Usuario puede editar antes de guardar
  - [ ] Botón "Guardar" → POST (create) o PATCH (update)
  - [ ] Lista de reportes con: título, fecha, click → selecciona para detalle
  - [ ] Detalle muestra: título, contenido, fecha, botones editar/borrar
  - [ ] Sección "📎 Adjuntos" visible cuando reporte seleccionado

- [ ] **EvidenceAttachments UI** (dentro de EvidenceReports)
  - [ ] Drag-and-drop zone: "Arrastra archivos aquí"
  - [ ] Click zona para seleccionar múltiples archivos
  - [ ] Validación en frontend: tamaño, extensión
  - [ ] Lista de adjuntos: nombre, tamaño, mime, botón borrar
  - [ ] Preview de imágenes: muestra thumbnail si image/* mime
  - [ ] Botón borrar: soft-delete con confirmación

- [ ] **RLS Enforcement** (2 usuarios)
  - [ ] **Setup**: user_a@test.com, user_b@test.com
  - [ ] User A: crea noticia, evento, reporte
  - [ ] User B: login en browser incognito
    - [ ] GET `/api/terminal/news?instrumentId={id}` (User B token) → no ve noticias de User A
    - [ ] GET `/api/terminal/events?instrumentId={id}` (User B token) → no ve eventos de User A
    - [ ] GET `/api/terminal/evidence` (User B token) → no ve reportes de User A
    - [ ] PATCH `/api/terminal/news/{user_a_id}` (User B token) → error RLS
    - [ ] DELETE `/api/terminal/evidence/{user_a_id}` (User B token) → error RLS

- [ ] **Edge Cases**
  - [ ] Crear noticia con instrumentId null → error 400
  - [ ] Crear noticia con instrumentId inexistente → error 404
  - [ ] Crear evento con timestamp_utc inválido → error parsing
  - [ ] Upload archivo > 100MB → error tamaño
  - [ ] Upload archivo .exe → error extensión bloqueada
  - [ ] Upload archivo .bat → error extensión bloqueada
  - [ ] Borrar reporte → cascade soft-delete de adjuntos
  - [ ] Signed URL con 61s pasado → URL expirada/inválida
  - [ ] Image preview con archivo no-image → imagen no carga (graceful)

### Sprint 4.3: TradeHub New Trades Log (Nuevo)
- [ ] **Migration 005 Applied**
  - [ ] Console: `await supabase.from('setups').select()` → [] (no data yet)
  - [ ] Console: `await supabase.from('trades').select()` → [] (no data yet)
  - [ ] Triggers y índices creados sin errores
  - [ ] RLS policies activas en ambas tablas

- [ ] **Setups CRUD** (Estrategias)
  - [ ] **Create**: POST `/api/tradehub/setups`
    - [ ] Requiere: name
    - [ ] Opcionales: description
    - [ ] Anti-duplicados: 2 setups con mismo name → error 409
    - [ ] Case-insensitive: "My Setup" y "my setup" → error 409
  - [ ] **Read**: GET `/api/tradehub/setups`
    - [ ] Solo setups del usuario (RLS)
    - [ ] Retorna array ordenado por sort_index
  - [ ] **Update** (future implementation - not in scope)
  - [ ] **Delete** (future implementation - not in scope)

- [ ] **Trades CRUD** (Operaciones)
  - [ ] **Create**: POST `/api/tradehub/trades`
    - [ ] Requiere: account_id, symbol, direction, status, entry_date
    - [ ] Opcionales: exit_date, entry_price, exit_price, quantity, fees, pnl, notes, setup_id, is_featured_in_report
    - [ ] Si account_id no existe → error 404
    - [ ] Si setup_id no existe → error 404
    - [ ] direction/status: texto libre (no validación de valores específicos)
  - [ ] **Read**: GET `/api/tradehub/trades?accountId={id}&trash=true|false`
    - [ ] Solo trades del usuario (RLS)
    - [ ] Filtrado por account_id si parámetro provided
    - [ ] Filtrado por deleted_at si trash=true
    - [ ] Retorna array ordenado por created_at desc
  - [ ] **Update**: PATCH `/api/tradehub/trades/{id}`
    - [ ] Actualiza campos (symbol, direction, status, prices, quantity, etc.)
    - [ ] Restore: PATCH con body `{ restore: true }` → sets deleted_at = null
  - [ ] **Delete (Soft)**: DELETE `/api/tradehub/trades/{id}`
    - [ ] Sets deleted_at = now()

- [ ] **Screenshot Upload**
  - [ ] **Upload**: POST `/api/tradehub/trades/{id}/screenshot`
    - [ ] FormData con file
    - [ ] Path storage: `${userId}/tradehub/trades/${tradeId}/${uuid}_${filename}`
    - [ ] Valida: size ≤ 100MB
    - [ ] Bloquea: .exe, .bat extensiones
    - [ ] Retorna: { ok: true, path, signedUrl }
    - [ ] Si trade no existe → error 404
    - [ ] Si archivo > 100MB → error tamaño
  - [ ] **Download**: GET `/api/tradehub/trades/{id}/screenshot`
    - [ ] Retorna signedUrl válida por 60 segundos
    - [ ] Si trade no existe → error 404
    - [ ] Signed URL expira después de 60s

- [ ] **TradeHub Page Navigation**
  - [ ] Navegar a `/dashboard/tradehub`
  - [ ] Página carga sin errores
  - [ ] Tab navigation visible: 📋 Cuentas, 📊 New Trades Log
  - [ ] Click tab → renders correct component (AccountsPanel or NewTradesLog)

- [ ] **NewTradesLog UI**
  - [ ] Selector cuenta (obligatorio)
  - [ ] Botón "+ Nueva Operación"
  - [ ] Form: symbol, direction, status, entry_date, exit_date, prices, qty, fees, pnl, notes, setup dropdown, featured checkbox
  - [ ] Direction/status datalists muestran sugerencias (Long/Short/Buy/Sell, Open/Closed)
  - [ ] Screenshot upload: file input aceptando cualquier tipo de archivo (validado server-side)
  - [ ] Screenshot preview si MIME type es image/*
  - [ ] Lista de trades con: símbolo, dirección, estado, fecha, P&L, botones editar/borrar
  - [ ] Click editar abre form prefilled con datos existentes
  - [ ] Click borrar: soft-delete con confirmación

- [ ] **Papelera (Trash)**
  - [ ] Checkbox "Ver papelera" → filtra trades borrados (deleted_at NOT NULL)
  - [ ] Header cambia a "🗑️ Papelera"
  - [ ] Botón "RESTAURAR" en lugar de editar/borrar
  - [ ] Click restaurar → PATCH con { restore: true }
  - [ ] Trade reaparece en vista activa

- [ ] **RLS Enforcement** (2 usuarios)
  - [ ] **Setup**: user_a@test.com, user_b@test.com
  - [ ] User A: crea 2 setups, 3 trades (en cuenta 1 y 2)
  - [ ] User B: login en browser incognito
    - [ ] GET `/api/tradehub/setups` (User B token) → no ve setups de User A
    - [ ] GET `/api/tradehub/trades?accountId={a_account_id}` (User B token) → no ve trades de User A
    - [ ] PATCH `/api/tradehub/trades/{user_a_trade_id}` (User B token) → error RLS (404)
    - [ ] DELETE `/api/tradehub/trades/{user_a_trade_id}` (User B token) → error RLS (404)

- [ ] **Edge Cases**
  - [ ] Crear trade sin account_id → error 400
  - [ ] Crear trade con account_id inexistente → error 404
  - [ ] Crear trade con setup_id inexistente → error 404
  - [ ] Upload screenshot > 100MB → error tamaño
  - [ ] Upload archivo .exe → error extensión bloqueada
  - [ ] Upload archivo .bat → error extensión bloqueada
  - [ ] Soft-delete trade y acceder a screenshot → debería fallar o retornar 404
  - [ ] Signed URL con 61s pasado → URL expirada/inválida
  - [ ] Screenshot preview con archivo no-image → imagen no carga (graceful)
  - [ ] Create trade con direction vacío → error 400
  - [ ] Create trade con entry_date vacío → error 400

### Sprint 4.4: TradeHub Evidence Vault + Playbook (Nuevo)
- [ ] **Migration 006 Applied**
  - [ ] Console: `await supabase.from('tv_analysis_evidence').select()` → []
  - [ ] Triggers y índices creados sin errores
  - [ ] RLS policies activas en tabla tv_analysis_evidence
  - [ ] CHECK constraint en validation_status (needs_review, valid, invalid)

- [ ] **Evidence Vault CRUD** (Almacén de evidencia)
  - [ ] **Upload**: POST `/api/tradehub/evidence`
    - [ ] FormData: file, notes (opcional), account_id (opcional), trade_id (opcional), captured_at (requerido)
    - [ ] Requiere: file + captured_at
    - [ ] Path storage: `${userId}/tradehub/evidence/${uuid}_${filename}`
    - [ ] Valida: size ≤ 100MB
    - [ ] Bloquea: .exe, .bat extensiones
    - [ ] Crea registro con validation_status = 'needs_review'
    - [ ] Si account_id o trade_id no existen → error 404
    - [ ] Si no son del usuario → error 403
  - [ ] **Read**: GET `/api/tradehub/evidence`
    - [ ] Solo evidencia del usuario (RLS)
    - [ ] Joins account.name y trade.symbol/direction
    - [ ] Ordenado por captured_at DESC
    - [ ] Excluye deleted_at NOT NULL
  - [ ] **Update Status**: PATCH `/api/tradehub/evidence/{id}`
    - [ ] Body: { validation_status: "needs_review"|"valid"|"invalid" }
    - [ ] Actualiza validation_status
    - [ ] Si status inválido → error 400
    - [ ] Si evidencia no existe → error 404
  - [ ] **Delete (Soft)**: DELETE `/api/tradehub/evidence/{id}`
    - [ ] Sets deleted_at = now()
    - [ ] Si evidencia no existe → error 404
  - [ ] **Signed URL**: GET `/api/tradehub/evidence/{id}/signed-url`
    - [ ] Retorna signed URL válida por 60 segundos
    - [ ] Si evidencia no existe → error 404
    - [ ] Signed URL expira después de 60s

- [ ] **EvidenceVault UI**
  - [ ] Navegar a `/dashboard/tradehub` → tab "📁 Evidence Vault"
  - [ ] Botón "+ Subir Evidencia" abre dialog
  - [ ] Upload Dialog:
    - [ ] File picker (drag-drop o click)
    - [ ] Date input (captured_at, requerido)
    - [ ] Notes textarea (opcional)
    - [ ] Account selector (opcional, dropdown con cuentas activas)
    - [ ] Trade selector (opcional, dropdown con trades del usuario)
    - [ ] Cancel y Upload buttons
  - [ ] File Validation (Client-side):
    - [ ] Size check: > 100MB → error message
    - [ ] Extension check: .exe, .bat → error message
    - [ ] Feedback visual (spinner) mientras uploading
  - [ ] Lista Sidebar:
    - [ ] Scrollable lista de evidencia ordenada por captured_at DESC
    - [ ] Cards con: thumbnail, captured_at, status indicator (🔍 needs_review, ✅ valid, ❌ invalid)
    - [ ] Labels: account name (si existe), trade symbol (si existe)
    - [ ] Click card → select y mostrar en detail view
  - [ ] Detail View:
    - [ ] Image preview grande (via signed URL)
    - [ ] Metadata: captured_at, account name (si existe), trade (símbolo+dirección si existe), notes
    - [ ] Status dropdown: cambiar validation_status
    - [ ] Delete button: soft-delete con confirmación
  - [ ] Responsive:
    - [ ] Mobile: 1 column (lista expandible)
    - [ ] Desktop: 3 columns (lista sidebar + detail main)

- [ ] **Playbook Tab** (Análisis de setups)
  - [ ] Navegar a `/dashboard/tradehub` → tab "📖 Playbook"
  - [ ] Listado de setups visible
  - [ ] Cada setup: card colapsible con resumen en header
  - [ ] Header muestra: nombre setup, total trades, closed trades, win rate %, total P&L, avg P&L
  - [ ] Click expand → detalle expandido:
    - [ ] Grid de stats: total trades, closed trades, open trades, win rate %
    - [ ] Tabla recent trades (últimos 10): symbol, direction, status, entry_date, exit_date, pnl
    - [ ] Color P&L: positivo=verde, negativo=rojo, null=blanco
  - [ ] Empty state: "No setups created" si user no tiene setups

- [ ] **Playbook Stats Calculation**
  - [ ] **Setup Stats**:
    - [ ] totalTrades: count(all trades with setup_id)
    - [ ] closedTrades: count(trades where exit_date IS NOT NULL)
    - [ ] openTrades: totalTrades - closedTrades
    - [ ] winRate: (count(pnl > 0) / closedTrades) * 100 % (null si closedTrades = 0)
    - [ ] totalPnL: sum(pnl for closed trades) (null si closedTrades = 0)
    - [ ] avgPnL: totalPnL / closedTrades (null si closedTrades = 0)
    - [ ] recentTrades: last 10 trades (order by created_at DESC)
  - [ ] **Verificar correctitud**:
    - [ ] User A setup "Scalping" con 3 trades:
      - Trade 1: pnl = 100 (closed, exit_date = 2026-01-17)
      - Trade 2: pnl = -50 (closed, exit_date = 2026-01-16)
      - Trade 3: pnl = null (open, exit_date = null)
    - [ ] Esperado: totalTrades = 3, closedTrades = 2, openTrades = 1, winRate = 50%, totalPnL = 50, avgPnL = 25

- [ ] **TradeHub Page Navigation (4 tabs)**
  - [ ] Navegar a `/dashboard/tradehub`
  - [ ] 4 tabs visible: 📋 Cuentas, 📊 New Trades Log, 📁 Evidence Vault, 📖 Playbook
  - [ ] Click cada tab → renders correct component
  - [ ] Tab state persiste en URL o local state

- [ ] **RLS Enforcement** (Evidence + Playbook - 2 usuarios)
  - [ ] **Setup**:
    - [ ] User A: 2 setups (Scalping, Swing)
    - [ ] User A: 3 trades en Scalping, 2 en Swing
    - [ ] User A: 5 evidencia uploads
    - [ ] User B: login en browser incognito
  - [ ] **Evidence RLS**:
    - [ ] GET `/api/tradehub/evidence` (User B) → no ve evidencia de User A
    - [ ] PATCH `/api/tradehub/evidence/{user_a_evidence_id}` (User B) → error 404
    - [ ] DELETE `/api/tradehub/evidence/{user_a_evidence_id}` (User B) → error 404
    - [ ] GET `/api/tradehub/evidence/{user_a_evidence_id}/signed-url` (User B) → error 404
  - [ ] **Playbook RLS** (implícito via stats data):
    - [ ] User B: GET `/api/tradehub/setups` (User B) → solo sus setups
    - [ ] User B: GET `/api/tradehub/trades` (User B) → solo sus trades
    - [ ] Cálculo de stats usa data RLS-filtered automáticamente

- [ ] **Evidence Links Validation**
  - [ ] Crear evidencia con account_id: user_a_account_1
    - [ ] Éxito: crea vinculación, account visible en detail view
  - [ ] Crear evidencia con account_id: inexistente → error 404
  - [ ] Crear evidencia con account_id: user_b_account_1 (User A intenta) → error 403
  - [ ] Crear evidencia con trade_id: user_a_trade_1
    - [ ] Éxito: crea vinculación, trade visible en detail view
  - [ ] Crear evidencia con trade_id: inexistente → error 404
  - [ ] Crear evidencia con trade_id: user_b_trade_1 (User A intenta) → error 403

- [ ] **Edge Cases**
  - [ ] Upload evidence > 100MB → error tamaño
  - [ ] Upload archivo .exe → error extensión bloqueada
  - [ ] Upload archivo .bat → error extensión bloqueada
  - [ ] Update evidence status a valor inválido (ej: "pending") → error 400
  - [ ] Soft-delete evidence y acceder via signed URL → debería 404
  - [ ] Playbook con setup sin trades cerrados → avgPnL = null, winRate = null
  - [ ] Playbook con setup vacío (sin trades) → stats mostrar 0 o null apropiadamente
  - [ ] Evidence upload sin captured_at → error 400
  - [ ] Evidence upload sin file → error 400

### Sprint 4.5: TradeHub Reports (Nuevo)
- [ ] **Migration 007 Applied**
  - [ ] Console: `await supabase.from('weekly_reports').select()` → []
  - [ ] Triggers y índices creados sin errores
  - [ ] RLS policies activas en tabla weekly_reports
  - [ ] Unique parcial en (user_id, week_start, week_end) donde deleted_at IS NULL

- [ ] **Report Generation** (AlphaBrief)
  - [ ] **POST /api/tradehub/reports/generate**
    - [ ] Sin autenticación → 401 error
    - [ ] Calcula semana: today-7 a today (UTC)
    - [ ] Fetcha trades cerrados (exit_date NOT NULL) en rango
    - [ ] Calcula: totalTrades, totalPnL, winRate, account breakdown
    - [ ] Genera markdown ES con sections: Executive Summary, Performance, Account Breakdown, Insights, Action Items
    - [ ] Si no existe reporte: insert + retorna { existing: false, report: {...} }
    - [ ] Si ya existe: retorna { existing: true, report: {...} } (no duplica)
  - [ ] **Unique Constraint** (evita duplicados)
    - [ ] User A: genera reporte para esta semana → éxito
    - [ ] User A: intenta generar otra vez → retorna existing=true
    - [ ] User B: puede generar reporte para misma semana (su propio user_id)

- [ ] **Reports List & Detail**
  - [ ] **GET /api/tradehub/reports**
    - [ ] Solo reportes del usuario (RLS)
    - [ ] Retorna array ordenado por created_at DESC
    - [ ] Excluye deleted_at NOT NULL
  - [ ] **List UI**
    - [ ] Navegar a `/dashboard/tradehub` → tab "📊 Reports"
    - [ ] Botón "🤖 Generar AlphaBrief" visible
    - [ ] Lista muestra reportes más recientes primero
    - [ ] Card header muestra: semana, operaciones, win rate, P&L, fecha generado
    - [ ] P&L color-coded: positivo=verde, negativo=rojo
  - [ ] **Detail View**
    - [ ] Click card → expande y muestra content_md
    - [ ] Content muestra markdown formateado (tablas, headers, listas)
    - [ ] Botón "Eliminar" visible
    - [ ] Click botón Eliminar → confirmación
    - [ ] Click Confirmar → soft-delete (deleted_at = now())
    - [ ] Report desaparece de lista

- [ ] **Markdown Content Quality**
  - [ ] Header: "AlphaBrief - Semana YYYY-MM-DD a YYYY-MM-DD"
  - [ ] Section: "Resumen Ejecutivo" (período, operaciones, resultado, win rate)
  - [ ] Section: "Performance General" (tabla con totales)
  - [ ] Section: "Desglose por Cuenta" (una subsección por cuenta)
  - [ ] Section: "Insights Clave" (mejor/peor operación, análisis)
  - [ ] Section: "Puntos de Acción" (5 items)
  - [ ] Footer: timestamp UTC de generación

- [ ] **Metrics Calculation Accuracy**
  - [ ] **Setup**: User A con 5 trades en semana
    - [ ] Trade 1: pnl=100, exit_date=2026-01-10 ✓
    - [ ] Trade 2: pnl=-50, exit_date=2026-01-12 ✓
    - [ ] Trade 3: pnl=150, exit_date=2026-01-14 ✓
    - [ ] Trade 4: pnl=-30, exit_date=2026-01-16 ✓
    - [ ] Trade 5: pnl=null, exit_date=null (open) ✗
  - [ ] **Expected Metrics**:
    - [ ] totalTrades = 4 (solo cerrados)
    - [ ] totalPnL = 170 (100-50+150-30)
    - [ ] winRate = 50% (2 wins / 4 trades)
    - [ ] Best Trade = 150 (Trade 3)
    - [ ] Worst Trade = -50 (Trade 2)
    - [ ] Avg Trade = 42.50 (170 / 4)
  - [ ] **Verify** en markdown content matches expected values

- [ ] **Account Breakdown Calculation**
  - [ ] User A: 2 cuentas, 4 trades cerrados (week range)
    - [ ] Account 1: 2 trades (pnl=100, pnl=-50) → pnl=50, winRate=50%
    - [ ] Account 2: 2 trades (pnl=150, pnl=-30) → pnl=120, winRate=50%
  - [ ] Verify markdown "Desglose por Cuenta" shows:
    - [ ] Account 1: 2 operaciones, $50 P&L, 50%
    - [ ] Account 2: 2 operaciones, $120 P&L, 50%

- [ ] **TradeHub Page Navigation (5 tabs)**
  - [ ] Navegar a `/dashboard/tradehub`
  - [ ] 5 tabs visible: 📋 Cuentas, 📊 New Trades Log, 📁 Evidence Vault, 📖 Playbook, 📊 Reports
  - [ ] Click cada tab → renders correct component
  - [ ] Reports tab muestra generador + lista + detalle

- [ ] **RLS Enforcement** (Reports - 2 usuarios)
  - [ ] **Setup**:
    - [ ] User A: genera 2 reportes
    - [ ] User B: login en browser incognito
  - [ ] **RLS Checks**:
    - [ ] GET `/api/tradehub/reports` (User B) → no ve reportes de User A (retorna [])
    - [ ] DELETE `/api/tradehub/reports/{user_a_report_id}` (User B) → error 404
  - [ ] **Implicit RLS** (via POST):
    - [ ] POST `/api/tradehub/reports/generate` (User B) → genera report con user_b data
    - [ ] Report de User B solo contiene trades/accounts de User B

- [ ] **Edge Cases**
  - [ ] No trades en semana → totalTrades=0, metrics null, error handling?
  - [ ] Solo open trades (sin exit_date) → totalTrades=0, no data en reporte
  - [ ] Trades en múltiples cuentas → desglose correcto por cuenta
  - [ ] P&L mixto (positivo+negativo) → color-coding correcto en UI
  - [ ] Generar reporte a las 23:59 UTC → semana = hoy-7 a hoy (inclusive)
  - [ ] Delete reporte + acceder via GET → no aparece (deleted_at respetado)
  - [ ] Markdown con caracteres especiales (©, €, etc.) → renderizado correcto

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
