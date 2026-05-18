# CLAUDE.md — AlphaLog PWA

> Referencia técnica completa para sesiones de Claude. Leer esto antes de tocar cualquier archivo.

---

## 1. Qué es y para quién

**AlphaLog** es una Progressive Web App (PWA) de gestión de trading para un trader individual/prop trader. Centraliza en una sola plataforma:

- Registro y análisis de operaciones (trades) con múltiples cuentas
- Gestión de finanzas del negocio (treasury, P&L, runway, LLC)
- Control remoto del bot de trading MT5 (GoldRangeBasketR EA)
- Diario de trading personal
- Suite de inteligencia (capital targets, niveles, news, eventos)
- Playbook de setups, evidencias, reportes semanales
- TraderMap: gamificación con XP, niveles, metas trimestrales
- Inbox seguro con cifrado PGP (correo end-to-end)

**Audiencia**: un solo usuario (el dueño), aunque la arquitectura soporta multi-usuario completo via RLS.

**Producción**: https://www.alphalog.io / https://alphalog.io

---

## 2. Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 16.1.1 (App Router, React 19.2.3) |
| Lenguaje | TypeScript 5 |
| Estilos | Tailwind CSS 4 (PostCSS plugin) |
| Base de datos | Supabase (PostgreSQL 17.6, us-east-2) |
| Auth | Supabase Auth (Google OAuth + email/password) |
| ORM | @supabase/ssr 0.8, @supabase/supabase-js 2.90 |
| Validación | Zod 4.3.6 |
| PWA | next-pwa 5.6.0 (Workbox, service worker) |
| Notificaciones push | web-push 3.6.7 (VAPID) |
| Toasts | Sonner 2.0.7 |
| Iconos | Lucide React 0.562 |
| Email | Postmark 4.0.5 (inbound + outbound) |
| Cifrado PGP | OpenPGP.js 6.3.0 |
| PDF | @react-pdf/renderer 3.4.5 |
| IndexedDB | idb 8.0.3 |
| Testing unit | Vitest 4.1.0 + @vitest/coverage-v8 |
| Testing E2E | Playwright 1.57 |
| Deploy | Vercel (Node 24.x, region iad1) |
| CI/CD | GitHub Actions (quality-gate, bot-maintenance) |
| React Compiler | babel-plugin-react-compiler 1.0.0 |

**Cifrado de datos sensibles**: AES-256-GCM en servidor, prefijo `enc:v1:`, clave en `DATA_ENCRYPTION_KEY` (base64, 32 bytes). Afecta: `trades.notes`, `journal_entries.content/title`, mensajes del inbox.

---

## 3. Estructura de carpetas

```
alphalog-pwa/
├── middleware.ts              # Auth guard, CSRF, redirect canónico, latency tracking
├── next.config.ts             # PWA config, redirects, security headers
├── vitest.config.ts           # Unit test config
├── supabase/
│   └── migrations/            # 41 archivos SQL (001→041)
├── bots/
│   └── GoldRangeBasketR/      # Git submodule: EA de MT5 (MQL5)
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── layout.tsx         # Root layout: fonts, Toaster, GlobalBackButton, CsrfBridge
│   │   ├── page.tsx           # Landing/redirect
│   │   ├── api/               # 85 route handlers
│   │   ├── auth/              # Login, signup, reset, stepup, callback
│   │   ├── dashboard/         # Dashboard principal (server component con métricas)
│   │   ├── trading/           # Hub de trading (layout con MainNav)
│   │   ├── business/          # Hub de negocio
│   │   ├── intelligence/      # Suite de inteligencia de capital
│   │   ├── inbox/             # Secure Mail inbox
│   │   ├── health/            # Página pública de health
│   │   └── offline/           # Fallback PWA offline
│   ├── components/            # Componentes React
│   │   ├── business/          # panels/ + forms/ del hub de negocio
│   │   ├── bot-control/       # BotControlSelector, BotControlWorkspace
│   │   ├── dashboard/         # DashboardPerformancePanel
│   │   ├── intelligence/      # CapitalTargetPlanner
│   │   ├── journal/           # JournalEntryForm, JournalEntryList, JournalPTWorkspace
│   │   ├── logs/              # LogsScreen, LogEditor, FiltersBar, SystemDiagnostics
│   │   ├── navigation/        # MainNav, HubTabs, GlobalBackButton, MobileModuleTabSelect
│   │   ├── push/              # PushNotificationButton
│   │   ├── pwa/               # UpdateManager
│   │   ├── secureMail/        # InboxList, KeySetup, AllowedSenders, ContactsKeys
│   │   ├── security/          # CsrfBridge
│   │   ├── terminal/          # NewsPanel, CalendarPanel, EvidenceReports, TerminalReportsBot
│   │   ├── tradehub/          # AccountsPanel, NewTradesLog, EvidenceVault, Playbook, Reports
│   │   │   └── aab/           # Accounts Architect Bot UI
│   │   ├── tradermap/         # Componentes de gamificación
│   │   ├── treasury/          # panels/ + calendar/
│   │   └── ui/                # Primitivos (Card, etc.)
│   ├── lib/                   # Lógica de negocio y utilidades
│   │   ├── alphacore/         # Offline-first mutations, dedup, outbox
│   │   ├── alphashield/       # Logger client-side (fingerprint, queue, sanitize)
│   │   ├── api/               # Helpers de API
│   │   ├── business/          # Queries y tipos del hub de negocio
│   │   ├── capital-algorithm/ # Algoritmo de distribución de capital
│   │   ├── copygroups/        # Lógica de copy trading (mirroring de trades)
│   │   ├── crypto/            # Utilidades PGP
│   │   ├── dashboard/         # queries.ts: getPerformanceMetrics, getAccountGroups
│   │   ├── evidence/          # Gestión de evidencias
│   │   ├── intelligence/      # Capital targets, constraint solver
│   │   ├── logging/           # Structured logging server-side
│   │   ├── metrics/           # pnl.ts, tradeUpdates.ts
│   │   ├── offline/           # Offline bridge (IndexedDB outbox)
│   │   ├── progress-map/      # TraderMap state machine
│   │   ├── push/              # VAPID push utilities
│   │   ├── reports/           # Report generation
│   │   ├── runtime/           # featureFlags.ts
│   │   ├── security/          # encryption.ts, auditLog.ts, timing.ts, headers.ts, bugRecorder.ts
│   │   ├── supabase/          # server.ts, browser.ts (clientes Supabase)
│   │   ├── terminal-ia/       # AI report generation
│   │   ├── trade/             # normalize.ts
│   │   ├── tradermap/         # xpConfig.ts, progressEngine.ts
│   │   ├── treasury/          # Payout engine, calendar
│   │   └── validation/        # schemas.ts (Zod), autoFix.ts, contractGuard.ts, nullGuards.ts
│   ├── hooks/                 # React hooks
│   ├── styles/                # globals.css
│   └── types/                 # TypeScript types globales
└── scripts/                   # Ops scripts (bot monitoring, sprint audit, security checks)
```

---

## 4. Páginas y rutas

### Hub principal
| Ruta | Descripción |
|------|-------------|
| `/` | Landing → redirect a `/auth` si no autenticado |
| `/auth` | Login principal (email/password + Google OAuth) |
| `/auth/signup` | Registro nuevo usuario |
| `/auth/reset` | Reset de contraseña |
| `/auth/set-password` | Establecer contraseña nueva (post-reset) |
| `/auth/stepup` | MFA / step-up authentication |
| `/auth/callback` | OAuth callback de Supabase |
| `/offline` | Fallback PWA cuando no hay red |
| `/health` | Página pública de estado del sistema |

### Dashboard
| Ruta | Descripción |
|------|-------------|
| `/dashboard` | Server component: bienvenida + DashboardPerformancePanel con métricas reales |
| `/dashboard/tradehub` | TradeHub completo (client component con tabs) |
| `/dashboard/tradehub/accounts/aab` | Accounts Architect Bot (feature flag: `NEXT_PUBLIC_ENABLE_AAB`) |
| `/dashboard/tradehub/categories` | Gestión de categorías de cuentas |
| `/dashboard/tradermap` | TraderMap con XP, nivel, metas |
| `/dashboard/tradermap/progress-map` | Mapa de progreso detallado |
| `/dashboard/treasury` | Módulo de treasury |
| `/dashboard/terminal` | Terminal de análisis (news, eventos, evidencias) |
| `/dashboard/bot-control` | Control de bot (redirect a modo) |
| `/dashboard/bot-control/[mode]` | Workspace del bot (modo específico) |
| `/dashboard/business` | Hub de negocio desde dashboard |
| `/dashboard/logs` | Logs operacionales |
| `/dashboard/logs/pwa` | Logs PWA + test push |
| `/dashboard/logs/system` | System logs (feature flag: `NEXT_PUBLIC_ENABLE_SYSTEM_LOGS`) |
| `/dashboard/conflicts` | Resolución de conflictos offline |

### Trading Hub
El hub de trading **vive bajo `/dashboard/tradehub`**, no como ruta separada `/trading/*`. Las rutas listadas previamente eran propuestas que nunca se implementaron.

| Ruta | Descripción |
|------|-------------|
| `/dashboard/tradehub` | TradeHub principal (Accounts + Trades + Evidence + Playbook + Reports) |
| `/dashboard/tradehub/categories` | Gestión de categorías de cuentas |
| `/dashboard/tradehub/accounts/aab` | Accounts Architect Bot (feature flag `NEXT_PUBLIC_ENABLE_AAB`) |

### AlphaLog Securities
| Ruta | Descripción |
|------|-------------|
| `/securities` | Redirige a `/securities/cybersec` |
| `/securities/cybersec` | CyberSec Academy: syllabus de 58 módulos |
| `/securities/cybersec/modules/[id]` | Detalle de módulo con niveles + research + lecciones |
| `/securities/cybersec/lessons/[id]` | Lección extendida |
| `/securities/cybersec/quizzes/[id]` | Quiz por lección |
| `/securities/cybersec/practice/[id]` | Práctica de matching |
| `/securities/cybersec/homework` y `homework/[id]` | Lista + detalle con submit |
| `/securities/cybersec/exam` | Examen final (32 preguntas, pasa con ≥70%) |

### Business Hub
| Ruta | Descripción |
|------|-------------|
| `/business` | Hub de negocio con BusinessTabs |
| `/business/tabs/treasury` | Treasury module |
| `/business/tabs/business` | Business ops module |
| `/business/decisions` | Decisiones de negocio (CRUD con tareas) |
| `/business/health` | Health panel del negocio |
| `/business/journal` | **Diario de trading/negocio (CRUD completo)** |
| `/business/kpis` | KPIs del negocio |
| `/business/llc` | Gestión de LLC (info, inbox items) |
| `/business/pl` | P&L del negocio |
| `/business/roadmap` | Roadmap de producto |
| `/business/runway` | Runway financiero |
| `/business/sops` | SOPs (Standard Operating Procedures) |

### Intelligence
| Ruta | Descripción |
|------|-------------|
| `/intelligence` | Suite de inteligencia |
| `/intelligence/tabs/capital-levels` | Distribución de capital real vs propfirm + top cuentas |
| `/intelligence/tabs/constraint-monitor` | Semáforo de 4 disciplinas (cadencia, win rate, P&L, journaling) |
| `/intelligence/tabs/mindops` | Correlación mood ↔ outcome de journal |
| `/intelligence/tabs/knowledge-factory` | Síntesis IA de insights de los últimos 30 días |
| `/intelligence/calendar` | Calendario económico |
| `/intelligence/evidence` | Evidencias de análisis |
| `/intelligence/news` | Noticias de mercado |
| `/intelligence/overview` | Overview general |
| `/intelligence/search` | Búsqueda de inteligencia |

### Inbox (Secure Mail)
| Ruta | Descripción |
|------|-------------|
| `/inbox` | Lista de mensajes cifrados |
| `/inbox/[id]` | Ver mensaje individual |
| `/inbox/compose` | Redactar mensaje |
| `/inbox/settings` | Config del buzón (claves PGP, senders) |

---

## 5. Componentes principales

### Navegación y Layout
- **`MainNav`** — Nav lateral persistente con links a todos los hubs
- **`HubTabs`** — Tabs de sección dentro de hubs
- **`GlobalBackButton`** — Botón flotante "back" en todas las páginas
- **`MobileModuleTabSelect`** — Selector de tabs en móvil (accesible con aria)
- **`CsrfBridge`** — Inyecta header `x-csrf-token` en todas las mutaciones del cliente
- **`UpdateManager`** — Detecta nueva versión PWA y notifica al usuario

### Dashboard
- **`DashboardPerformancePanel`** — Recibe `PerformanceMetrics` como props (win rate, drawdown, P&L por período, top setup). Server-fetched en el page, prop-drilled.

### TradeHub
- **`AccountsPanel.client`** — CRUD de cuentas, stats por cuenta (win rate, P&L), confirmación de delete con modal, toasts Sonner
- **`NewTradesLog.client`** — Log de trades con form inline, filtros, paginación, exportar CSV
- **`EvidenceVault.client`** — Bóveda de evidencias con upload a Supabase Storage
- **`Playbook.client`** — Playbook de setups (grupos + versiones)
- **`Reports.client`** — Reportes semanales generados con AI
- **`TradeHubOverviewWidget.client`** — Fetcha `/api/dashboard/metrics`, muestra tiles de performance con skeleton
- **`AccountComparisonTable.client`** — Tabla sortable comparando todas las cuentas (balance, win rate, P&L, top setup)

### Business
- **`DecisionsPanel.client`** — CRUD de decisiones con tareas anidadas, confirm-delete modal, toasts
- **`JournalPanel.client`** — CRUD completo de diario: lista expandible, form con mood/score/tags/lecciones/pasos, confirm-delete
- **`HealthPanel.client`** — Panel de salud del negocio
- **`KPIPanel.client`** — KPIs con métricas calculadas
- **`PLPanel.client`** — P&L financiero
- **`RunwayPanel.client`** — Runway (meses de liquidez restantes)
- **`LLCPanel.client`** — Datos de la LLC, inbox de documentos
- **`SOPsPanel.client`** — SOPs con checklist runnable
- **`RoadmapPanel.client`** — Roadmap con milestones

### Terminal
- **`NewsPanel.client`** — Noticias por instrumento con relevancia y impact
- **`CalendarPanel.client`** — Calendario económico de eventos
- **`EvidenceReports.client`** — Reportes de análisis con attachments
- **`TerminalReportsBot.client`** — Generación automática de reportes con AI (QStash)

### Seguridad / Logging
- **`AlphaShield Logger`** — Logger client-side con: queue IndexedDB offline, fingerprint dedup, rate limit 10/min, sanitización de secrets, auto-flush online
- **`logError/logInfo/logWarn`** (`src/lib/log.ts`) — Wrappers que invocan AlphaShield en cliente, console en servidor

---

## 6. Schema de Supabase (69 tablas)

**Convenciones globales**: todas las tablas tienen RLS habilitado. Patrón de política: `auth.uid() = user_id` para SELECT/INSERT/UPDATE/DELETE. Soft-delete: columna `deleted_at timestamptz`, queries siempre con `.is('deleted_at', null)`.

### Grupos de tablas

#### Cuentas y Trades
```
account_categories   id, user_id, name, name_lower, sort_index, description, timestamps, deleted_at
accounts             id, user_id, name, category_id→account_categories, account_size, current_balance,
                     operation_state, phase_status, role, withdrawals_enabled, currency, status, sort_index, timestamps, deleted_at
setups               id, user_id, name, name_lower, description, sort_index, timestamps, deleted_at
trades               id, user_id, account_id→accounts, symbol, direction(BUY/SELL), status(open/closed),
                     entry_date, exit_date, entry_price, exit_price, stop_loss_price, take_profit_price,
                     lots, pnl, pnl_percent, notes(CIFRADO), setup_id→setups, screenshot_path,
                     is_featured_in_report, sort_index, tags[], timestamps, deleted_at
trade_evidence       id, user_id, trade_id→trades, account_id, title, report_text, file_path,
                     mime_type, size_bytes, validation_status, sort_index, timestamps, deleted_at
tv_analysis_evidence id, user_id, image_path, captured_at, user_notes, trade_id, account_id,
                     validation_status, sort_index, timestamps, deleted_at
```

#### Playbook
```
setup_library          id, user_id, name, short_name, description, market_conditions, entry_model,
                       invalidations, timeframes[], tags[], statistics_enabled, timestamps, deleted_at
playbook_setup_groups  id, user_id, name, name_lower, sort_index, timestamps, deleted_at
playbook_setup_versions id, user_id, group_id→playbook_setup_groups, version, description, checklist, created_at
playbook_setup_current  group_id→playbook_setup_groups, current_version_id→playbook_setup_versions, updated_at
weekly_reports          id, user_id, week_start, week_end, version, title, content_md, total_trades,
                        total_pnl, win_rate, sort_index, timestamps, deleted_at
```

#### Diario
```
journal_entries  id, user_id, date, title(CIFRADO), content(CIFRADO JSON), mood, tags[], timestamps, deleted_at
                 content JSON: { text, mood_score, market_conditions, focus_areas, lessons_learned,
                                 action_items, trade_id, is_private }
```

#### TraderMap (gamificación)
```
tradermap_goals          id, user_id, account_id→accounts, year, title, active_quarter, sort_index, timestamps, deleted_at
tradermap_goal_quarters  id, user_id, goal_id→tradermap_goals, quarter, start/end_date, start/target/current_balance, completed_at, timestamps, deleted_at
progress_events          id, user_id, event_type, ref_table, ref_id, xp_delta, metadata jsonb, occurred_at, created_at
user_level_state         user_id PK, level, xp_total, streak_days, last_activity_date, updated_at
goals                    (legacy) id, user_id, account_id, year, active_quarter, Q1-Q4 dates+balances, timestamps, deleted_at
instruments              id, symbol, display_name, sort_index, timestamps
```

#### Terminal (Análisis)
```
terminal_news              id, user_id, instrument_id→instruments, title, url, source, relevancy_score,
                           impact_label, timestamp_utc, sort_index, timestamps, deleted_at
terminal_events            id, user_id, instrument_id→instruments, name, impact, timestamp_utc, timestamps, deleted_at
terminal_evidence_reports  id, user_id, instrument_id→instruments, title, content, sort_index, timestamps, deleted_at
terminal_evidence_attachments id, user_id, report_id→terminal_evidence_reports, path, filename, mime_type, size_bytes, timestamps, deleted_at
terminal_report_jobs       id, user_id, asset, scheduled_for, status, outcome, qstash_schedule_id, error, timestamps
terminal_report_state      id, user_id, asset, last_item_ids jsonb, last_hash, last_report_at, last_checked_at, timestamps
```

#### Treasury
```
treasury_wallets          id, user_id, name, currency, starting_balance, timestamps, deleted_at
treasury_configs          id, user_id, account_id→accounts, wallet_id→treasury_wallets, withdrawal_day,
                          split_mode, balance_threshold, anti_drawdown_active/threshold,
                          tax_buffer_percentage/target/accumulated, milestone_target/bonus_vault,
                          push_withdrawal_day_enabled, timestamps, deleted_at
treasury_transactions     id, user_id, wallet_id, account_id, type, amount, occurred_on, description, notes, timestamps, deleted_at
treasury_budgets          id, user_id, wallet_id, period_start/end, target_income/expense/payout, notes, timestamps, deleted_at
treasury_payouts          id, user_id, account_id, wallet_id, payout_date, amount, status, method, notes,
                          cycle_start/end, calc_cutoff, version, cash_payout/tax_reserve/bonus_vault amounts,
                          blocked_reasons jsonb, timestamps, deleted_at
treasury_calendar_events  id, user_id, account_id, event_date, title, kind, push_enabled, timestamps, deleted_at
```

#### Business
```
business_costs           id, user_id, amount, category, description, vendor, cost_date,
                         is_recurring_instance, template_id, timestamps, deleted_at
business_cost_templates  id, user_id, amount, category, description, vendor, day_of_month, start_month,
                         active, last_generated_month, timestamps, deleted_at
business_milestones      id, user_id, title, description, target_date, status, goal_id, notes, timestamps, deleted_at
business_sops            id, user_id, title, type, content, sort_index, timestamps, deleted_at
business_sop_items       id, sop_id, user_id, label, sort_index, timestamps, deleted_at
business_sop_runs        id, user_id, sop_id, run_date, notes, timestamps, deleted_at
business_sop_run_items   id, user_id, run_id, item_id, checked, checked_at, note, timestamps, deleted_at
business_decisions       id, user_id, title, context, decision, rationale, impact, tags[], priority,
                         sort_index, timestamps, deleted_at
business_decision_tasks  id, user_id, decision_id→business_decisions, title, done, sort_index, timestamps, deleted_at
business_alert_history   id, user_id, alert_type, alert_month, subscriptions_sent, created_at
llc_info                 id, user_id, llc_name, formation_date, annual_report_due_month, annual_fee_baseline,
                         registered_agent_name, ein, notes, last_annual_report_push_year, timestamps, deleted_at
llc_inbox_items          id, user_id, title, received_on, status, notes, attachment_path, timestamps, deleted_at
```

#### Logs y Observabilidad
```
app_logs     id, user_id, level, area, message, meta jsonb, fingerprint, url, user_agent,
             created_at, resolved_at, deleted_at
logs         id, user_id, title, title_lower, notes, type, category_id→categories,
             created_day_utc, sort_index, timestamps, deleted_at
log_tags     log_id→logs, tag_id→tags, user_id, created_at  [tabla puente]
log_attachments id, user_id, log_id→logs, path, filename, mime_type, size_bytes, timestamps, deleted_at
categories   id, user_id, name, name_lower, sort_index, timestamps, deleted_at
tags         id, user_id, name, name_lower, sort_index, timestamps, deleted_at
```

#### Bot Control (MT5 / GoldRangeBasketR)
```
bots                id, user_id, name, timestamps
bot_accounts        id, user_id, bot_id→bots, account_id(MT5), label, app_account_id→accounts, timestamps
bot_instances       id, bot_account_id→bot_accounts, instance_id, instance_secret(cifrado),
                    status, last_heartbeat_at, timestamps
bot_settings_global   id, bot_id, settings jsonb, updated_by, timestamps
bot_settings_override id, bot_account_id, settings jsonb, updated_by, timestamps
bot_commands        id, bot_id, command_type, payload jsonb, target_scope, created_by, status, timestamps
bot_command_status  id, command_id→bot_commands, bot_account_id, status, acked_at, message, timestamps
bot_telemetry       id, bot_account_id, instance_id, equity, balance, positions_total/buy/sell,
                    basket_r, tier, last_signal_text/ts, last_heartbeat_ts, payload jsonb, timestamps
bot_events          id, bot_id, bot_account_id, event_type, payload jsonb, created_at
```

#### Secure Mail (PGP E2E)
```
secure_mailboxes          id, user_id, email_alias, pgp_public_key, pgp_private_key_encrypted(AES),
                          key_kdf jsonb, timestamps, deleted_at
secure_allowed_senders    id, user_id, mailbox_id, sender_email, is_active, timestamps, deleted_at
secure_contacts_keys      id, user_id, contact_email, pgp_public_key, timestamps, deleted_at
secure_messages           id, user_id, mailbox_id, provider_message_id, thread_id, from/to_email,
                          subject_ciphertext(PGP), body_ciphertext(PGP), received_at, direction,
                          status, meta jsonb, timestamps, deleted_at
secure_attachments        id, user_id, message_id, filename_ciphertext, mime_type, size_bytes,
                          storage_path, timestamps, deleted_at
secure_message_access_audit id, user_id, message_id, event, created_at
```

#### Intelligence
```
intelligence_capital_targets   id, user_id, account_type, target_name, target_capital, manual_pct fields,
                                custom_current_capital, capital_account_id→intelligence_capital_accounts, timestamps, deleted_at
intelligence_capital_accounts  id, user_id, account_type, account_name, current_capital, timestamps, deleted_at
live_market_data               id, symbol, bid, ask, last, token_ok, source, raw_payload jsonb, received_at, timestamps
```

#### Auth / Seguridad / Rate Limit
```
app_updates       id, version, build_hash, force_refresh, is_active, created_at, created_by
app_update_events id, update_id, action, metadata jsonb, user_id, created_at
push_subscriptions id, user_id, endpoint, p256dh, auth, user_agent, timestamps
```
_(Las tablas `auth_device_sessions`, `api_rate_limits`, `audit_trail`, `bug_reports`, `bug_triage`, `copy_groups` y `progress_map` también existen; ver migrations 024-030)_

### RLS Pattern
Cada tabla usa `auth.uid() = user_id` para todas las operaciones. Algunos casos especiales:
- `bot_instances`: también usa JOIN a `bot_accounts` → `bots` para verificar ownership
- `playbook_setup_current`: ownership vía `group_id` → `playbook_setup_groups`
- `app_logs`: INSERT permitido para autenticados sin restricción de user_id (logging centralizado)
- Tablas de bot admin: algunas columnas solo modificables con service_role

---

## 7. API Routes (85 endpoints)

### Autenticación
| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `POST /api/auth/logout` | POST | Cierra sesión, limpia cookies |
| `POST /api/auth/refresh` | POST | Renueva sesión Supabase |
| `POST /api/auth/device/verify` | POST | Verifica device trust session |

### Dashboard
| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `GET /api/dashboard/metrics` | GET | Métricas de performance (winRate, drawdown, topSetup, etc.) |

### Cuentas
| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `GET/POST /api/accounts` | GET, POST | Lista/crea cuentas |
| `GET/PUT/DELETE /api/accounts/[id]` | GET, PUT, DELETE | CRUD cuenta individual (soft-delete) |
| `POST /api/accounts/trash/empty` | POST | Hard-delete trash (perm) + audit log |
| `GET/POST /api/account-categories` | GET, POST | CRUD categorías de cuentas |

### Trades
| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `GET/POST /api/tradehub/trades` | GET, POST | Lista (filtros: accountId, setupId, range, status, closedOnly, limit, offset) / crea trade |
| `GET/PUT/DELETE /api/tradehub/trades/[id]` | GET, PUT, DELETE | CRUD trade + soft-delete/restore |
| `POST /api/tradehub/trades/[id]/screenshot` | POST | Upload screenshot a Storage |
| `GET /api/tradehub/trades/export` | GET | Descarga CSV de trades (filtros: accountId, range) |

### Setups, Evidence, Reports
| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `GET/POST /api/tradehub/setups` | GET, POST | CRUD setups |
| `GET/POST /api/tradehub/evidence` | GET, POST | Evidence vault (upload) |
| `GET/PUT/DELETE /api/tradehub/evidence/[id]` | — | CRUD evidencia |
| `GET /api/tradehub/evidence/signed-url` | GET | URL firmada para descarga de Storage |
| `GET/POST /api/tradehub/reports` | GET, POST | Reportes semanales |
| `POST /api/tradehub/reports/generate` | POST | Genera reporte con AI |
| `GET/PUT/DELETE /api/tradehub/reports/[id]` | — | CRUD reporte |

### Journal
| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `GET/POST/DELETE /api/journal` | GET, POST, DELETE | CRUD entradas de diario (content cifrado AES) |

### TraderMap
| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `GET/POST /api/tradermap/goals` | GET, POST | Metas trimestrales |
| `GET /api/tradermap/level` | GET | Nivel y XP del usuario |
| `GET/POST /api/tradermap/progress-map/state` | GET, POST | Estado del mapa de progreso |
| `GET/PUT /api/tradermap/progress-map/config` | GET, PUT | Configuración del mapa |
| `GET /api/tradermap/progress-map/thresholds` | GET | Umbrales de nivel |
| `POST /api/tradermap/progress-map/recompute` | POST | Recomputa progreso |
| `POST /api/tradermap/progress-map/pending-sync/resolve` | POST | Resuelve sync pendiente offline |
| `GET/PUT /api/tradermap/quarters/[id]` | GET, PUT | CRUD quarter específico |

### Treasury
| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `GET/POST /api/treasury/calendar-events` | GET, POST | Eventos del calendario |
| `GET/PUT/DELETE /api/treasury/calendar-events/[id]` | — | CRUD evento |
| `POST /api/treasury/payouts/preview` | POST | Preview de payout calculado |
| `POST /api/treasury/payouts/create` | POST | Crea payout registrado |
| `GET /api/treasury/payouts/status` | GET | Estado de payouts recientes |
| `GET /api/treasury/export` | GET | Export CSV de transacciones |

### Terminal
| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `GET/POST /api/terminal/news` | GET, POST | CRUD noticias por instrumento |
| `GET/PUT/DELETE /api/terminal/news/[id]` | — | CRUD noticia |
| `GET/POST /api/terminal/events` | GET, POST | Eventos económicos |
| `GET/PUT/DELETE /api/terminal/events/[id]` | — | CRUD evento |
| `GET/POST /api/terminal/evidence` | GET, POST | Reportes de análisis |
| `GET/PUT/DELETE /api/terminal/evidence/[id]` | — | CRUD reporte |
| `POST /api/terminal/evidence/[id]/attachments` | POST | Attachments a reporte |
| `POST /api/terminal/evidence/generate` | POST | Genera análisis con AI (OpenAI) |
| `GET /api/terminal/instruments` | GET | Lista instrumentos |
| `GET/POST /api/terminal/reports/schedule` | GET, POST | Agenda report job (QStash) |
| `POST /api/terminal/reports/generate` | POST | Genera reporte scheduled |
| `POST /api/terminal/reports/run-scheduled` | POST | Ejecuta report job programado |
| `POST /api/terminal/reports/refresh` | POST | Refresca último reporte |

### Intelligence
| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `GET/POST /api/intelligence/capital-targets` | GET, POST | Capital targets |
| `GET/PUT/DELETE /api/intelligence/capital-targets/[id]` | — | CRUD capital target |
| `POST /api/intelligence/capital-targets/[id]/manual-simulation` | POST | Simulación manual de retorno |
| `GET/POST /api/intelligence/capital-accounts` | GET, POST | Capital accounts |
| `GET/PUT/DELETE /api/intelligence/capital-accounts/[id]` | — | CRUD capital account |

### Algorithms (canonical strategy registry — incluye coinarb desde Fase A)
| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `GET/POST /api/algorithms` | GET, POST | Lista/crea algoritmos (MT5 / CME / crypto) |
| `GET/PUT/DELETE /api/algorithms/[id]` | — | CRUD. PUT con `parameters` dispara `bot_commands.update_parameters` |
| `GET /api/algorithms/[id]/connections` | GET | Estado de pairing MT5/CME/options (no crypto) |
| `POST /api/algorithms/[id]/control` | POST | `{action:'pause'\|'resume'}` → `bot_commands` |
| `GET /api/algorithms/[id]/telemetry` | GET | Snapshot live `coinarb_telemetry` (solo crypto) |
| `POST /api/algorithms/[id]/deploy` | POST | Crea `algorithm_deployments` (algo → bot_account) |
| `POST /api/algorithms/[id]/approve` | POST | Lifecycle status transition |
| `POST /api/algorithms/[id]/promote-to-live` | POST | paper → live |
| `POST /api/algorithms/[id]/pairing-token` | POST | Genera token para MT5/MT4 |
| `GET/POST /api/algorithms/[id]/backtest` | — | Single-shot backtest |
| `POST /api/algorithms/[id]/engine-backtest` | POST | Engine v1 multi-symbol backtest |
| `GET/POST /api/algorithms/[id]/quality-gates` | — | Quality gates tier-1 |
| `GET/POST /api/algorithms/[id]/signal` | — | Manual signal trigger |

### Logs
| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `GET/POST /api/logs` | GET, POST | Logs operacionales (AlphaLog) |
| `POST /api/logs/ingest` | POST | Ingesta de logs del cliente (AlphaShield) |
| `DELETE /api/logs/cleanup` | DELETE | Limpia logs viejos |

### Secure Mail
| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `GET/POST /api/secure-mail/messages` | GET, POST | Lista/envía mensajes PGP |
| `GET/PUT/DELETE /api/secure-mail/messages/[id]` | — | CRUD mensaje |
| `POST /api/inbound/email` | POST | Webhook inbound de Postmark |
| `POST /api/outbound/email/send` | POST | Envía email via Postmark |

### Bot Control
| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `GET/POST /api/copy-groups` | GET, POST | CopyGroups (agrupaciones de cuentas) |
| `GET/POST /api/copy-groups/[id]/nodes` | GET, POST | Nodos del copy group |
| `GET/POST /api/copy-groups/[id]/links` | GET, POST | Links entre nodos |
| `GET/POST /api/copy-groups/[id]/experiments` | GET, POST | Experimentos |
| `GET /api/copy-groups/[id]/graph` | GET | Grafo del copy group |
| `POST /api/copy-groups/[id]/rollback` | POST | Rollback de copy group |

### Ops / Cron

**Naming convention** (no migrar — la inconsistencia es semántica):
- `/api/ops/cron/*` — crons que monitorean **bots** (heartbeat, SLO, recovery, daily verify). Auth: `Authorization: Bearer ${OPS_CRON_SECRET}`.
- `/api/cron/*` — crons de **dominio de negocio** (business alerts, treasury reminders, terminal fetchers). Auth: `x-cron-secret` header con `CRON_SECRET`.
- Vercel schedule en `vercel.json`.

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `GET/POST /api/ops/bot-daily-report` | GET, POST | Reporte diario del bot |
| `GET /api/ops/bot-daily-report/history` | GET | Histórico de reportes |
| `POST /api/ops/bot-slo-alert` | POST | Alerta SLO (autenticado por token) |
| `POST /api/ops/cron/bot-slo-monitor` | POST | Monitor SLO programado |
| `POST /api/ops/cron/bot-auto-recovery` | POST | Auto-recuperación del bot |
| `POST /api/ops/cron/bot-daily-verify` | POST | Verificación diaria del bot |
| `POST /api/ops/cron/polyarb-heartbeat` | POST | Polyarb heartbeat stale → push |
| `POST /api/ops/cron/coinarb-heartbeat` | POST | Coinarb heartbeat stale → push (dedup 30min vía app_logs.fingerprint) |
| `POST /api/cron/business/alerts` | POST | Alertas de negocio (recurring costs, LLC) |
| `POST /api/cron/business/recurring-costs` | POST | Genera costos recurrentes del mes |
| `POST /api/cron/treasury/withdrawal-reminders` | POST | Recordatorios de retiro push |

### Push Notifications
| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `POST /api/push/subscribe` | POST | Registra suscripción VAPID |
| `GET /api/push/subscriptions` | GET | Lista suscripciones del usuario |
| `POST /api/push/notify-user` | POST | Envía push notification (interno, con token) |
| `POST /api/push/test` | POST | Test de push |

### Otros
| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `GET /api/health` | GET | Health check: Supabase, bot runtime, app_logs, env vars |
| `POST /api/webhooks/mt5` | POST | Webhook MT5 (autenticado por `MT5_WEBHOOK_SECRET`) |
| `POST /api/alphashield/audit` | POST | Escribe entrada en audit trail |
| `GET/POST /api/tags` | GET, POST | CRUD tags |
| `GET/POST /api/categories` | GET, POST | CRUD categories |
| `POST /api/attachments` | POST | Upload de attachments |
| `POST /api/pwa/clear-force-refresh` | POST | Limpia flag de force refresh |

---

## 8. Sistema de autenticación

### Flujo principal
1. **Middleware** (`middleware.ts`) intercepta todas las rutas. Usa `src/proxy.ts` para verificar sesión Supabase via cookies.
2. Rutas `/dashboard/**` y la mayoría de `/api/**` requieren sesión. Sin sesión → redirect a `/auth`.
3. Rutas públicas: `/api/health`, `/api/webhooks/mt5`, `/api/inbound/email`, `/api/cron/**`, `/api/auth/**`, `/api/push/notify-user`, `/api/outbound/email/send`, `/api/treasury/export`, `/api/treasury/calendar-events`.

### Proveedores
- **Google OAuth** (Supabase Auth) — proveedor principal
- **Email/password** — alternativa
- **Step-up auth** (`/auth/stepup`) — para acciones críticas

### CSRF Protection
- Middleware genera cookie `al_csrf` (UUID, httpOnly:false, sameSite:lax) en el primer request.
- `CsrfBridge.client.tsx` inyecta header `x-csrf-token` en todas las requests del cliente.
- Middleware verifica `csrfHeader === csrfCookie` en mutaciones POST/PUT/PATCH/DELETE no públicas.

### Clientes Supabase
- **`createClient()`** (`src/lib/supabase/server.ts`) — Server Components y Route Handlers con cookies (anon key)
- **`createServiceClient()`** — Server-side con `SUPABASE_SERVICE_ROLE_KEY` para operaciones admin
- **`createClient()`** (`src/lib/supabase/browser.ts`) — Client Components (anon key)

### Device Sessions
Tabla `auth_device_sessions` (migration 026) permite recordar dispositivos de confianza. Endpoint `/api/auth/device/verify`.

---

## 9. Variables de entorno

### Requeridas (app no funciona sin estas)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://jgkvnnlodwdtjsmmzwry.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...      # Para health check, bot ops, cron
DATA_ENCRYPTION_KEY=<base64-32bytes>  # AES-256-GCM para notes/journal/mail
```

### Push Notifications
```bash
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:...
```

### Email (Postmark)
```bash
POSTMARK_SERVER_TOKEN=
POSTMARK_INBOUND_WEBHOOK_SECRET=
SECURE_MAIL_DOMAIN=alphalog.io
NEXT_PUBLIC_SECURE_MAIL_DOMAIN=alphalog.io
SECURE_MAIL_MAX_EMAIL_ATTACHMENT_BYTES=10485760
NEXT_PUBLIC_SECURE_MAIL_MAX_EMAIL_ATTACHMENT_BYTES=10485760
```

### Bot / MT5
```bash
MT5_WEBHOOK_SECRET=         # HMAC para webhooks del EA
OPS_ALERT_TOKEN=            # Token para /api/ops/bot-slo-alert
BOT_OPS_USER_ID=            # user_id del dueño para eventos de bot
SUPABASE_FUNCTIONS_BASE_URL= # URL de Supabase Edge Functions (bot-maintenance)
BOT_HEARTBEAT_STALE_SECONDS=120  # Threshold para heartbeat stale
ALPHALOG_PUSH_NOTIFY_URL=
ALPHALOG_PUSH_NOTIFY_TOKEN=
```

### Cron / QStash
```bash
CRON_SECRET=                # Token para endpoints /api/cron/**
QSTASH_TOKEN=
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=
QSTASH_BASE_URL=
```

### AI / OpenAI
```bash
OPENAI_API_KEY=             # Para terminal/evidence/generate y reports
```

### Observability (Sentry)
```bash
# Runtime DSNs. Vacíos = SDK no-op (sin errores, sin events).
SENTRY_DSN=                            # Server-side init (Node + edge)
NEXT_PUBLIC_SENTRY_DSN=                # Browser init

# Build-time (Vercel CI). Opcionales — sin estos el build pasa pero no
# se suben source maps a Sentry (los stack traces salen minificados).
SENTRY_ORG=
SENTRY_PROJECT=
SENTRY_AUTH_TOKEN=
```
Init en `sentry.client.config.ts` / `sentry.server.config.ts` / `sentry.edge.config.ts` con `tracesSampleRate=0.05–0.10`. Tunnel route `/monitoring` configurado en `next.config.ts` para bypass de ad-blockers en errores del browser. `src/lib/sentry.ts` exporta `captureException`+`captureMessage` con la API del stub histórico (compat con `src/lib/copygroups/mirroring.ts`).

### Config y Feature Flags
```bash
NEXT_PUBLIC_APP_URL=https://alphalog.io
NEXT_PUBLIC_CANONICAL_HOST=alphalog.io
ALPHALOG_WEB_URL=https://alphalog.io
NEXT_PUBLIC_ENABLE_SYSTEM_LOGS=false
NEXT_PUBLIC_ENABLE_AAB=true
RUNWAY_THRESHOLD_MONTHS=3
RATE_LIMIT_WINDOW_SECONDS=60
RATE_LIMIT_MAX=120
NODE_ENV=production

# Tradovate dispatcher cron (Sprint A). 'shadow' (default) loggea decisiones
# en cme_signals (status='skipped', reject_reason='shadow_mode') pero NO
# coloca órdenes reales en Tradovate. Flippear a 'live' SOLO después de
# validar shadow logs. Cualquier valor que no sea 'live' (incluyendo typos
# y string vacío) se interpreta como shadow — defensa contra accidentes.
DISPATCH_MODE=shadow

# OANDA v20 fetcher (forex + metales spot). Opcional — sin token el bars-loader
# cae al siguiente source de la cadena (Yahoo). Sacá un token gratuito en
# https://www.oanda.com (cuenta practice = gratis, sin depósito).
OANDA_API_TOKEN=                # bearer token de v20 account
OANDA_ENV=practice              # 'practice' (default) | 'live'

# CME daily settlement cron — opt-in. Cuando true, baja el settle del día
# anterior para ES/NQ/YM/RTY/GC/SI/CL/NG todos los días hábiles a las 23:00 UTC.
# El endpoint público de CME no tiene SLA — habilitar solo después de probar
# manualmente que el parser sigue matcheando.
CME_AUTO_FETCH_ENABLED=false
```

### Testing
```bash
E2E_EMAIL=test@alphalog.local
E2E_PASSWORD=Test@123456
PLAYWRIGHT_BASE_URL=http://localhost:3000
```

---

## 10. Estado actual

### ✅ Completado y en producción (https://www.alphalog.io)

**Security (Sprint anterior)**
- CSRF protection con cookie `al_csrf` + header verification
- CORS hardening en todos los endpoints
- Rate limiting global
- AES-256-GCM en campos sensibles (notes, journal, secure mail)
- timingSafeEqual en HMAC comparisons
- Audit trail completo (`logAuditFromRequest`)
- Bug recorder automático (`recordBugFromRequest`)
- Zod validation en todos los endpoints + autoFix + contractGuard
- Security headers: CSP, HSTS, X-Frame-Options, etc.

**Performance**
- 10 índices compuestos en tablas críticas (migration 041)
- Batch tag queries (elimina N+1)
- Paginación en evidencias y trades
- Cache-Control headers en GETs (private, max-age=30-60, SWR)
- Promise.all en health endpoint y dashboard queries
- Latency tracking en middleware (warn >2000ms, header `x-response-time`)

**Observability**
- AlphaShield: logger client-side con queue IndexedDB, fingerprint dedup, sanitización
- Error boundaries en: dashboard, terminal, tradehub, tradermap, bot-control, business/journal
- `logError/logInfo/logWarn` en todos los error paths
- `logAuditFromRequest` en hard-delete, create trade, create journal, etc.
- Health endpoint con 6 checks paralelos
- `app_logs` table + `/api/logs/ingest` pipeline

**UX**
- Toasts Sonner en todas las mutaciones (éxito y error)
- Modales de confirmación nativos (sin browser confirm/prompt)
- ARIA: role="dialog", aria-modal, aria-label, aria-expanded
- Loading skeletons en AccountComparisonTable, TradeHubOverviewWidget

**Testing**
- Vitest: 562 unit tests across 47 files (encryption, timingSafeEqual, xpConfig, bot/* signal-engine + arbitrage + regime + skills, cme/* market-hours + tradovate + vault + risk-manager + order-executor, quality-gates, alphashield, treasury, backtest, map-hot)
- Coinarb subproject: 61 tests across 7 files (config, command-poller, feeds-watchdog, backtest-scoring, config-pause, circuit-breaker, daily-tracker)
- Total combinado: 623 tests verde
- Playwright E2E: auth, smoke, navigation, mobile-layout-fit, api-health

**Features**
- DashboardPerformancePanel: métricas reales (winRate, drawdown, topSetup, P&L períodos)
- CSV export de trades (`/api/tradehub/trades/export`)
- TradeHub Overview: widget de métricas + tabla comparativa de cuentas
- AccountComparisonTable: sortable por balance, win rate, P&L, top setup
- JournalPanel: CRUD completo con mood/score/tags/lessons/action items
- DELETE /api/journal: soft-delete con audit

### ⚠️ Parcialmente implementado / TODOs conocidos

<!-- (resolved sprint 11) Copy Groups: UI dedicada (sprint 3) + dashboard quick-link tile (sprint 5) + entrada en Sidebar lateral bajo "Intelligence Suite" (sprint 11). Operations bajo "Business" también añadido. -->

### 🔴 Pendiente / No implementado
- Suscripción multi-usuario real (actualmente 1 usuario).
<!-- (resolved sprint 6) Coinarb segunda capa cubierta: analysis/ (smc-detector, mtf-analyzer, liquidity-map, candle-builder), validators/ (volume-delta, volume-profile, fear-greed, liquidation-heatmap) y risk/phase-manager.ts ahora tienen 79 tests en coinarb/tests/. -->
- Variables Sentry pendientes en Vercel: el SDK está instalado y configurado, falta setear `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` para activar reporting. Sin DSN el wrapper hace no-op silencioso.
- AAB drag/drop nodos: 20% madurez en `AabTreeView.client.tsx`. Bloqueado por spec UX.
- TerminalReportsBot QStash scheduling: mencionado pero no implementado. Decidir entre construir o eliminar la mención.
- alphacore-offline E2E: falta spec que pruebe mutation offline → reconciliación online (requiere setup complejo de IndexedDB mock).
- console.log → logError: ~185 archivos restantes (cleanup gradual). Endpoints principales ya migrados (journal, accounts, tradehub/trades).

### ✅ Reciente (verificado y funcional — no es debt, solo tracking):
- `src/lib/alphacore/conflict-resolution.ts:434–489` `rollbackToSnapshot()` implementado y testeable.
- `src/lib/alphacore/offline/outbox.ts:189–228` outbox sync implementado (POST/PATCH/DELETE vía `buildEndpoint`+`buildMethod`).
- P&L periódico (daily/weekly/monthly) en `getPerformanceMetrics` calcula vía `pnlForPeriod()` + `startOfUtcDay/Week/Month` helpers.
- **Intelligence tabs completos** (2026-05): capital-levels, constraint-monitor (rename de ConstraintSolver), mindops, knowledge-factory. Backend en `src/lib/intelligence/metrics.ts` + UI en `src/components/intelligence/*Panel.client.tsx`.
- **AlphaLog Securities + CyberSec Academy** (2026-05): app top-level con 58 módulos, 12 lecciones, quizzes, prácticas, homework y exam, 4 tablas Supabase (`securities_progress`, `securities_quiz_results`, `securities_homework_submissions`, `securities_exam_results`).
- **Error boundaries cubiertos** (2026-05): `error.tsx` en `/intelligence`, `/map-hot`, `/securities`, `/inbox`, `/auth`, `/dashboard` + 6 sub-segmentos. Helper compartido `src/components/ui/error-boundary-page.tsx`.
- **UI Foundation reusable** (2026-05): `ConfirmDialog`, `Skeleton`, `EmptyState` y `Modal` exportados desde `@/components/ui`. Migrados los 8 paneles Business y EventModal de Treasury para eliminar `alert()`/`confirm()`/`prompt()` del browser → Sonner toasts + ConfirmDialog.
- **Treasury threshold editor** (2026-05): Umbral + Anti-DD ahora editables inline con `PUT /api/treasury/configs` (antes solo lectura).
- **Sentry instalado** (2026-05): `@sentry/nextjs` configurado vía `sentry.{client,server,edge}.config.ts` + `instrumentation.ts` + `withSentryConfig` en `next.config.ts`. `src/lib/sentry.ts` ahora es wrapper real (no stub). `logError` server-side delega automáticamente. Activación pendiente solo de env vars en Vercel.
- **ControlButton ack verification** (2026-05): `/api/algorithms/[id]/commands/recent` retorna lifecycle status. ControlButton polea cada 5s hasta DONE/FAILED o 60s timeout, muestra estado real ACK→DONE/FAILED en lugar de toast optimista.
- **UI Foundation + Testing** (2026-05): 13 unit tests UI con `@testing-library/react` + jsdom + polyfill `<dialog>`. Cubre `ConfirmDialog`, `Skeleton`, `EmptyState`, `ErrorBoundaryPage`. `npm run analyze` con `@next/bundle-analyzer` para inspeccionar chunks.
- **EvidenceVault filtros** (2026-05): búsqueda full-text + filtro por tipo (image/pdf/other) + filtro por status. Contador X/N.
- **SEO base mínimo** (2026-05): metadata en layouts de `/auth`, `/business`, `/intelligence`, `/securities`, `/health`, `/dashboard`. `src/app/robots.ts` y `src/app/sitemap.ts` con allow solo en rutas públicas.
- **E2E coverage** (2026-05): 20 specs totales. Nuevos: `inbox.spec.ts` (4), `polyarb.spec.ts` (3), `securities.spec.ts` (7), `intelligence.spec.ts` (ampliado con mindops + knowledge-factory).
- **CRLF normalizado** (2026-05): `git config core.autocrlf input` aplicado. Repo trabaja con LF nativo.
- **Sprint 3 + 4: cobertura de tests críticos** (2026-05-03/04): saltó de 376 → 623 tests (+247).
  - `src/lib/bot/__tests__/` — signal-engine (quantum-math, position-sizer, session-guard), regime/hmm-engine, arbitrage (latency-detector, pulse-validator, pair-monitor, risk-guard), skills/skill-manager. ~80% del Tier-1 cubierto.
  - `src/lib/cme/__tests__/` — market-hours, tradovate (fetch mocks), vault (RPC mocks), risk-manager (chain mocks), order-executor (vault+tradovate+DB orchestration). ~95% del módulo cubierto.
  - `coinarb/tests/` — circuit-breaker (12) y daily-tracker (14) sumados a los 35 ya existentes.
  - UI: `/dashboard/copy-groups` lista + detalle creados (sprint 3) — los 6 endpoints `/api/copy-groups/*` ahora son consumidos por la UI.
  - Quality-gates table fix crítico: runner.ts + promote-to-live + quality-gates route ahora leen de `trading_algorithms` (sprint 2).
- **Sprint 5-8 (2026-05-03): higiene final, cobertura wide, audit batch** — de 623 → 929 tests verde (root 789 + coinarb 140):
  - Sprint 5: validation tests (68), rl-engine (28), heston-pricer (15), CLAUDE.md sync, Copy Groups quick link.
  - Sprint 6: intelligence refactor (extrae 14 helpers a `src/lib/intelligence/helpers.ts` + 59 tests), coinarb segunda capa (analysis + validators + phase-manager, 79 tests), capital-algorithm (22 tests).
  - Sprint 7: `runSkillLearningCycle(instrument, userId)` ya no hardcodea owner UUID; llm-rules tests (10); Cache-Control batch en 6 GET routes (copy-groups graph, coinarb agents/trades, algorithms backtest, polyarb agents).
  - Sprint 8: 11 audit log sites nuevos en 12 rutas mutadoras críticas (accounts CRUD, categories, agents create/update, algo control/pairing-token, CME signal/risk-config, treasury configs). `AuditResourceType` extendido con 7 tipos nuevos.
- **Sprint 9 — `shared/` consolidado** (2026-05-03): `src/components/shared/` eliminado por completo. Los 2 archivos finales (`Button.tsx`, `Card.tsx`) eran código muerto sin importadores en `src/`. Única ubicación canónica ahora: `src/components/ui/`.
- **Sprint 10 — Operations dashboard** (2026-05-03): `/business/operations` pasó de nav-hub (40% madurez) a mini-dashboard con 6 tiles: decisions pendientes, SOPs por correr, milestones, costos del mes, P&L del mes, runway. Backend en `src/lib/business/operationsDashboard.ts` (helper puro `buildOperationsDashboard` + async loader). 18 unit tests para el helper. Reusa `calculatePLMetrics` + `calculateRunwayMetrics` de `lib/business/metrics.ts`.
- **Map Hot module completo end-to-end** (2026-05): pasó de UI con mock data (~35% madurez) a 95% funcional.
  - Schema: migration `109_map_hot_schema.sql` con 3 tablas (`map_hot_goals`, `map_hot_goal_links`, `map_hot_milestones`), RLS owner-only, soft-delete, indexes parciales.
  - API: `/api/map-hot/goals` (GET/POST) + `/api/map-hot/goals/[id]` (GET/PUT/DELETE) + `/api/map-hot/milestones` (GET/POST) + `/api/map-hot/milestones/[id]` (PUT/DELETE) + `/api/algorithms/lite` (GET liviano para selector). Todos con Zod + autoFix + contractGuard + audit + recordBugFromRequest.
  - UI: `GoalGrid.client.tsx` (wired al API con Sonner toasts + ConfirmDialog + Skeleton + EmptyState), `FutureProgressTracker.client.tsx` (refactor del estático), `MilestoneFormModal.client.tsx`, `AlgorithmMultiSelect.client.tsx` (FK real a `algorithms`, espejo de `InstrumentMultiSelect`), `GoalCard.tsx` (chips linkeables a `/intelligence/algorithms?id=...`).
  - `/map-hot/progress` reescrito como server component con 3 widgets: `ProgressDistributionDonut`, `ProgressTimeframeTable`, `AtRiskGoalsList`. Agregado al sidebar.
  - Tests: 11 unit tests nuevos (`goalStatus.test.ts`, `milestoneStatus.test.ts`) + 6 E2E smoke (`tests/e2e/map-hot.spec.ts`). 573 tests totales del proyecto pasan, 0 regresiones.
  - Helpers nuevos: `src/lib/map-hot/goalStatus.ts`, `src/lib/map-hot/milestoneStatus.ts`. Schemas Zod extendidos en `src/lib/validation/schemas.ts` (`mapHotGoalCreateSchema`, `mapHotMilestoneCreateSchema`, etc.). autoFix extendido en `src/lib/validation/autoFix.ts`.
  - Tradermap legacy: tablas `tradermap_*` + `progress_events` + `user_level_state` + `progress_map_*` quedan en parking lot (header comment en `008_tradermap_schema.sql` y `src/lib/tradermap/progressEngine.ts`). XP/levels no replicado en Map Hot; decisión pendiente para V2.

---

## 11. Decisiones técnicas importantes

### Arquitectura de datos
- **Soft-delete universal**: ninguna tabla borra filas. Todo usa `deleted_at`. Queries siempre filtran `.is('deleted_at', null)`.
- **RLS como única barrera de autorización**: no hay middleware de autenticación en API routes individuales, Supabase RLS garantiza que cada usuario solo accede a sus datos.
- **AES-256-GCM con prefijo**: `enc:v1:IV:TAG:CIPHER`. Double-encrypt prevention: si ya tiene prefijo, no re-cifra. Passthrough de strings no cifrados (para migración gradual).
- **Server-side encryption only**: `encryptText/decryptText` lanzan error si se llaman desde el cliente.

### Supabase Client Pattern
- 3 clientes distintos según contexto:
  - `createClient()` server — para Server Components (cookies, anon key)
  - `createServiceClient()` — solo para operaciones admin (service_role)
  - `createClient()` browser — para Client Components
- Cookie handling en Server Components usa try/catch silencioso (Next.js 16 restringe setAll en render)

### PWA / Offline
- next-pwa deshabilitado en desarrollo (`disable: process.env.NODE_ENV === 'development'`)
- `sw.js` y `fallback-*.js` están en `.gitignore` (generados por build)
- AlphaCore: sistema de mutations offline-first con IndexedDB outbox y pre-submit dedup

### Bot Integration
- EA de MT5 (`GoldRangeBasketR`) es un git submodule en `/bots/GoldRangeBasketR/`
- Comunicación bot → app: webhooks HTTP a `/api/webhooks/mt5` (autenticado por HMAC)
- Comunicación app → bot: Supabase Edge Functions (bot-maintenance) + `bot_commands` table
- Heartbeat: `bot_instances.last_heartbeat_at`, threshold configurable por env
- Copy Groups: sistema de mirroring de trades entre cuentas con árbol de descendientes

### Coinarb ↔ Algorithms unification (Fase A/B/C — 2026-05)
Coinarb (bot crypto en Fly.io, app `coinarb-50x`, repo `/coinarb/`) **vive dentro del framework `algorithms`** desde la Fase A. No es un sistema paralelo.

**Identidad:**
- Una fila en `public.algorithms` con `id='a667d400-065f-4415-9609-373c3749e5fd'`, `kind='coinarb'` (en `engine_config`), `market_type='crypto'`, `platform='fly'`, `status='live'|'paused'`.
- `bot` + `bot_account` + `algorithm_deployments` (active) creados por migrations 099 + 100. IDs deterministas: bot `11111111-c01a-4b00-9001-000000000001`, bot_account `22222222-c01a-4b00-9002-000000000001`, deployment `33333333-c01a-4b00-9003-000000000001`.

**Config flow (Fase B):**
- `coinarb/src/core/index.ts` await `loadConfigFromDb()` antes de `buildLoop()`.
- Lee `algorithms.parameters` (4 thresholds tunables + `arb_gap_min` jsonb) y muta `let` exports en `coinarb/src/core/config.ts`. ES module live bindings hacen que loop.ts/smc-detector.ts/etc lean el valor nuevo sin refactor.
- `PAPER_MODE` sigue siendo env-only (`COINARB_50X_PAPER_MODE`) como safety brake.

**Hot-rotate flow (Fase C):**
- `PUT /api/algorithms/[id]` con `parameters` jsonb dispara `bot_commands.insert(command_type='update_parameters', payload={algorithm_id, parameters})`.
- `coinarb/src/ops/command-poller.ts` polea cada 30s: maneja `update_parameters` / `pause` / `resume`. Mutación in-memory via `applyParameters()` / `setTradingPaused()`. Ack en `bot_commands.status` + `bot_command_status` row.
- Tiempo total UI→bot: ≤30s sin restart/redeploy.

**Status sync (Fase #11):**
- En cada `flushTelemetry()`, si circuit-breaker disparó / daily cap alcanzado / `TRADING_PAUSED`, el bot escribe `algorithms.status='paused'`. Sin esos: `'live'`. Debounce in-memory: solo escribe en flip.

**Endpoints nuevos en este sprint:**
| Ruta | Método | Descripción |
|---|---|---|
| `/api/algorithms/[id]/control` | POST | `{action:'pause'\|'resume'}` → bot_commands |
| `/api/algorithms/[id]/telemetry` | GET | Latest `coinarb_telemetry` row (crypto-only) |
| `/api/ops/cron/coinarb-heartbeat` | POST | Cron Vercel cada minuto, dedup 30min via app_logs.fingerprint, push si heartbeat >5min stale |

**Componentes nuevos:**
- `AlgorithmDetailsModal.client.tsx` → `CoinarbSection` con 3 paneles: status+ControlButton, TelemetryPanel (refresh 15s), Tunables form (4 scalars + 3 per-symbol arb gaps).
- `ControlButton` POST a `/control`. `TelemetryPanel` GET a `/telemetry` con auto-refresh.

**Resiliencia (Fase #7):**
- `coinbase-ws.ts` + `binance-ws.ts`: silent-hang watchdog (60s sin mensaje → force close → reconnect) + reconnect jitter (±1s) sobre el exponential backoff existente.

**Backtest (Fase #8):**
- `coinarb/scripts/backtest.ts --days=N`: replay de N días con forward TP/SL scoring. Usa `loadHistoricalCandlesForDays()` (nuevo) que pagina vía Coinbase REST. 1m capped a 7d.

**UI dual `/intelligence/agents` + `/intelligence/algorithms` — recomendación KEEP both (2026-05-17 análisis):**
- **No son duplicados** — sirven propósitos complementarios:
  - `/intelligence/agents` (lee `coinarb_agents` + `polyarb_agents`): **fleet overview**. Muestra PolyArb + Coinarb con detalle granular de estado (PAPER+Day N/14, PAPER+OFFLINE, LIVE+REAL$, OFFLINE), heartbeat 30s, badges. La pantalla "¿están vivos mis bots y a qué fase del trial llegaron?".
  - `/intelligence/algorithms` (lee `algorithms`): **per-algorithm deep control**. Registry unificado de TODOS los algos (MT5/CME/options/crypto), modal con tunables editables, pause/resume, telemetry live. La pantalla "¿cómo está configurado y operando un algo específico?".
- Dropear `/intelligence/agents` perdería: visibilidad PolyArb (no hay fila para polyarb en `algorithms`), contador de días PAPER trial (1-14), taxonomía detallada del proceso del bot.
- Acción ideal a futuro: integrar el panel de tunables + telemetry de algorithms dentro del sub-page `/intelligence/agents/coinarb` para que el usuario tenga ambas superficies sin cambiar de URL.
- `coinarb_agents` table queda viva — es la fuente de verdad para `/intelligence/agents`.

### Validación en capas
1. **Zod schema** — valida shape y tipos del request body
2. **autoFix** — corrige valores inválidos comunes antes de validar
3. **contractGuard** — verifica que la respuesta cumple el schema antes de devolverla al cliente
4. **nullGuards** — helpers para castear `unknown` a string/number de forma segura

### Feature Flags
Solo 3 flags públicos (via `NEXT_PUBLIC_*`):
- `enableAab` (default: true) — muestra/oculta `/dashboard/tradehub/accounts/aab`
- `enableSystemLogs` (default: false) — muestra/oculta `/dashboard/logs/system`
- `enableServiceWorkerInDev` (default: false) — registra SW en desarrollo

### Naming Convention de Componentes
- Suffix `.client.tsx` → "use client" (Client Component)
- Sin suffix → Server Component (o ambos si tiene "use client" explícito)
- Panels viven en `src/components/<hub>/panels/`
- Forms en `src/components/<hub>/forms/`

---

## 12. Dependencias (package.json)

### Runtime
| Paquete | Versión | Uso |
|---------|---------|-----|
| `next` | 16.1.1 | Framework (App Router, Server Components) |
| `react` / `react-dom` | 19.2.3 | UI |
| `@supabase/supabase-js` | 2.90.1 | DB client |
| `@supabase/ssr` | 0.8.0 | Auth con cookies (server-side) |
| `zod` | 4.3.6 | Validación de schemas |
| `sonner` | 2.0.7 | Toast notifications |
| `lucide-react` | 0.562.0 | Iconos |
| `next-pwa` | 5.6.0 | Service worker + Workbox |
| `web-push` | 3.6.7 | Push notifications VAPID |
| `openpgp` | 6.3.0 | Cifrado PGP para Secure Mail |
| `postmark` | 4.0.5 | Email transaccional (inbound + outbound) |
| `@react-pdf/renderer` | 3.4.5 | Generación de PDFs |
| `idb` | 8.0.3 | IndexedDB wrapper (offline queue) |
| `@sentry/nextjs` | 10.53.1 | Error monitoring / performance tracing (activación pendiente DSN) |

### Dev
| Paquete | Versión | Uso |
|---------|---------|-----|
| `vitest` | 4.1.0 | Unit tests |
| `@vitest/coverage-v8` | 4.1.0 | Code coverage |
| `@playwright/test` | 1.57.0 | E2E tests |
| `tailwindcss` | 4 | CSS |
| `@tailwindcss/postcss` | 4 | PostCSS plugin |
| `typescript` | 5 | Tipado |
| `eslint` / `eslint-config-next` | 9 / 16.1.1 | Linting |
| `babel-plugin-react-compiler` | 1.0.0 | React Compiler (experimental) |
| `@testing-library/react` | 16.3.2 | UI unit tests |
| `@testing-library/jest-dom` | 6.9.1 | Matchers para vitest (`toBeInTheDocument`, etc.) |
| `@testing-library/user-event` | 14.6.1 | Simular interacciones de usuario |
| `jsdom` | 29.1.1 | Environment de DOM para tests UI |
| `@next/bundle-analyzer` | latest | `npm run analyze` para inspeccionar chunks del build |
| `cross-env` | 10.1.0 | Setear env vars portable (Windows/Unix) en scripts |

### Performance tooling

```bash
npm run analyze    # build con visualizador de chunks (.next/analyze/{client,server}.html)
```

Para inspeccionar bundle: abre `.next/analyze/client.html` en el browser tras el build. Targets sugeridos:
- First Load JS per page < 300 KB
- Cualquier chunk individual > 500 KB requiere code-splitting con `dynamic()`

### Convenciones de idioma

Código nuevo en **español** (UI strings, toasts, mensajes de error visibles). Código legacy en inglés se mantiene. **No instalar framework i18n** — overkill para 1 usuario.

---

## 13. Scripts npm

```bash
npm run dev              # Next.js dev server
npm run build            # Build producción (--webpack forzado)
npm run start            # Servidor producción
npm run lint             # ESLint
npm run test             # Vitest (unit tests, run once)
npm run test:watch       # Vitest watch mode
npm run test:coverage    # Vitest con coverage
npm run test:e2e         # Playwright E2E
npm run test:e2e:smoke:remote  # Smoke tests en producción

# Bot ops
npm run ops:bot-slo-monitor     # Monitor SLO del bot
npm run ops:bot-auto-recovery   # Auto-recovery del bot
npm run ops:bot-daily-summary   # Resumen diario ops
npm run ops:bot-daily-verify    # Verificación diaria

# Seguridad / auditoría
npm run security:check-rls       # Verifica cobertura RLS
npm run perf:bundle-budget       # Valida presupuesto de bundle
npm run audit:sprints            # Auditoría de sprints completados
```

---

## 14. Deployment

- **Plataforma**: Vercel (Node 24.x, región iad1 — Washington D.C.)
- **Dominio**: alphalog.io + www.alphalog.io (IONOS DNS → Vercel)
- **Proyecto Vercel**: `prj_qBbAPYFtvx4FIu7wmeLoV6fMqAir`
- **Último deploy**: `dpl_E88kojzWi3hPZ4CSKQuMjbCmkLmo` (READY)
- **Supabase**: `jgkvnnlodwdtjsmmzwry` (us-east-2, PostgreSQL 17.6, ACTIVE_HEALTHY)
- **CI**: GitHub Actions en `.github/workflows/`
  - `quality-gate.yml` — build + tests en cada PR
  - `bot-maintenance.yml` — mantenimiento automático del bot
  - `bot-command-timeout.yml` — timeout de comandos pendientes
- **Deploy manual**: `vercel --prod` desde CLI

---

_Generado automáticamente el 2026-03-15 leyendo todos los archivos del proyecto, consultando Supabase MCP (69 tablas, políticas RLS) y Vercel MCP (deployment + dominios)._
