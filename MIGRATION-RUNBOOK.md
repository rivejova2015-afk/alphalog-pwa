# Migración Vercel → Fly.io — Runbook ejecutable

> Estado actual: Vercel suspendió la cuenta `rivejova2015-afk`. `alphalog.io` muestra "deployment paused".
> Objetivo: cutover a Fly.io en 3 días sin perder datos ni crons.

Toda la infraestructura como código ya está commiteada en este repo:

| Archivo | Propósito |
|---|---|
| `Dockerfile` | Imagen runtime de la PWA (Next.js 16 standalone) |
| `Dockerfile.cron` | Imagen del sidecar de cron (supercronic) |
| `.dockerignore` | Excluye `coinarb/`, `polyarb/`, `bots/`, etc. de la imagen |
| `fly.toml` | App web (`alphalog-pwa`) en región `iad` |
| `fly.cron.toml` | App cron (`alphalog-cron`) en `iad`, sin puerto público |
| `crontab` | 15 jobs portados de `vercel.json` (UTC) |
| `.fly-secrets.example.sh` | Template para `fly secrets set` (no commitea valores reales) |
| `next.config.ts` | Ya tiene `output: 'standalone'` añadido |

Las siguientes acciones requieren **tu intervención manual** (browser, cuenta Fly, DNS IONOS). Yo no puedo hacerlas por ti, pero abajo está la secuencia exacta.

---

## DÍA 1 — Provisión Fly.io (≈ 1 h)

### 1.1 Autenticación

```powershell
fly auth login
```

Abre browser. Loguéate con la cuenta que ya usas para `coinarb-50x`. Verifica:

```powershell
fly auth whoami
fly orgs list
```

Anota tu org slug (probablemente `personal` o el nombre de tu workspace).

### 1.2 Crear las dos apps (sin desplegar todavía)

```powershell
fly apps create alphalog-pwa --org personal
fly apps create alphalog-cron --org personal
```

> Si `alphalog-pwa` ya está tomado globalmente, prueba `alphalog-io` o `alphalog-app` y actualiza `app =` en `fly.toml` + `fly.cron.toml` (el cron apunta a `http://<APP>.internal:3000`, ojo).

### 1.3 Reservar IPv4 dedicada (necesaria para DNS apex en IONOS)

```powershell
fly ips allocate-v4 --app alphalog-pwa
fly ips allocate-v6 --app alphalog-pwa
fly ips list --app alphalog-pwa
```

Anota la IPv4 y la IPv6 — las necesitas en el paso 3.1.

### 1.4 Configurar secretos

1. Recolectar los valores de producción desde sus fuentes originales (Supabase dashboard, Postmark, OpenAI dashboard, QStash console). **No** intentes recuperarlos de Vercel — la cuenta está bloqueada y el CLI no está instalado.
2. Copiar el template:
   ```powershell
   Copy-Item .fly-secrets.example.sh .fly-secrets.local.sh
   ```
3. Editar `.fly-secrets.local.sh` reemplazando cada `REPLACE_ME` con el valor real.
4. Generar los secretos nuevos que **no** existían en Vercel:
   ```powershell
   # En Git Bash o WSL:
   openssl rand -base64 32   # CRON_SECRET   (o reusa el de Vercel si lo tienes)
   openssl rand -base64 32   # OPS_CRON_SECRET
   ```
   El `OPS_CRON_SECRET` es nuevo (el sidecar lo usa para autenticarse contra `/api/ops/cron/*`). Asegúrate que coincida con el que valida tu código server-side — si tu auth de `/api/ops/cron/*` usa `OPS_CRON_SECRET` ya existente, reusa ese valor.
5. Aplicar a ambas apps:
   ```powershell
   bash .fly-secrets.local.sh                 # alphalog-pwa
   bash .fly-secrets.local.sh alphalog-cron   # alphalog-cron
   ```
6. **Borrar** el archivo:
   ```powershell
   Remove-Item .fly-secrets.local.sh
   ```

### 1.5 Primer build remoto del web (sin DNS todavía)

Importante: los `NEXT_PUBLIC_*` se inlinen en el bundle de cliente al build, así que hay que pasarlos como `--build-arg` la primera vez. Después de la primera build los secretos quedan persistidos en Fly y `fly deploy` los reusará.

```powershell
fly deploy --app alphalog-pwa `
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://jgkvnnlodwdtjsmmzwry.supabase.co `
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=$env:NEXT_PUBLIC_SUPABASE_ANON_KEY `
  --build-arg NEXT_PUBLIC_VAPID_PUBLIC_KEY=$env:NEXT_PUBLIC_VAPID_PUBLIC_KEY `
  --build-arg NEXT_PUBLIC_HCAPTCHA_SITE_KEY=$env:NEXT_PUBLIC_HCAPTCHA_SITE_KEY `
  --build-arg NEXT_PUBLIC_SENTRY_DSN=$env:NEXT_PUBLIC_SENTRY_DSN
```

(Setea `$env:VAR` previamente en la misma sesión PowerShell con los valores reales.)

Esperar ~5–10 min. Verificar:

```powershell
fly status --app alphalog-pwa
fly logs --app alphalog-pwa
Invoke-WebRequest https://alphalog-pwa.fly.dev/api/health -UseBasicParsing | Select-Object StatusCode, Content
```

Health check debe devolver 200 con `{ "ok": true, ... }`.

### 1.6 Deploy del cron sidecar

```powershell
fly deploy --app alphalog-cron --config fly.cron.toml --dockerfile Dockerfile.cron
fly logs --app alphalog-cron
```

Verificar que aparece "supercronic v0.2.33 starting" y luego "starting iteration".

---

## DÍA 2 — Smoke tests (≈ 2 h, sin cambiar DNS)

Mientras DNS sigue apuntando a Vercel (caído), prueba todo contra `https://alphalog-pwa.fly.dev`:

### 2.1 Funcionales (manual)

- [ ] Login con Google OAuth → `/auth` → callback exitoso
  > **Bloqueante**: en Google Cloud Console → OAuth Client → "Authorized redirect URIs" añade `https://alphalog-pwa.fly.dev/auth/callback`. Sin esto el callback rechaza.
  > **Bloqueante**: en Supabase Dashboard → Auth → URL Configuration → añade `https://alphalog-pwa.fly.dev` a "Site URL" y a "Redirect URLs".
- [ ] Dashboard renderiza métricas
- [ ] Crear trade, eliminar trade (verifica RLS y CSRF)
- [ ] Push notification test desde `/dashboard/logs/pwa`
- [ ] Inbox: enviar email a `<alias>@alphalog.io` (sigue funcionando porque Postmark inbound NO depende de tu dominio web, depende del MX que ya tienes)

### 2.2 Crons

```powershell
fly logs --app alphalog-cron
```

Esperar 5 min. Verificar que los jobs `*/5` y `* * * * *` se ejecutan y devuelven HTTP 200/204. Si ves 401 → revisar `CRON_SECRET` / `OPS_CRON_SECRET` en `alphalog-cron`. Si ves "ENOTFOUND alphalog-pwa.internal" → el sidecar no está en la misma org que el web; mover.

### 2.3 Webhook MT5 (todavía contra fly.dev)

Como prueba sin cambiar nada en MT5, dispara manualmente:

```powershell
$body = @{ test = $true } | ConvertTo-Json
Invoke-WebRequest -Uri "https://alphalog-pwa.fly.dev/api/webhooks/mt5" `
  -Method POST -ContentType "application/json" -Body $body
```

Debe responder 401 (sin HMAC válido) — confirma que el endpoint vive y el guard funciona.

---

## DÍA 3 — Cutover de DNS y endpoints externos (≈ 1 h)

> **No revertible en <24h** por TTL de DNS. Asegúrate primero que día 2 pasó al 100%.

### 3.1 IONOS — apuntar `alphalog.io` y `www.alphalog.io` a Fly

En el panel de IONOS, dominio `alphalog.io` → DNS:

| Tipo | Host | Valor | TTL |
|---|---|---|---|
| A | @ | `<IPv4 del paso 1.3>` | 3600 |
| AAAA | @ | `<IPv6 del paso 1.3>` | 3600 |
| CNAME | www | `alphalog-pwa.fly.dev.` | 3600 |
| _(borrar)_ | _Anteriores apuntando a Vercel (76.76.21.x)_ | | |

### 3.2 Activar certificados TLS en Fly

```powershell
fly certs add alphalog.io --app alphalog-pwa
fly certs add www.alphalog.io --app alphalog-pwa
fly certs list --app alphalog-pwa
```

Esperar ~2–10 min hasta que diga "Configured" y "Issued". Fly genera Let's Encrypt automáticamente vía ACME-DNS-01 contra los registros A/AAAA que ya creaste.

### 3.3 Actualizar endpoints externos al dominio canónico

| Sistema | Dónde | Qué cambiar |
|---|---|---|
| Google OAuth | Cloud Console → OAuth Client | Añadir `https://alphalog.io/auth/callback` y `https://www.alphalog.io/auth/callback` (mantener el de `fly.dev` por ahora) |
| Supabase Auth | Dashboard → Auth → URL Config | Site URL = `https://alphalog.io`. Redirect URLs += ambos `https://*.alphalog.io/auth/callback` |
| Postmark Inbound | Server → Inbound | Webhook URL = `https://alphalog.io/api/inbound/email` |
| EA MetaTrader 5 | Settings del EA | `WEBHOOK_URL = https://alphalog.io/api/webhooks/mt5` (si está hardcoded) |
| QStash schedules | Console Upstash | Si tienes schedules persistidos apuntando a `vercel.app`, recrearlos hacia `alphalog.io` |
| Service Worker (PWA) | Auto-update | El PWA `UpdateManager` detecta nueva versión y refresca al próximo load — no requiere intervención |

### 3.4 Verificación final

```powershell
# Dominio canónico responde
Invoke-WebRequest https://alphalog.io/api/health -UseBasicParsing

# Redirect www → apex (el middleware ya lo hace)
curl -I https://www.alphalog.io

# Certificado válido
echo | openssl s_client -servername alphalog.io -connect alphalog.io:443 2>$null | openssl x509 -noout -dates

# Push notifications: enviar test desde la UI
```

---

## DÍA 4 — Limpieza y hardening (opcional pero recomendado)

### 4.1 Sacar coinarb/polyarb/bots del monorepo

Estos viven en Fly.io / Tradovate / MT5 local y no se deployan con la web. Mantenerlos en el monorepo:
- Infla el tarball de build (mitigado por `.dockerignore`)
- Re-genera la señal "fintech / trading" que disparó el ban de Vercel

Plan: convertirlos en repos hermanos en GitHub bajo la misma org, eliminarlos del monorepo, opcionalmente referenciar como submodules.

### 4.2 Apelar Vercel (paralelo, sin urgencia)

Email a `support@vercel.com` desde la cuenta bloqueada:
> Subject: Account block appeal — alphalog-pwa
>
> The blocked deployment is a personal trading-journal PWA for my own use. The
> trading bots themselves run elsewhere (Fly.io and local MT5) and were not
> deployed via Vercel. I've already migrated the runtime off-platform to
> resolve the immediate outage. I would like to understand the specific policy
> trigger so I can avoid it in any future Vercel projects.

Esto NO bloquea nada, solo abre puerta de regreso si quieres preview deploys en el futuro.

### 4.3 Activar Sentry

Una vez DSN seteado en Fly secrets, los errores ya fluyen. Setea también `SENTRY_AUTH_TOKEN` en build args para subir source-maps:

```powershell
fly deploy --app alphalog-pwa `
  --build-arg SENTRY_AUTH_TOKEN=$env:SENTRY_AUTH_TOKEN `
  --build-arg SENTRY_ORG=$env:SENTRY_ORG `
  --build-arg SENTRY_PROJECT=alphalog-pwa
```

---

## Rollback de emergencia

Si después de cambiar DNS algo crítico se rompe y no puedes arreglarlo en <30 min:

1. **NO** intentes revertir DNS a Vercel — está bloqueado, dará la misma pantalla negra.
2. Plan B: apuntar `alphalog.io` a `alphalog-pwa.fly.dev` vía CNAME flattening (CNAME ALIAS en IONOS si lo soporta, o cambiar el A record a las IPs anycast de Fly y dejar que Fly enrute por SNI — más simple).
3. Si la build de Fly está corrupta: `fly releases --app alphalog-pwa` y `fly releases rollback <previous-version> --app alphalog-pwa` (instantáneo, no rebuild).

---

## Estimación de costos Fly.io

| Recurso | Mes |
|---|---|
| `alphalog-pwa` shared-cpu-2x 2GB always-on | ~$5.70 |
| `alphalog-cron` shared-cpu-1x 256MB always-on | ~$1.94 |
| 2x IPv4 dedicada | $0 (1ra gratis, 2da gratis para certs) — verifica facturación |
| Bandwidth (1 usuario) | <$1 |
| **Total estimado** | **~$8–10/mes** |

Comparable al plan Hobby de Vercel ($0) pero con runtime estable y sin riesgo de ban por contenido.

---

## Checklist final (imprimible)

```
[ ] DÍA 1
    [ ] fly auth login
    [ ] fly apps create alphalog-pwa
    [ ] fly apps create alphalog-cron
    [ ] fly ips allocate-v4/v6 — anotadas
    [ ] Secrets aplicados a ambas apps
    [ ] fly deploy alphalog-pwa — health 200
    [ ] fly deploy alphalog-cron — supercronic activo

[ ] DÍA 2 (smoke tests contra alphalog-pwa.fly.dev)
    [ ] OAuth Google redirect URI añadido
    [ ] Supabase Site URL + Redirect URLs añadidos
    [ ] Login funciona
    [ ] Push notifications funcionan
    [ ] Crons ejecutándose sin 401
    [ ] Webhook MT5 responde 401 (guard ok)

[ ] DÍA 3 (cutover)
    [ ] DNS IONOS A/AAAA/CNAME actualizado
    [ ] fly certs add alphalog.io — Issued
    [ ] fly certs add www.alphalog.io — Issued
    [ ] Postmark Inbound webhook actualizado
    [ ] EA MT5 webhook URL actualizado (si aplica)
    [ ] QStash schedules apuntan a alphalog.io
    [ ] alphalog.io/api/health responde 200

[ ] DÍA 4 (opcional)
    [ ] coinarb/polyarb/bots sacados del monorepo
    [ ] Apelación Vercel enviada
    [ ] Sentry source-maps subidos
```
