# Deployment Guide — 24/7 Production on Vercel (Sprint 14)

This guide describes how to deploy AlphaLog to Vercel for 24/7 uptime with PWA features on iOS and PC.

## Prerequisites
- Vercel account with access to the project repository
- Supabase project (single project)

## Environment Variables (names only)
Set these in Vercel → Project Settings → Environment Variables:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY (server-only if needed)
- NEXT_PUBLIC_APP_NAME
- NEXT_PUBLIC_ENABLE_SW (optional; usually false in dev, true in prod)
- NEXT_PUBLIC_VAPID_PUBLIC_KEY
- VAPID_PRIVATE_KEY
- VAPID_SUBJECT
- E2E_EMAIL (optional for CI)
- E2E_PASSWORD (optional for CI)
- PLAYWRIGHT_BASE_URL (optional for CI)
- CRON_SECRET (if using cron endpoints)
- ALPHALOG_WEB_URL (public base URL)
- RUNWAY_THRESHOLD_MONTHS (optional)
- POSTMARK_SERVER_TOKEN (if using email)
- POSTMARK_INBOUND_WEBHOOK_SECRET (if using email)
- SECURE_MAIL_DOMAIN (if using email)
- SECURE_MAIL_MAX_EMAIL_ATTACHMENT_BYTES (if using email)
- NEXT_PUBLIC_SECURE_MAIL_DOMAIN (if using email)
- NEXT_PUBLIC_SECURE_MAIL_MAX_EMAIL_ATTACHMENT_BYTES (if using email)
- NEXT_PUBLIC_CANONICAL_HOST (canonical apex domain, e.g., dominio.com)

No secrets are committed to the repository. Configure all values in Vercel.

## Domains & DNS
1. Add your domain in Vercel → Domains
2. Set apex as canonical (e.g., dominio.com)
3. Point DNS to Vercel nameservers or add required A/ALIAS/CNAME records
4. Ensure `www` subdomain is added; middleware will redirect to apex in production

## OAuth Redirect URLs (Supabase)
Add allowed redirect URLs in Supabase Auth Settings:
- https://dominio.com/auth/callback
- http://localhost:3000/auth/callback

## Build & Deploy
1. Import the GitHub repo into Vercel
2. Set environment variables
3. Trigger a deployment
4. Verify build succeeded and app is live

## Post-Deploy Checks
- https://dominio.com/health → 200 "ok"
- https://dominio.com/api/health → `{ ok: true, ts }`
- https://dominio.com/manifest.webmanifest → served OK
- Install PWA on iOS and PC
- Service Worker active; OAuth routes excluded from cache

## Notes on Service Worker
- OAuth-sensitive routes `/auth/*`, `/auth/callback`, `/api/auth/*` are network-only with `no-store`
- URLs with `code` or `state` query params skip caching
- Assets use cache-first; navigations use network-first with offline fallback

## Rollback
If anything breaks:
```bash
git revert <commit>
git restore public/sw.js middleware.ts src/app/manifest.ts src/app/layout.tsx src/app/health/page.tsx src/app/api/health/route.ts src/app/dashboard/logs/pwa/page.tsx
```
Re-deploy in Vercel after reverting.
