# AlphaLog.io - Production Deployment Checklist

**Migration Date**: January 21, 2026  
**Domain**: alphalog.io (IONOS)  
**Status**: Ready for deployment

---

## Pre-Deployment Verification

### ✅ Code Changes
- [x] Environment variables updated (.env.local, .env.example)
- [x] next.config.ts updated with image patterns and security headers
- [x] middleware.ts updated with canonical host
- [x] CORS origins updated to alphalog.io
- [x] VAPID subject updated to support@alphalog.io
- [x] Edge Functions documentation updated
- [x] Build passes: `npm run build` ✓

### ⏳ IONOS Domain Configuration
- [ ] Verify DNS propagation: `nslookup alphalog.io` returns 216.24.57.1
- [ ] Verify SSL certificate is active in IONOS dashboard
- [ ] Confirm auto-renewal is enabled
- [ ] Check that nameservers are active:
  - ns1104.ui-dns.biz
  - ns1033.ui-dns.org
  - ns1073.ui-dns.de
  - ns1058.ui-dns.com

### ⏳ Supabase Dashboard Configuration

#### Auth Settings
In **Authentication → URL Configuration**:
- [ ] Add redirect URL: `https://alphalog.io/auth/callback`
- [ ] Add redirect URL: `https://www.alphalog.io/auth/callback`
- [ ] Keep URL: `http://localhost:3000/auth/callback` (development)
- [ ] Save changes

#### CORS Settings
In **Project Settings → API → CORS Whitelist**:
- [ ] Add origin: `https://alphalog.io`
- [ ] Add origin: `https://www.alphalog.io`
- [ ] Keep: `http://localhost:3000` (development)
- [ ] Save

#### Edge Function Secrets
In **Edge Functions → Settings**:
```bash
# Run these commands:
supabase secrets set ALPHALOG_WEB_URL=https://alphalog.io
supabase secrets set CRON_SECRET=<your-existing-secret>
```
- [ ] ALPHALOG_WEB_URL set
- [ ] CRON_SECRET confirmed

### ⏳ Vercel Configuration

In **Vercel Dashboard → Project Settings → Domains**:
- [ ] Add domain: `alphalog.io`
- [ ] Add domain: `www.alphalog.io`
- [ ] Accept DNS verification prompt
- [ ] Wait for SSL certificate auto-generation (max 30 min)
- [ ] Verify certificate is active

**Expected Vercel DNS Records**:
```
Type: A
Name: alphalog.io
Value: 76.76.19.165

Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

### ⏳ Testing (Local)

```bash
# 1. Start dev server
npm run dev
# Access: http://localhost:3000

# 2. Verify env vars loaded
curl http://localhost:3000/api/health
# Check response includes domain references

# 3. Test CORS in browser console
const data = await fetch('/api/logs/ingest', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ logs: [] })
});
console.log(data.status); // Should be 401 (auth required) not 403 (CORS)
```

- [ ] Dev server runs without errors
- [ ] Environment variables load correctly
- [ ] API responds with correct CORS headers

### ⏳ Testing (Production)

Wait 24-48 hours for DNS propagation, then run:

```bash
# 1. DNS Resolution
nslookup alphalog.io
dig alphalog.io @8.8.8.8

# Expected: 
# Name: alphalog.io
# Address: 216.24.57.1 (IONOS)
```
- [ ] DNS resolves correctly

```bash
# 2. HTTPS Connectivity
curl -I https://alphalog.io
curl -I https://www.alphalog.io

# Expected: HTTP 200 or 308 (redirect)
```
- [ ] HTTPS works for apex domain
- [ ] HTTPS works for www domain
- [ ] Both have valid SSL certificates

```bash
# 3. Security Headers
curl -I https://alphalog.io | grep "X-Frame-Options"
curl -I https://alphalog.io | grep "X-Content-Type-Options"

# Expected: Headers present
```
- [ ] Security headers present

```bash
# 4. Auth Flow Test
# Open browser: https://alphalog.io
# Click Login
# Complete auth flow
# Verify redirect to: https://alphalog.io/auth/callback?code=...
```
- [ ] Auth page loads
- [ ] Login works
- [ ] Callback redirects correctly
- [ ] Dashboard loads after login

```bash
# 5. API Health Check
curl https://alphalog.io/api/health

# Expected: { "status": "ok", ... }
```
- [ ] Health endpoint responds
- [ ] Response indicates healthy status

```bash
# 6. Logs Endpoint Test (authenticated)
# In browser console on dashboard:
await fetch('/api/logs/ingest', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    logs: [{
      level: 'info',
      area: 'test',
      message: 'Testing alphalog.io',
      fingerprint: 'test-' + Date.now()
    }]
  })
}).then(r => r.json()).then(console.log);

# Expected: { success: true, ingested: 1, failed: 0 }
```
- [ ] Logs endpoint accepts requests
- [ ] Database stores logs correctly

```bash
# 7. Edge Functions Test
# Set environment variable first:
export CRON_SECRET="your-secret-from-env"

# Test cron endpoint:
curl -X POST https://alphalog.io/api/cron/business/alerts \
  -H "x-cron-secret: $CRON_SECRET" \
  -H "Content-Type: application/json"

# Expected: { "success": true, ... }
```
- [ ] Edge Functions can reach backend
- [ ] Cron endpoints respond correctly

### ⏳ Monitoring

Post-deployment:

- [ ] Check error logs for domain-related issues
- [ ] Monitor DNS propagation via https://www.whatsmydns.net/?domain=alphalog.io
- [ ] Verify no 404s or redirect loops
- [ ] Check Vercel deployment logs
- [ ] Monitor Supabase logs for auth issues
- [ ] Verify cron jobs run on schedule

---

## Deployment Steps

### 1. Code Commit & Push
```bash
cd c:\Users\rivej\Documents\alphalog-pwa

# Verify no uncommitted changes
git status

# Add all changes
git add -A

# Commit with descriptive message
git commit -m "chore: migrate domain to alphalog.io

- Updated env vars: NEXT_PUBLIC_APP_URL, ALPHALOG_WEB_URL
- Updated CORS origins to alphalog.io
- Updated middleware canonical host
- Updated VAPID subject
- Updated next.config.ts with security headers
- Updated all documentation

Related: IONOS domain alphalog.io
"

# Push to main
git push origin main
```
- [ ] Commit successful
- [ ] Push successful
- [ ] Vercel deployment triggered

### 2. Monitor Vercel Build
- [ ] Check Vercel Dashboard for build status
- [ ] Wait for build to complete (expected: ~5 min)
- [ ] Verify build log has no errors
- [ ] Check preview deployment works

### 3. Promote to Production
In Vercel Dashboard:
- [ ] Click "Promote to Production"
- [ ] Or: Production builds automatically from main

### 4. Verify Production Deployment
```bash
# Check production domain is live
curl -I https://alphalog.io

# Check API endpoints
curl https://alphalog.io/api/health

# Verify auth works
# Browser: https://alphalog.io → Login → Verify dashboard loads
```
- [ ] Production deployment successful
- [ ] Domain responds with HTTP 200
- [ ] Auth flow works end-to-end

---

## Rollback Plan (If Issues Occur)

If you need to revert immediately:

### Option A: Environment Variable Rollback
```bash
# Revert .env.local locally (don't push)
NEXT_PUBLIC_APP_URL=http://localhost:3000
ALPHALOG_WEB_URL=http://localhost:3000
NEXT_PUBLIC_CANONICAL_HOST=
```

### Option B: Git Revert
```bash
# Find last good commit
git log --oneline | head -10

# Revert to previous commit
git revert <commit-hash>
git push origin main

# Vercel will auto-rebuild with reverted code
```

### Option C: Revert in Vercel
In Vercel Dashboard → Deployments:
- [ ] Click on previous successful deployment
- [ ] Click "Promote to Production"
- [ ] Wait for rollback to complete

### Post-Rollback:
- [ ] Update Supabase Auth URLs back to localhost
- [ ] Verify dev server works: `npm run dev`
- [ ] Investigate what went wrong
- [ ] Fix and redeploy

---

## Support & Resources

- **IONOS Help**: https://www.ionos.com/help
- **Vercel Docs**: https://vercel.com/docs
- **Supabase Auth**: https://supabase.io/docs/guides/auth
- **Next.js Docs**: https://nextjs.org/docs
- **DNS Checker**: https://www.whatsmydns.net

---

## Sign-Off

- [ ] I have verified all code changes
- [ ] I have tested locally
- [ ] I have configured Supabase
- [ ] I have configured Vercel
- [ ] I understand rollback procedure
- [ ] I'm ready to deploy

**Deployed By**: ________________  
**Date**: ________________  
**Time**: ________________

---

**Last Updated**: January 21, 2026  
**Status**: Ready for Deployment ✅

