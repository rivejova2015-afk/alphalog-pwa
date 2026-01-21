# IONOS Domain Setup - AlphaLog.io

## Overview
This document covers the setup and deployment of **alphalog.io** through IONOS.

## Domain Configuration

### 1. Environment Variables (✅ Already Configured)
```env
# .env.local (production)
NEXT_PUBLIC_APP_URL=https://alphalog.io
ALPHALOG_WEB_URL=https://alphalog.io

# .env.example (template)
NEXT_PUBLIC_APP_URL=https://alphalog.io
ALPHALOG_WEB_URL=https://alphalog.io
```

### 2. Next.js Configuration (✅ Already Configured)
- **File**: `next.config.ts`
- **Setting**: `allowedHosts` for production domain verification
- **Domains**: `alphalog.io`, `www.alphalog.io`

## IONOS DNS Configuration

### Step 1: Point Domain to Deployment
In IONOS Dashboard → Domain Management → **alphalog.io**:

#### Option A: Vercel Deployment (Recommended)
1. Set **DNS Records**:
   - `A Record`: `76.76.19.165` (Vercel IP)
   - `CNAME www`: `cname.vercel-dns.com`
   - `TXT` (verification): `v=vercel-verify=...` (from Vercel)

2. In **Vercel Dashboard**:
   - Add domain: `alphalog.io`
   - Add domain: `www.alphalog.io`
   - Accept DNS verification

#### Option B: Self-Hosted / Other Provider
1. Point to your hosting provider's nameservers
2. Configure DNS records as per provider instructions
3. Example (self-hosted):
   - `A Record`: Your server IP (e.g., `192.0.2.1`)
   - `www CNAME`: `alphalog.io`

### Step 2: SSL/TLS Certificate
1. **IONOS Built-in SSL** (Automatic):
   - IONOS automatically provides SSL for domains
   - Activate in Domain Settings → Security → SSL

2. **Alternative: Let's Encrypt** (if self-hosted):
   ```bash
   # Using certbot
   certbot certonly --dns-ionos -d alphalog.io -d www.alphalog.io
   ```

### Step 3: Email Configuration (Optional)
If using email with the domain:
1. Set **MX Records** in IONOS:
   - `10 mx00.ionos.com`
   - `20 mx01.ionos.com`

2. Set **SPF, DKIM, DMARC** records for security

## Supabase Configuration

### Update Auth Redirect URLs
1. Navigate to **Supabase Dashboard** → Project → Authentication
2. Update **Redirect URLs**:
   - `https://alphalog.io/auth/callback`
   - `https://www.alphalog.io/auth/callback`
   - `http://localhost:3000/auth/callback` (keep for development)

### Update CORS Settings (if needed)
1. In Supabase → Project Settings → API
2. Add to CORS whitelist:
   - `https://alphalog.io`
   - `https://www.alphalog.io`

## Edge Functions & Cron Endpoints

### Update ALPHALOG_WEB_URL in Supabase Secrets
```bash
# Set environment variables for Edge Functions
supabase secrets set ALPHALOG_WEB_URL=https://alphalog.io
supabase secrets set CRON_SECRET=<your-cron-secret>
```

### Update Edge Function Callbacks
Files that use `ALPHALOG_WEB_URL`:
- `supabase/functions/treasury-withdrawal-reminders/index.ts`
- `supabase/functions/business-recurring-costs/index.ts`
- `supabase/functions/business-alerts/index.ts`
- `supabase/functions/generate-scheduled-report/index.ts`

Example:
```typescript
const webUrl = Deno.env.get('ALPHALOG_WEB_URL') || 'https://alphalog.io';
const endpoint = `${webUrl}/api/cron/treasury/withdrawal-reminders`;
```

## Deployment Checklist

- [ ] **IONOS Domain Pointed**: DNS records configured
- [ ] **SSL/TLS Active**: HTTPS certificate installed
- [ ] **Environment Variables Updated**: `.env.local` with `alphalog.io`
- [ ] **Supabase Auth URLs Updated**: Callback URLs configured
- [ ] **Supabase CORS Whitelist**: Domain added
- [ ] **Edge Function Secrets**: `ALPHALOG_WEB_URL` set in Supabase
- [ ] **DNS Propagation**: Wait 24-48 hours for full propagation
- [ ] **HTTPS Test**: Verify `https://alphalog.io` works
- [ ] **Auth Flow Test**: Login via `alphalog.io`
- [ ] **Cron Endpoints Test**: Verify edge functions can call back to domain

## Testing

### 1. DNS Resolution
```bash
# Test domain resolution
nslookup alphalog.io
# or
dig alphalog.io

# Expected: Returns IP from IONOS/Vercel
```

### 2. HTTPS Connectivity
```bash
# Test HTTPS
curl -I https://alphalog.io
# Expected: HTTP 200 or 301 (redirect to /auth)
```

### 3. Auth Callback
1. Visit: `https://alphalog.io/auth`
2. Login with test account
3. Should redirect to `https://alphalog.io/auth/callback`
4. Then redirect to dashboard

### 4. Edge Function Callback
```bash
# Test Edge Function calling back to domain
curl -X POST \
  -H "x-cron-secret: <CRON_SECRET>" \
  https://alphalog.io/api/cron/business/alerts

# Expected: {"success": true, ...}
```

## Rollback Plan

### Revert to Localhost/Staging
1. Update `.env.local`:
   ```env
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ALPHALOG_WEB_URL=http://localhost:3000
   ```

2. Update Supabase Auth URLs back to `http://localhost:3000/auth/callback`

3. Revert IONOS DNS to previous configuration

4. Redeploy application

## Support

- **IONOS Support**: https://www.ionos.com/help
- **Vercel DNS Setup**: https://vercel.com/docs/concepts/projects/domains
- **Supabase Auth**: https://supabase.io/docs/guides/auth

---

**Last Updated**: January 21, 2026  
**Status**: ✅ Configuration Complete
