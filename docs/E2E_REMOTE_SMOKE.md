# E2E Remote Smoke (Playwright)

Use this when validating a deployed URL (`https://...`) instead of local dev.

## Required env vars

- `PLAYWRIGHT_BASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- Optional: `E2E_EMAIL`, `E2E_PASSWORD`
- Optional: `E2E_AUTH_MODE=password|magic|auto`
- Optional: `E2E_ALLOW_MAGIC_LINK=1`

Default behavior:
- Remote base URL -> password-first auth, magic-link disabled unless enabled explicitly.
- Local base URL -> auto mode can use magic-link fallback.
- If Supabase password login is protected by CAPTCHA in production, set `E2E_ALLOW_MAGIC_LINK=1`.

## Commands

Run auth check:

```bash
npm run test:e2e:auth:remote
```

Run read-only smoke set:

```bash
npm run test:e2e:smoke:remote
```

Included specs:
- `tests/e2e/api-health.spec.ts`
- `tests/e2e/auth.spec.ts`
- `tests/e2e/smoke.spec.ts`
- `tests/e2e/navigation.spec.ts`
- `tests/e2e/mobile-layout-fit.spec.ts`
