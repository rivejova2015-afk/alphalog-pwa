# SPRINT 6A - Deployment Guide

**Objective**: Deploy offline dashboard + Web Push notifications to production

**Time Estimate**: 15-20 minutes  
**Risk Level**: Low (changes isolated, no breaking changes)

---

## Pre-Deployment Checklist

### 1. Verify Build Status ✓

```bash
cd /path/to/alphalog-pwa
npm run build
```

**Expected Output**:
```
✓ Compiled successfully in 3.0s
✓ 48 routes compiled
✓ TypeScript: 0 errors
✓ Next.js build complete
```

If errors appear, **STOP** and fix before continuing.

### 2. Generate VAPID Keys (One-time)

Only do this once per environment. If you already have VAPID keys, skip to step 3.

```bash
npx web-push generate-vapid-keys
```

**Output**:
```
Public Key: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Private Key: yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy
```

### 3. Configure Environment Variables

Update `.env.local` (or equivalent in your hosting provider):

```bash
# Web Push Configuration
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public-key-from-step-2>
VAPID_PRIVATE_KEY=<private-key-from-step-2>
VAPID_SUBJECT=mailto:your-support-email@example.com

# PWA Configuration
NEXT_PUBLIC_ENABLE_SW=true  # In production, can be omitted (defaults to true)
```

**Security**: 
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` can be public (client-visible)
- `VAPID_PRIVATE_KEY` **MUST** be secret (server-only, never commit)
- `VAPID_SUBJECT` should be your domain email

### 4. Apply Database Migration

#### Option A: Supabase Dashboard (Recommended)

1. Open [Supabase Dashboard](https://supabase.com)
2. Select your project
3. Go to **SQL Editor**
4. Create new query
5. Paste contents of `supabase/migrations/009_push_subscriptions.sql`
6. Click **Run**

**Expected**: "Success. No rows returned." message

#### Option B: Supabase CLI

```bash
supabase migration up
```

#### Option C: Direct in Database

If using raw PostgreSQL:
```bash
psql -h <your-host> -U postgres -d postgres
\c <your-db-name>
\i supabase/migrations/009_push_subscriptions.sql
```

**Verify Migration**:
```sql
-- Connect to Supabase database
SELECT table_name FROM information_schema.tables 
WHERE table_schema='public' AND table_name='push_subscriptions';
-- Expected: 1 row with "push_subscriptions"
```

### 5. Test Locally (Optional but Recommended)

```bash
# Terminal 1: Run dev server with SW enabled
NEXT_PUBLIC_ENABLE_SW=true npm run dev

# Browser: Open http://localhost:3000/dashboard/tradehub

# Test 1: Offline Mode
# - Open DevTools (F12)
# - Network tab → Throttle dropdown → Select "Offline"
# - Refresh page
# - Expected: Page loads with cache data + OfflineBanner visible
# - Click "Ir a Dashboard" button → Works

# Test 2: Push Notifications
# - Click "🔔 Activar notificaciones" button
# - Browser requests permission → "Allow"
# - Button changes to "✉️ Enviar prueba"
# - Click "✉️ Enviar prueba"
# - Expected: Desktop notification appears (Windows/Mac)
# - Click notification → Nothing (no action yet, planned for future)

# Test 3: Trigger - Report Generation
# - Go to Reports tab
# - Generate or select a report
# - Expected: Push notification "📊 AlphaBrief Generado"

# Test 4: Service Worker Status
# - DevTools → Application tab
# - Service Workers section
# - Expected: 1 SW listed, Status: "activated and running"
# - Cache Storage: "alphalog-v6a-1" cache exists
```

---

## Deployment Steps

### 1. Commit and Push

```bash
# All SPRINT 6A changes should be committed:
git log --oneline -3
# Expected output:
# b8a93f0 feat(push): Triggers for notifications on report + goal + quarter completion
# 6d8889b feat(push): Web Push infrastructure + API endpoints + UI buttons
# 3cc1ec5 feat(pwa): offline read-only dashboard + IDB snapshot + banner

# If not committed, run:
git add -A
git commit -m "feat(pwa+push): Sprint 6A - Offline dashboard + Web Push"

# Push to main/production branch
git push origin <branch-name>
```

### 2. Deploy to Hosting

#### Vercel (Recommended)

1. Push changes to GitHub
2. Vercel auto-detects and deploys
3. Build completes automatically (same as `npm run build`)
4. No additional configuration needed (VAPID vars auto-injected from environment)

#### Self-Hosted / Other Platforms

1. SSH into server
2. Pull latest code: `git pull origin <branch>`
3. Install deps: `npm install` (or `npm ci` for exact versions)
4. Build: `npm run build`
5. Restart app: `pm2 restart alphalog` or equivalent
6. Verify: `curl https://your-domain.com/api/health`

### 3. Verify Deployment

```bash
# Check Service Worker is served
curl -I https://your-domain.com/sw.js
# Expected: HTTP 200, Content-Type: application/javascript

# Check offline fallback page exists
curl https://your-domain.com/offline
# Expected: HTTP 200, contains "Estás offline"

# Check database migration applied
# (In Supabase dashboard SQL Editor)
SELECT COUNT(*) FROM push_subscriptions;
# Expected: 0 (no subscriptions yet, that's fine)

# Check health endpoint
curl https://your-domain.com/api/health
# Expected: HTTP 200, JSON response (if endpoint exists)
```

### 4. Monitor First 24 Hours

- [ ] Check error logs (Vercel, Supabase, or your platform)
- [ ] Monitor push notification failures: `SELECT * FROM push_subscriptions WHERE created_at > NOW() - INTERVAL '24 hours';`
- [ ] User feedback: Any issues with offline mode or push?
- [ ] Browser console: Any ServiceWorker errors?

---

## Post-Deployment Verification

### A. User Testing (Manual)

**Test on Chrome/Edge/Firefox** (Safari has limited support):

1. **Subscribe to Push**:
   - Go to /dashboard/tradehub
   - Click "🔔 Activar notificaciones"
   - Allow browser permission
   - Verify "✉️ Enviar prueba" button appears

2. **Send Test Notification**:
   - Click "✉️ Enviar prueba"
   - Expect desktop notification within 2 seconds
   - Title: "✅ Notificación de Prueba"

3. **Test Offline Access**:
   - DevTools → Network → Offline
   - Refresh /dashboard/*
   - Expect data loads from cache + banner visible

4. **Generate Report** (Trigger Test):
   - TradeHub → Reports → Generate or select
   - Expect "📊 AlphaBrief Generado" notification

### B. Database Verification

```sql
-- Run in Supabase SQL Editor
-- Check RLS policies are working
SELECT tablename FROM pg_tables WHERE tablename = 'push_subscriptions';
-- Expected: 1 row

-- Check indexes created
SELECT indexname FROM pg_indexes WHERE tablename = 'push_subscriptions';
-- Expected: 3+ indexes (id, user_id, updated_at)

-- Check recent subscriptions
SELECT id, user_id, created_at FROM push_subscriptions 
ORDER BY created_at DESC LIMIT 5;
-- Expected: New subscriptions appear as users opt-in
```

### C. Performance Baseline

| Metric | Target | Tool |
|--------|--------|------|
| Offline page load | < 500ms | Chrome DevTools |
| Push delivery | < 3 seconds | Manual timing |
| Service Worker register | < 1 second | Performance tab |
| Cache size | < 50MB | DevTools → Storage |

---

## Troubleshooting Deployment Issues

### Issue: "VAPID keys not configured"

**Symptom**: Push endpoint errors with "VAPID keys not configured"

**Solution**:
1. Verify `.env.local` has `VAPID_PRIVATE_KEY` on server
2. Restart app after updating env vars
3. Check hosting provider's environment variable settings (Vercel, etc.)
4. Don't commit `.env.local` - use platform's secret management

### Issue: Service Worker not installing

**Symptom**: DevTools shows no SW, offline mode doesn't work

**Solution**:
1. Clear browser cache: `Ctrl+Shift+Delete` (or DevTools → Storage → Clear site data)
2. Hard refresh: `Ctrl+Shift+R` (Cmd+Shift+R on Mac)
3. Check `NEXT_PUBLIC_ENABLE_SW` isn't set to `false` in production
4. Verify `public/sw.js` file exists: `curl https://your-domain.com/sw.js`

### Issue: Users can't enable push notifications

**Symptom**: Button click does nothing or shows "Permiso denegado"

**Solution**:
1. Check browser notification permission (usually blocked after being denied)
2. Guide users: Settings → Privacy → Notifications → Find your domain → Reset
3. Check CORS: Verify `/api/push/subscribe` returns 200 OK
4. Check VAPID public key: Ensure `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is set

### Issue: Offline page blank

**Symptom**: No data shown when offline

**Solution**:
1. User must visit dashboard while online first (to save snapshot)
2. Check IndexedDB: DevTools → Application → IndexedDB → alphalog → snapshots
3. Check browser's local storage quota (older browsers have limits)
4. Clear IndexedDB and try again: `indexedDB.deleteDatabase('alphalog')`

### Issue: Old cache interfering

**Symptom**: Changes not appearing, serving old content

**Solution**:
1. Service Worker auto-cleans old caches (`alphalog-v6a-1` replaces `v6a-0`)
2. Force users to clear: `Ctrl+Shift+Delete` → Storage → Clear all
3. Or update `CACHE_VERSION` in `public/sw.js` to force new cache name

---

## Rollback Procedure

**If something goes wrong**, rollback quickly:

### Option 1: Git Revert (Preferred)

```bash
# Revert SPRINT 6A commits (3 commits)
git revert b8a93f0 6d8889b 3cc1ec5

# Or if squashed into one commit
git revert <commit-hash>

# Push to trigger redeploy
git push origin <branch>

# Vercel auto-deploys from git
# Expected: Deployment ~1-2 minutes
```

### Option 2: Manual Revert

```bash
# Revert to last known-good commit
git reset --hard <commit-before-6A>

# Force push (only if no one else is working)
git push -f origin <branch>
```

### Option 3: Supabase Migration Rollback

If database migration is causing issues:

```sql
-- In Supabase SQL Editor, DROP migration table
DROP TABLE IF EXISTS push_subscriptions CASCADE;

-- Repeat for any other 009_* migration objects
```

**Note**: Only do this if push is completely broken. Usually fixes are faster than rollback.

---

## Success Criteria

✅ **Deployment is successful when**:

- [ ] `npm run build` completes with 0 errors
- [ ] Service Worker `/sw.js` served (HTTP 200)
- [ ] `/offline` page accessible (HTTP 200)
- [ ] Database migration applied (table `push_subscriptions` exists)
- [ ] Users can subscribe to push (button works)
- [ ] Test push notification sends (received within 3 seconds)
- [ ] Offline mode works (data loads from cache when offline)
- [ ] No console errors in DevTools
- [ ] No red warnings in Supabase logs

---

## Sign-Off

**Deployed by**: [Your name]  
**Deployment date**: [Date]  
**Environment**: [production/staging]  
**Status**: ✅ Successful / ❌ Rollback / 🟡 Partial

---

## Support Contacts

- **Technical Issues**: Check SPRINT_6A_SUMMARY.md debugging section
- **VAPID Keys**: See "Pre-Deployment" section step 2
- **Push Notifications**: See known issues in SPRINT_6A_SUMMARY.md
- **Database**: Supabase dashboard → Logs tab
