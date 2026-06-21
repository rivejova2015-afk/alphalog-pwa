# Auditoría de Seguridad — AlphaLog PWA

**Fecha:** 2026-06-17
**Alcance:** Código fuente completo, 130 migraciones SQL, ~85+ API routes, middleware, librerías de seguridad.
**Metodología:** Auditoría defensiva read-only contra un cuestionario de ~600 preguntas en 15 áreas (assessment de código generado por IA). Cada hallazgo Alto/Medio fue **confirmado abriendo el archivo** (no solo reportado por un agente).
**Naturaleza de la app:** PWA mono-usuario (un dueño) con arquitectura multi-usuario completa vía RLS. Varias severidades se atenúan por el contexto single-user; se anota "(multi-user: Alta)" donde aplica.

> **Veredicto global:** base de seguridad **sólida y por encima del promedio** para código asistido por IA — Supabase Auth (bcrypt, cookies httpOnly, PKCE), RLS `auth.uid()=user_id` en todas las tablas, CSRF timing-safe, cifrado AES-256-GCM con dominios separados, headers CSP-nonce/HSTS, audit trail con hash-chain. **0 hallazgos Críticos.** Los problemas reales son **1 Alto** (SSRF con fuga de secreto) y **~7 Medios** concentrados en MFA/step-up, política de password, supply-chain y un XSS mitigado por CSP.

---

## Resumen ejecutivo

| Severidad | Cantidad | Resumen |
|-----------|----------|---------|
| 🔴 Crítica | 0 | — |
| 🟠 Alta | 1 | SSRF + exfiltración de `INTERNAL_API_SECRET` vía header `Origin` en reports/generate |
| 🟡 Media | 8 | Step-up sin 2º factor real · open-redirect en login · `bot_monitor_state` RLS abierta · password débil · XSS en ChatMessage (CSP-mitigado) · auth events sin audit-log · supply-chain (8 vulns high, sin gate) · MFA no forzada en ops sensibles |
| 🔵 Baja | ~10 | WebAuthn sin `.eq(user_id)` explícito · path-injection en attachments (storage-RLS mitiga) · alerting push-only silenciable · app_logs auto-borrable · timeouts faltantes · MIME por content-type del cliente · etc. |
| ✅ Info/OK | — | anon key hardcodeada (pública por diseño) · HSTS ausente en assets estáticos |

### Top-10 riesgos priorizados

| # | Sev | Riesgo | Evidencia | Remediación (resumen) |
|---|-----|--------|-----------|------------------------|
| 1 | 🟠 Alta | SSRF: `fetch(\`${origin}/api/push/notify-user\`)` adjunta `INTERNAL_API_SECRET`; `Origin` es header controlable → exfiltra el secreto a host arbitrario | `src/app/api/tradehub/reports/generate/route.ts:219-225` | Usar `process.env.NEXT_PUBLIC_APP_URL` (como los demás llamadores), nunca el header `Origin` |
| 2 | 🟡 Media | Step-up "device trust" no exige 2º factor: `device/verify` marca `trusted:true` con solo la sesión password | `src/app/api/auth/device/verify/route.ts:72-83` | Exigir TOTP/WebAuthn verificado antes del upsert `trusted:true` |
| 3 | 🟡 Media | Open-redirect: `window.location.href = next` con `next` crudo del query param | `src/app/auth/page.tsx:148,155` | Validar `next.startsWith('/') && !next.startsWith('//')` (allowlist de rutas internas) |
| 4 | 🟡 Media | RLS abierta: `bot_monitor_state FOR ALL USING(true) WITH CHECK(true)` sin `TO service_role` → cualquier autenticado lee/escribe | `supabase/migrations/064_bot_monitor_state.sql:12-14` | `TO service_role` o eliminar la policy (service_role ya bypassa RLS) |
| 5 | 🟡 Media | Password: mínimo 6 chars, validación solo cliente; sin complejidad, lista de comunes, historial ni lockout por-cuenta | `src/app/auth/page.tsx:238` | Subir a ≥12, validar server-side, checar lista de comunes (Supabase password policy / HIBP) |
| 6 | 🟡 Media | XSS sink: `renderMarkdown()` sin escapar HTML → `dangerouslySetInnerHTML` (mitigado por CSP-nonce en prod → queda inyección de HTML/contenido) | `src/components/terminal/ChatMessage.tsx:23,114` | DOMPurify o `react-markdown`; escapar antes de regex |
| 7 | 🟡 Media | Supply-chain: 18 vulns npm (8 high), `next-pwa@5.6.0` sin mantenimiento (cadena RCE serialize-javascript); sin `npm audit` en CI ni Dependabot | `npm audit`, `.github/workflows/quality-gate.yml` | `npm audit fix` no-breaking (form-data, sentry); migrar a `@ducanh2912/next-pwa`/Serwist; añadir gate + Dependabot |
| 8 | 🟡 Media | Eventos de auth (login/logout/stepup/device-trust/MFA/cambio password) **no** se escriben al audit trail | `src/app/api/auth/*` (sin `logAudit*`) | Instrumentar `logAuditEvent` en los flujos de auth |
| 9 | 🟡 Media | MFA/step-up nunca se re-exige para operaciones sensibles (cambio password/email, borrado, payouts, exports) | `src/proxy.ts:120-178` | Step-up por-operación en acciones críticas |
| 10 | 🔵 Baja | `INTERNAL_API_SECRET` / `SECURITY_ALERT_USER_ID` ausentes → `triggerSecurityAlert` se silencia (no-op); varios event types nunca se disparan | `src/lib/security/securityAlert.ts:37-44` | Validar presencia en boot; fallback a email/log durable |

### Estado de remediación (rama `security/remediation-2026-06`, 2026-06-18)

Los **9 hallazgos Alta + Media** se abordaron y verificaron (suite completa **2729 tests ✅**, lint **0 errores**, **build ✅**, gate `npm audit --audit-level=critical` ✅). Quedan 2 acciones de config en Supabase (password) y 2 ítems en backlog por decisión explícita.

| # | Hallazgo | Estado | Cambio aplicado |
|---|----------|--------|-----------------|
| 1 | SSRF reports/generate | ✅ Remediado | usa `NEXT_PUBLIC_APP_URL` en vez del header `Origin` + test |
| 2 | Step-up sin 2º factor | ✅ Remediado | `device/verify` exige AAL2; login-password enruta por `/auth/stepup`; passkey confía vía `auth-verify`; sin "Omitir" + test |
| 3 | Open-redirect `next` | ✅ Remediado | helper `safeNextPath` en los 3 sinks (page/stepup/callback) + test |
| 4 | `bot_monitor_state` RLS abierta | ✅ Remediado | migración `131` → policy `service_role`-only (calca la 117) |
| 5 | Password débil | ✅ Código · ⚙️ Falta config | validador min-12 en signup/reset/set-password + test. **Pendiente tú:** activar *Leaked Password Protection* (HIBP) + *min length* en el dashboard de Supabase |
| 6 | XSS ChatMessage | ✅ Remediado | escape-then-render (HTML escapado antes del markdown) + test |
| 7 | Supply-chain | ✅ Parcial · 🔁 Backlog | `npm audit fix` (18→7 vulns, **0 critical**) + gate CI `critical` + `dependabot.yml`. **Backlog:** migrar `next-pwa`→Serwist (corta los 5 high restantes) |
| 8 | Auth events sin audit | ✅ Remediado | `logAuditFromRequest` en login OAuth, logout, device_trust, stepup TOTP y passkey |
| 9 | MFA no forzada en ops sensibles | ✅ Remediado (parcial) | step-up reciente (AAL2 + `amr` < 15 min, infalsificable) en `payouts/create` + exports (trades/treasury) vía `requireFreshStepUp`; cliente reenvía a `/auth/stepup?reauth=1`. Password/email → settings de Supabase (config). No existe endpoint de borrado de cuenta. **Límite conocido:** reauth de un usuario solo-Face-ID (sin TOTP) cae a enrolar TOTP |

> Hallazgos **Baja/Info** siguen como backlog opcional (lista en el plan de remediación).

### Fortalezas confirmadas (no requieren acción)

- **Auth delegada a Supabase**: bcrypt para passwords, JWT validado por el SDK (firma, `exp`, `iss`, `aud`, rechazo de `alg:none`), tokens en cookies **httpOnly** (no localStorage), flujo **PKCE** (`src/lib/supabase/browser.ts:10`).
- **RLS `auth.uid() = user_id`** en todas las tablas de datos de usuario, con políticas explícitas SELECT/INSERT/UPDATE/DELETE; casos especiales correctos (`bot_instances` vía JOIN, `webauthn_credentials` 069:28-38). **0 `DISABLE ROW LEVEL SECURITY`** en 130 migraciones.
- **Service role server-only**: nunca con prefijo `NEXT_PUBLIC_`, nunca en componentes cliente.
- **CSRF**: token `al_csrf` + comparación timing-safe en middleware (`middleware.ts:87-99`), inyección automática vía `CsrfBridge`.
- **Cifrado AES-256-GCM**: IV aleatorio de 12B por mensaje, auth-tag validado en decrypt, clave de 32B verificada, **dominios separados** (journal/treasury/trades/mail), versionado para rotación (`src/lib/security/encryption.ts`).
- **Security headers**: CSP nonce + `strict-dynamic` (sin `unsafe-inline` en prod), HSTS 2 años `preload`, `X-Frame-Options: DENY`, `Permissions-Policy` restrictivo, `object-src 'none'`, `frame-ancestors 'none'` (`src/lib/security/headers.ts`).
- **Audit trail** con hash-chain HMAC-SHA256 append-only (`audit_logs` endurecido en migration 054).
- **Rate limiting** multinivel (120/min global, 3/min·20/h en exports, scraping >50 GET/30s, ban-IP), honeypots, validación de Content-Type.
- **Webhooks** (MT5/Postmark/QStash) con secreto + comparación timing-safe; senders de email con allowlist + almacenamiento solo-ciphertext.

---

# ÁREA 1 — Autenticación & Sesión

| Sub-área / Pregunta | Veredicto | Evidencia | Sev | Nota |
|---|---|---|---|---|
| Algoritmo de hashing de passwords | ✅ bcrypt (Supabase) | Supabase Auth | OK | Delegado; cost factor gestionado por Supabase |
| Longitud mínima / complejidad / caracteres | ⚠️ Solo ≥6, sin complejidad | `src/app/auth/page.tsx:238` | 🟡 Media | Validación **solo cliente**; sin mayús/número/especial |
| Lista de contraseñas comunes | ❌ No | — | 🟡 Media | No se valida contra diccionario/HIBP |
| Historial / reuso de passwords | ❌ No | — | 🔵 Baja | Supabase no lo trackea por defecto |
| Lockout por intentos fallidos (por cuenta) | ❌ No | `src/proxy.ts:99` | 🟡 Media | Solo throttling **por IP** (>5 fallos/5min → alerta), no bloqueo de cuenta |
| Backoff exponencial | ❌ No | — | 🔵 Baja | Rate-limit lineal |
| Mismo error "user no existe" vs "password incorrecta" | ✅ Sí | `src/app/auth/page.tsx` | OK | Mensaje genérico de Supabase |
| Log de intentos fallidos | ⚠️ Parcial | `src/proxy.ts:99-107` | 🔵 Baja | Alerta push si >5/5min; no fila durable en audit |
| MFA para operaciones sensibles | ❌ No forzado | `src/proxy.ts:120-178` | 🟡 Media | Ver Área 13 |
| Se envía password actual al cambiarla | ❌ No (Supabase updateUser) | — | 🔵 Baja | Sin re-auth en cambio de password |
| **Tokens** — almacenamiento cliente | ✅ Cookies httpOnly | `@supabase/ssr` | OK | No localStorage/sessionStorage |
| Cookie HttpOnly / Secure / SameSite | ✅ / ✅ / ✅ Lax | Supabase + `middleware.ts:137-138` | OK | `secure` en prod |
| Token accesible desde JS | ✅ No (sesión) | — | OK | Solo `al_csrf` es legible (por diseño) |
| Refresh token + expiración | ✅ Sí | `src/app/api/auth/refresh/route.ts` | OK | Gestionado por Supabase (~1h access / 7d refresh) |
| Revocación en logout | ✅ Sí | `src/app/api/auth/logout/route.ts` | OK | `signOut()` revoca refresh |
| Validación firma/`exp`/`alg`/`iss`/`aud` | ✅ Sí (Supabase) | `src/proxy.ts:87` `getUser()` | OK | Rechaza `alg:none` |
| Datos sensibles en payload JWT | ✅ No | — | OK | — |
| **Sesión** — timeout idle / absoluto | ❌ No idle; absoluto ≈7d | — | 🔵 Baja | Sin logout por inactividad |
| Sesiones concurrentes / límite | ⚠️ Trackeadas, sin límite | `auth_device_sessions` (mig. 026) | 🔵 Baja | Sin "cerrar otras sesiones" |
| Binding User-Agent / IP | ⚠️ UA sí, IP no | `src/proxy.ts:127-131` | 🔵 Baja | IP excluida a propósito (WiFi↔celular) |
| Ver/cerrar sesiones remotas (UI) | ❌ No UI | — | 🔵 Baja | Tabla existe; sin pantalla |

# ÁREA 2 — Autorización & Control de Acceso

| Sub-área / Pregunta | Veredicto | Evidencia | Sev | Nota |
|---|---|---|---|---|
| Validación de ownership (todos los métodos) | ✅ Sí | RLS + checks en routes | OK | RLS `auth.uid()=user_id` + filtros `.eq('user_id', userId)` |
| IDOR por cambio de id en URL/body/query | ✅ Bloqueado | RLS + `.eq('user_id')` | OK | `user_id` viene de la sesión, no del request |
| RLS habilitada en todas las tablas sensibles | ✅ Sí | 130 migraciones, 0 `DISABLE` | OK | accounts/trades/journal/secure_*/treasury_* con 4 políticas CRUD |
| Políticas `USING (true)` abiertas | ⚠️ 1 riesgosa + 3 intencionales | `064_bot_monitor_state.sql:12` | 🟡 Media | `bot_monitor_state FOR ALL USING(true)` sin `TO`; las otras (algorithm_templates/quality_gate_definitions/ops_alert_history) son SELECT de catálogos globales |
| Service role usado desde cliente | ✅ Nunca | grep server-only | OK | Sin `NEXT_PUBLIC_`, solo routes/lib server |
| RBAC / roles | N/A (single-user) | CLAUDE.md:20 | OK | Sin sistema de roles; ownership por `user_id` |
| Endpoints admin sin protección | ✅ No | `middleware.ts:63-77` | OK | Honeypots `/api/v1/admin` etc. → 404 + alerta |
| GraphQL introspection | N/A | — | OK | No usa GraphQL |
| `security_rls_audit()` cobertura | ⚠️ Congelada en 26 tablas | `migrations/039,040` | 🔵 Baja | No cubre ~80 tablas nuevas (polyarb/cme/coinarb/map_hot…); da falsa confianza si se usa como gate |
| Transferir ownership cambiando `user_id` | ✅ Bloqueado | RLS `WITH CHECK` | OK | — |

# ÁREA 3 — Entrada & Validación de Datos

| Sub-área / Pregunta | Veredicto | Evidencia | Sev | Nota |
|---|---|---|---|---|
| Validación backend (no solo frontend) | ✅ Sí | `src/lib/validation/schemas.ts` (Zod) | OK | + capas `autoFix` y `contractGuard` |
| Re-validación de todos los inputs | ✅ Sí | Zod en routes | OK | `validatePayload`/`validatePayloadSafe` |
| Whitelist / longitudes / tipos / formatos | ✅ Sí | `schemas.ts` | OK | UUID, enums, min/max, fechas |
| **SQL injection** — queries concatenadas | ✅ No | Supabase query builder | OK | Sin string-concat; `.rpc()` con parámetros nombrados |
| SQLi en búsqueda (UNION/ORDER BY/--) | ✅ No | — | OK | Builder parametriza |
| **XSS** — `dangerouslySetInnerHTML` con datos dinámicos | ⚠️ 1 sink | `src/components/terminal/ChatMessage.tsx:114` | 🟡 Media | `renderMarkdown()` sin sanitizar; **CSP-nonce en prod bloquea ejecución de JS** → residual: inyección de HTML/contenido |
| Sanitización (DOMPurify) | ❌ No en ChatMessage | — | 🟡 Media | Otros módulos evitan el patrón (cybersec usa `textContent`) |
| Otros `innerHTML`/`eval`/`Function`/`document.write` | ✅ Ninguno en prod | grep | OK | Solo el de ChatMessage |
| **Command/Code injection** (`exec`, `eval`) | ✅ No | grep | OK | Sin ejecución de comandos con input |
| `JSON.parse` sin try-catch | ✅ Protegido | rutas | OK | — |
| **Log injection** (newlines/control chars) | ⚠️ Bajo | `src/lib/alphashield/sanitize.ts` | 🔵 Baja | JSON.stringify neutraliza; redacción por nombre de clave (ver Área 9) |

# ÁREA 4 — Criptografía & Manejo de Secretos

| Sub-área / Pregunta | Veredicto | Evidencia | Sev | Nota |
|---|---|---|---|---|
| Algoritmo (AES-256-GCM vs inseguros) | ✅ AES-256-GCM | `src/lib/security/encryption.ts:62` | OK | Sin ECB/DES/RC4/XOR |
| IV único y aleatorio por mensaje | ✅ Sí | `encryption.ts:61` `randomBytes(12)` | OK | Prependido al ciphertext |
| Validación de integridad (auth tag / GCM) | ✅ Sí | `encryption.ts:96` `setAuthTag` | OK | `final()` lanza si falla |
| Longitud de clave / derivación | ✅ 32B verificada | `encryption.ts:29` | OK | Clave directa de env (no PBKDF2; aceptable para clave de 256b) |
| Clave expuesta al frontend | ✅ No | `ensureServer()` | OK | Solo servidor |
| Rotación de claves | ✅ Soportada | `KEY_REGISTRY` v1/v2 | OK | Sin automatización (manual) |
| Separación de claves por propósito | ✅ Sí | `DOMAIN_KEYS` | OK | journal/treasury/trades/mail |
| Datos en tránsito (HTTPS/TLS≥1.2/HSTS) | ✅ Sí | `headers.ts:11` | OK | HSTS 2 años preload |
| **Hashing de passwords** (bcrypt/argon2) | ✅ bcrypt (Supabase) | — | OK | Sin MD5/SHA1/plaintext para passwords |
| SHA1 en código | ⚠️ No-seguridad | `src/lib/news/ingest.ts:63` | 🔵 Baja | Solo dedup-ID de noticias, no password/seguridad |
| **Secretos en código / git** | ✅ No commiteados | `.gitignore`, `git ls-files` | OK | Solo `.env.example` (placeholders) |
| anon key hardcodeada (fallback) | ⚠️ Pública por diseño | `next.config.ts:23-25` | ✅ Info | Anon-tier JWT (RLS-gated) + project ref; hardening: JWT muy longevo en source |
| Test password commiteado | ⚠️ Menor | `.env.example:40` `E2E_PASSWORD` | 🔵 Baja | Credencial de test local |
| KMS / vault / rotación de secretos | ❌ No | Vercel/Fly env | 🔵 Baja | Sin KMS ni rotación automatizada |

# ÁREA 5 — Almacenamiento de Datos

| Sub-área / Pregunta | Veredicto | Evidencia | Sev | Nota |
|---|---|---|---|---|
| Cifrado de campos sensibles | ✅ Parcial selectivo | `encryption.ts` | OK | journal content/title, trades.notes, secure mail; migration 068 financial fields |
| Tarjetas de crédito almacenadas | ✅ N/A | grep | OK | No hay datos de tarjeta/pagos |
| Cifrado en reposo (BD) | ✅ Plataforma | Supabase AES-256 (us-east-2) | OK | Gestionado por Supabase |
| Backups / PITR | ⚠️ Depende del plan | Supabase | 🔵 Baja | No controlable a nivel app |
| **Storage** — buckets públicos vs privados | ✅ Privados | `056`, `077` migrations | OK | `skills`, `log_attachments` con `public:false` |
| RLS en `storage.objects` (aislamiento por user) | ✅ Sí | `077` `split_part(name,'/',1)=auth.uid()` | OK | Path prefijado con `${userId}/` server-side |
| Path traversal (`../`) en uploads | ✅ Bloqueado | sanitización filename + prefijo server | OK | `replace(/[^a-zA-Z0-9._-]/g,'_')` |
| Validación de tipo/extensión/tamaño | ⚠️ Parcial | `src/app/api/attachments/route.ts:7` | 🔵 Baja | `BLOCKED_EXTENSIONS` **declarado pero nunca aplicado**; MIME del `content-type` cliente (sin magic-bytes); `MAX_FILE_MB` sin enforcement en metadata route |
| Acceso a archivos de otros users | ✅ Bloqueado | storage RLS | OK | `createSignedUrl` con cliente de usuario respeta RLS |
| `secure-mail` bucket vía migración | ⚠️ Solo en comentario | `017_secure_mail.sql:196` | 🔵 Baja | Creado manualmente en dashboard (verificar que exista + RLS) |
| Caché de datos (redis/memcached) | ✅ No existe | `package.json` | OK | Sin capa de caché que filtre datos |

# ÁREA 6 — APIs & Comunicación

| Sub-área / Pregunta | Veredicto | Evidencia | Sev | Nota |
|---|---|---|---|---|
| **SSRF** — fetch a URLs de usuario | ⚠️ 1 caso real | `src/app/api/tradehub/reports/generate/route.ts:219` | 🟠 **Alta** | `Origin` header controlable + adjunta `INTERNAL_API_SECRET` → exfiltración. Resto de outbound fetch usa hosts hardcodeados/allowlisted |
| Bloqueo de IPs internas (127/169.254/10/192.168/::1) | ❌ No existe | global | 🔵 Baja | Defense-in-depth ausente (mitigado porque las URLs son hardcoded salvo el caso 219) |
| News/market-data fetch | ✅ Allowlisted | `src/lib/news/sources.ts`, fetchers | OK | Símbolos vía `Set` + `encodeURIComponent` |
| **Auth de APIs externas** (OpenAI/Anthropic/Postmark/QStash/Polygon) | ✅ Server-only, HTTPS | grep `process.env.*` | OK | Nunca `NEXT_PUBLIC_`, nunca logueadas |
| Validación de respuestas externas | ⚠️ Guards, sin Zod | `analyzeWithAI.ts:117-160` | 🔵 Baja | `typeof`/`clamp`/allowlist; no schema Zod pero no se renderiza como HTML |
| Timeouts / retries | ⚠️ Mayoría sí | AbortController 10-30s | 🔵 Baja | **Falta** timeout en RSS (`news/ingest.ts:84`) y QStash schedule |
| **Rate limiting** (IP/user/token) | ✅ Multinivel | `src/proxy.ts:181-283` | OK | 120/min, exports 3/min·20/h, scraping, ban-IP |
| Rate-limit AI falla abierto | ⚠️ Fail-open | `src/lib/security/aiRateLimit.ts` | 🔵 Baja | Permite si la RPC no responde; por-usuario, no por-IP |

# ÁREA 7 — Frontend Específico

| Sub-área / Pregunta | Veredicto | Evidencia | Sev | Nota |
|---|---|---|---|---|
| Tokens/secretos en localStorage | ✅ No (solo lectura legacy) | `src/lib/offline/snapshot.ts:188` | 🔵 Baja | Helpers leen `sb-auth-token`; sesión real en cookie |
| Datos sensibles en localStorage | ✅ No | `auth/page.tsx:124` | OK | Solo email "remember me" (no credenciales) |
| Limpieza en logout | ✅ Sí | `logout/route.ts` | OK | — |
| **DOM/render** — innerHTML/v-html/ng-bind | ⚠️ 1 (ChatMessage) | ver Área 3 | 🟡 Media | Único sink; CSP-mitigado |
| State management con secretos | ✅ No | — | OK | Sin tokens en stores |
| Comm backend siempre HTTPS | ✅ Sí | same-origin + HSTS | OK | — |
| CORS `*` con credenciales | ✅ No | `src/app/api/logs/ingest/route.ts:201` | OK | Allowlist explícita; sin `Allow-Credentials` |
| Forms — paste/autocomplete password | ⚠️ Default navegador | — | 🔵 Baja | Sin restricciones especiales (correcto para UX) |
| **Open-redirect** vía `next` | ⚠️ Sí (cliente) | `src/app/auth/page.tsx:148,155` | 🟡 Media | `window.location.href = next` sin validar |

# ÁREA 8 — Backend Específico

| Sub-área / Pregunta | Veredicto | Evidencia | Sev | Nota |
|---|---|---|---|---|
| Cada endpoint requiere auth | ✅ Sí (salvo públicos justificados) | `middleware.ts:63-77` | OK | Públicos: health/webhooks/cron/inbound/outbound/treasury-export, cada uno con su token |
| Acceso con token inválido/expirado/otro rol | ✅ 401 | `src/proxy.ts:89-118` | OK | Test E2E `api-auth-guard.spec.ts` |
| OPTIONS/HEAD/TRACE para bypass | ✅ No | matcher + métodos | OK | — |
| Métodos HTTP correctos (GET lee, etc.) | ✅ Sí | routes REST | OK | Content-Type validado en mutaciones |
| **Responses** — stack traces / schema / queries | ✅ No filtra | `catch` → genéricos | OK | Errores genéricos al cliente |
| IDs internos / versiones de software | ⚠️ Menor | headers `x-request-id` | 🔵 Baja | No expone stack/schema |
| **Error handling** — generic messages | ✅ Sí | routes | OK | Detalle solo en logs servidor |
| Distinguir auth vs otros por error/timing | ✅ No | — | OK | — |
| **Business logic** — overflow/negativos/división-cero | ⚠️ Revisar | métricas P&L | 🔵 Baja | Sin transferencia entre usuarios; cálculos con guards `Number.isFinite` |

# ÁREA 9 — Logging & Monitoreo

| Sub-área / Pregunta | Veredicto | Evidencia | Sev | Nota |
|---|---|---|---|---|
| Log de cambios de datos / exports / deletes | ✅ Sí | `src/lib/security/auditLog.ts` (~73 routes) | OK | CRUD/export/upload auditados |
| **Log de eventos de auth** (login/logout/stepup/device/MFA) | ❌ No | `src/app/api/auth/*` sin `logAudit*` | 🟡 Media | `AuditAction` define los tipos pero no se invocan |
| Log de passwords/tokens/PII | ✅ Redactado | `src/lib/alphashield/sanitize.ts` | OK | Redacción por nombre de clave |
| Redacción de secretos embebidos en valores | ⚠️ Parcial | `sanitize.ts` | 🔵 Baja | `{nota:"token=xyz"}` no se redacta (clave no sensible) |
| **Alertas** (canal) | ⚠️ Solo push, silenciable | `src/lib/security/securityAlert.ts:37-44` | 🔵 Baja | No-op si `INTERNAL_API_SECRET`/`SECURITY_ALERT_USER_ID` ausentes; sin email/Slack; varios event types nunca disparados |
| Umbrales / monitoreo de fallos | ✅ Sí | `src/proxy.ts:104,231` | OK | >5×401/5min, >50 GET/30s |
| **Storage de logs** / RLS / retención | ✅ RLS por user; 30d cleanup | `migrations/016`, `logs/cleanup` | OK | Usuario no ve logs ajenos |
| `app_logs` borrable por el usuario | ⚠️ Sí (DELETE policy) | `016_app_logs.sql:67` | 🔵 Baja | Sin append-only: el dueño puede borrar su rastro |
| Tamper-evidence del audit (hash chain) | ⚠️ Parcial | `auditLog.ts:96-113` | 🔵 Baja | Chain excluye `changes`/`status`; no-op silencioso si falta `AUDIT_CHAIN_SECRET`; `audit_logs` sí es append-only (mig. 054) |

# ÁREA 10 — Dependencias & Supply Chain

| Sub-área / Pregunta | Veredicto | Evidencia | Sev | Nota |
|---|---|---|---|---|
| `npm audit` resultado | ⚠️ 18 vulns (8 high, 9 mod, 1 low), 0 crit | `npm audit` | 🟡 Media | Cadena `next-pwa→workbox→…→serialize-javascript` (RCE, build); `form-data` (prod), `vite`/`ws` (dev) |
| Gate de vulnerabilidades en CI | ❌ No | `.github/workflows/quality-gate.yml` | 🟡 Media | Solo lint + build; sin `npm audit`/SCA |
| Dependabot / Renovate | ❌ No | sin `.github/dependabot.yml` | 🔵 Baja | Sin updates automáticos |
| Lockfile commiteado / único | ✅ Sí | `package-lock.json` | OK | Sin yarn/pnpm en conflicto |
| Rangos de versión (`^`/`~`/`*`) | ✅ Sin wildcards | `package.json` | OK | 4 exactas, 38 `^`, 0 `~`, 0 `*`/`latest` |
| Paquetes typosquat / git-url / no mantenidos | ⚠️ `next-pwa` sin mantenimiento | npm | 🔵 Baja | Raíz de la cadena RCE; migrar a Serwist/`@ducanh2912/next-pwa` |
| Dependencias inexistentes (hallucinated) | ✅ No | build pasa | OK | — |

# ÁREA 11 — Configuración & Infraestructura

| Sub-área / Pregunta | Veredicto | Evidencia | Sev | Nota |
|---|---|---|---|---|
| Variables de entorno para config | ✅ Sí | `.env.example` | OK | Documentadas |
| `NEXT_PUBLIC_*` con secretos | ✅ No | grep (13 vars) | OK | Ninguna contiene service-role/private/token |
| Secretos en bundle frontend | ✅ No | grep server-only | OK | — |
| **Security headers** (CSP/XFO/XCTO/HSTS/Referrer/Permissions) | ✅ Completos | `src/lib/security/headers.ts` | OK | CSP nonce+strict-dynamic en prod |
| CSP permite `unsafe-inline`/`eval` (script) | ✅ No en prod | `headers.ts:72-92` | OK | `unsafe-inline` solo en `style-src` (Tailwind); `eval` solo dev |
| SRI (subresource integrity) | ❌ No | — | 🔵 Baja | Hardening opcional |
| **CORS** | ✅ Allowlist | `logs/ingest/route.ts:201` | OK | Sin `*`, sin credentials |
| **HTTPS/TLS** — redirect, HSTS, TLS≥1.2 | ✅ Sí | `middleware.ts:47`, `headers.ts:11` | OK | Canonical 308 + Vercel TLS edge |
| HSTS en assets estáticos | ⚠️ No | `middleware.ts:157` matcher | ✅ Info | Excluye `_next/`/imágenes; navegador cachea HSTS del documento |
| Doble header CSP (next.config + middleware) | ⚠️ Menor | `next.config.ts:96` | ✅ Info | next.config solo `frame-ancestors`; middleware el CSP completo |

# ÁREA 12 — Manejo de Errores & Información Sensible

| Sub-área / Pregunta | Veredicto | Evidencia | Sev | Nota |
|---|---|---|---|---|
| Stack trace / nombres archivo / línea al cliente | ✅ No | routes `catch` | OK | Mensajes genéricos |
| SQL queries / schema / API keys en errores | ✅ No | — | OK | — |
| Rutas internas / versiones en errores | ✅ No | — | OK | — |
| Info de más en responses (PII de otros, hashes, tokens) | ✅ No | RLS + selects acotados | OK | — |
| 404 vs 403 revela existencia de recurso | ⚠️ Mixto | routes (404 "not found or unauthorized") | 🔵 Baja | Mayormente 404 unificado; aceptable |
| Timing attack en errores | ✅ Mitigado | `timingSafeEqualStr` | OK | Comparaciones constantes en tokens |

# ÁREA 13 — Comunicación & Autenticación de Terceros

| Sub-área / Pregunta | Veredicto | Evidencia | Sev | Nota |
|---|---|---|---|---|
| OAuth 2.0 / OIDC (Google) | ✅ Sí | `auth/page.tsx:200` | OK | Vía Supabase |
| PKCE / `state` | ✅ Sí | `src/lib/supabase/browser.ts:10` | OK | `flowType:"pkce"` |
| `redirect_uri` validado (open-redirect) | ⚠️ Server OK, cliente no | `callback/route.ts:25` vs `page.tsx:155` | 🟡 Media | Server prefija `${origin}`; cliente `window.location.href=next` sin validar |
| **MFA/2FA** implementado (TOTP/WebAuthn) | ✅ Sí | `mfa/route.ts`, `webauthn/*` | OK | TOTP + WebAuthn (Face ID) disponibles |
| MFA forzado en ops sensibles | ❌ No | `src/proxy.ts:120-178` | 🟡 Media | Step-up solo en dispositivo nuevo; no por-operación |
| **Step-up** exige 2º factor | ❌ No | `device/verify/route.ts:72-83` | 🟡 Media | `trusted:true` solo con sesión password; botón "Omitir" |
| WebAuthn lookup con scope de usuario | ⚠️ Implícito vía RLS | `webauthn/auth-options/route.ts:22` | 🔵 Baja | Sin `.eq('user_id')` explícito; **RLS lo salva** (069:28); `requireUserVerification:false` |
| Backup codes reutilizables | N/A | — | OK | TOTP delegado a Supabase |
| SAML / SSO empresarial | ✅ N/A | — | OK | No implementado (no requerido) |

# ÁREA 14 — Análisis de Código IA (checklist de patrones)

| Patrón típico de código IA | ¿Presente? | Evidencia |
|---|---|---|
| SQL por concatenación de strings | ❌ Ausente | Supabase builder + `.rpc()` parametrizado |
| `innerHTML`/`dangerouslySetInnerHTML` con datos | ⚠️ 1 caso | `ChatMessage.tsx:114` (CSP-mitigado) |
| Tokens en localStorage | ⚠️ Solo lectura legacy | `offline/snapshot.ts:188` (sesión real en cookie) |
| Validación solo en frontend | ❌ Ausente | Zod server-side en todas las routes |
| Secretos hardcodeados | ❌ Ausente | Todo vía `process.env`; anon key (pública) es la única literal |
| RLS deshabilitada | ❌ Ausente | 0 `DISABLE` en 130 migraciones |
| Security headers faltantes | ❌ Ausente | `headers.ts` completo |
| CSRF sin protección | ❌ Ausente | Token timing-safe + `CsrfBridge` |
| Cripto débil (MD5/SHA1 password, AES-ECB, IV estático) | ❌ Ausente (para seguridad) | AES-256-GCM + IV random; SHA1 solo dedup de noticias |
| Rate limiting faltante | ❌ Ausente | Multinivel en `proxy.ts` |
| Audit logging faltante | ⚠️ Parcial | Datos sí; **auth events no** (Área 9) |
| Ownership validation faltante (IDOR) | ❌ Ausente | RLS + checks de ruta |

> **Lectura:** AlphaLog **evita** la mayoría de los antipatrones clásicos de código generado por IA. Los residuos (XSS en ChatMessage, auth events sin audit, SSRF en un endpoint) son excepciones puntuales, no patrones sistémicos.

# ÁREA 15 — Escalabilidad de Seguridad (testing, IR, compliance)

| Sub-área / Pregunta | Veredicto | Evidencia | Sev | Nota |
|---|---|---|---|---|
| Tests de seguridad (unit) | ✅ Buenos | `src/lib/security/__tests__/*` | OK | encryption, timing, auditLog, headers, aiRateLimit, exportHardening, integrity |
| Test cross-user (IDOR end-to-end User A↔B) | ⚠️ Falta E2E | unit `route.test.ts:104` (404 otro user) | 🔵 Baja | Ownership solo a nivel unit/RLS, sin escenario 2-usuarios E2E |
| Tests E2E auth/guards | ✅ Sí | `tests/e2e/auth.spec.ts`, `api-auth-guard.spec.ts` | OK | 401 en 6 endpoints |
| **SAST / DAST / SCA en CI** | ❌ No | `.github/workflows/*` (7 files) | 🟡 Media | Solo lint+build; sin CodeQL/Semgrep/Snyk/`npm audit` |
| Script RLS audit en CI | ⚠️ Manual | `scripts/security/check-rls-coverage.js` | 🔵 Baja | No cableado a workflow |
| **Incident response** automatizado | ✅ Sí | `src/lib/security/incidentResponse.ts` | OK | signOut global / lockdown / push (3 threat types), testeado |
| Runbook / `SECURITY.md` | ❌ No | raíz | 🔵 Baja | Sin runbook escrito (aceptable single-user) |
| **Compliance** — PCI | ✅ N/A | grep (sin datos de tarjeta) | OK | No PAN/CVV/pagos |
| GDPR / PII | ⚠️ Mínima | email (Supabase), IP `/16`, UA hash | 🔵 Baja | PII limitada; notes cifradas; soft-delete complica right-to-erasure (moot single-user) |
| SOC2 / HIPAA / ISO 27001 | ✅ N/A | — | OK | Sin datos de salud / multi-tenant SaaS |

---

## Recomendaciones priorizadas (sin código — backlog sugerido)

**Ahora (Alta/Media de mayor impacto, esfuerzo bajo):**
1. **SSRF** (`reports/generate:219`): cambiar `request.headers.get('origin')` por `process.env.NEXT_PUBLIC_APP_URL`. *(esfuerzo: trivial)*
2. **`bot_monitor_state`**: añadir `TO service_role` o eliminar la policy. *(migración corta)*
3. **Open-redirect** (`auth/page.tsx:155`): validar `next` (interno, sin `//`). *(trivial)*
4. **Step-up real**: que `device/verify` exija TOTP/WebAuthn verificado antes de `trusted:true`. *(medio)*
5. **Supply chain**: `npm audit fix` (form-data, sentry no-breaking) + añadir step `npm audit --audit-level=high` a `quality-gate.yml` + `.github/dependabot.yml`. *(bajo)*

**Pronto (Media):**
6. **XSS ChatMessage**: DOMPurify o `react-markdown`. *(bajo)*
7. **Password policy**: subir a ≥12, validar server-side, lista de comunes (Supabase password strength / HIBP). *(bajo-medio)*
8. **Audit de auth events**: instrumentar `logAuditEvent` en login/logout/stepup/device-trust/MFA. *(medio)*
9. **Migrar `next-pwa`** a Serwist/`@ducanh2912/next-pwa` (corta la cadena RCE). *(medio)*

**Hardening (Baja):**
10. `.eq('user_id', user.id)` explícito en rutas WebAuthn + `requireUserVerification:true`; aplicar `BLOCKED_EXTENSIONS` y validar `mimeType`/`sizeBytes` en `attachments`; timeouts en `news/ingest` y QStash; `app_logs` append-only; incluir `changes`/`status` en el hash-chain; ampliar `security_rls_audit()` a todas las tablas; verificar existencia + RLS del bucket `secure-mail`; validar presencia de `INTERNAL_API_SECRET`/`SECURITY_ALERT_USER_ID` en boot; test E2E cross-user (IDOR); `SECURITY.md` + runbook.

---

## Verificación de esta auditoría

- **15/15 áreas** cubiertas con veredicto en cada sub-área.
- Hallazgos Alto/Medio **confirmados abriendo el archivo** (no solo por agente): SSRF, step-up, open-redirect, `bot_monitor_state`, XSS, WebAuthn (RLS lo salva), attachments (storage-RLS mitiga), `npm audit` (18 vulns) ejecutado en local.
- Severidades ajustadas al contexto **single-user**; se anota "(multi-user: Alta)" donde el riesgo escalaría.
- Reproducir `npm audit`: `npm audit --audit-level=high` en la raíz del repo.

*Auditoría defensiva generada con Claude Code — read-only, sin modificación de código ni datos.*
