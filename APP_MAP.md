# APP_MAP - AlphaLog

Fuente de verdad: pantallas, módulos, componentes y flujos principales.

## Stack Actual (Base44 Export)
- **Frontend**: React 18 + Vite + TailwindCSS + Radix UI
- **Backend**: Base44 SDK
- **Auth**: Base44 Auth (token-based)
- **DB**: Base44 entities

## Stack Destino (Next.js PWA)
- **Frontend**: Next.js 16 + App Router + TailwindCSS v4 + Radix UI
- **Backend**: Supabase (PostgreSQL + Auth)

---

## Pantallas Principales (15)

1. **Dashboard** | `/`
2. **Terminal** | `/Terminal`
3. **Accounts** | `/Accounts`
4. **Analytics** | `/Analytics`
5. **Trades/TradesHub** | `/TradesHub`
6. **Journal** | `/Journal`
7. **Goals** | `/Goals`
8. **Setups** | `/Setups`
9. **Treasury** | `/Treasury`
10. **Map** | `/Map`
11. **Business** | `/Business`
12. **TraderMapMenu** | `/TraderMapMenu`
13. **Logs Dashboard** | `/dashboard/logs` (Sprint 3.1)

---

## Módulos Clave (Actualizado Sprint 3.1)

### Logs Manager (Sprint 3.1)
**Ruta**: `/dashboard/logs`  
**Descripción**: Centro de logs con categorías, tags, adjuntos, papelera y búsqueda.

**Tablas DB**:
- `categories` - Categorías por usuario (ej: Trading, Personal, Research, News)
- `tags` - Tags reutilizables (N:M via log_tags)
- `logs` - Logs con título, notas, tipo, categoría obligatoria
- `log_tags` - Asociación N:M (logs ↔ tags)
- `log_attachments` - Adjuntos múltiples por log (storage bucket: `log_attachments`)

**Funcionalidades**:
- **CRUD Logs**: create, read, update, delete (soft-delete via deleted_at)
- **Filtros**: por categoría, tags, rango de fecha, búsqueda full-text en title/notes
- **Paginación**: cursor-based (created_at desc)
- **Papelera**: vista de logs borrados (deleted_at not null), restore, delete permanente
- **Adjuntos**: upload múltiple a storage, preview, download, delete
- **Anti-duplicados**: no permite 2 logs con mismo título el mismo día UTC
- **RLS**: owner-only (auth.uid() = user_id)

**Componentes Esperados**:
- `LogsPage` - Layout principal (filtros + lista + detalle)
- `LogsList` - Lista paginada con filtros
- `LogCard` - Card compacta de log (título, categoría, tags, fecha)
- `LogModal` - Create/edit modal (título, notas, categoría, tags, adjuntos)
- `CategoriesManager` - CRUD de categorías (drawer o modal)
- `TagsManager` - CRUD de tags (searchable dropdown)
- `AttachmentUpload` - Upload múltiple, preview, list
- `LogsTrash` - Vista de papelera con opciones restore/delete

**API/Server Actions** (Backend):
- `createLog(title, notes, categoryId, tags, files)` - Crea log + tags + attachments
- `updateLog(logId, title, notes, categoryId, tags, newFiles)` - Actualiza log
- `deleteLog(logId)` - Soft-delete (updated_at + deleted_at = now())
- `restoreLog(logId)` - Restore desde papelera (deleted_at = null)
- `permanentlyDeleteLog(logId)` - Borra de verdad (para papelera)
- `uploadAttachment(logId, file)` - Upload a storage bucket
- `deleteAttachment(attachmentId)` - Soft-delete de attachment
- `getLogsWithFilters(categoryId, tags, dateRange, page)` - Lee + RLS

**Storage**:
- Bucket: `log_attachments` (privado)
- Path convention: `${user_id}/${log_id}/${uuid}_${filename}`
- Policies: owner-only via auth.uid() check en path prefix

### Terminal (Sprint 4.2)
**Ruta**: `/dashboard/terminal`  
**Descripción**: Herramientas de trading con noticias, calendario de eventos, evidencia/análisis con IA stub.

**Tablas DB**:
- `instruments` (GLOBAL, read-only, seed 2: US500, XAUUSD)
- `terminal_news` - Noticias por instrumento (user-owned, soft-delete)
- `terminal_events` - Eventos de calendario por instrumento (user-owned, soft-delete)
- `terminal_evidence_reports` - Reportes de análisis/IA (user-owned, instrument_id opcional, soft-delete)
- `terminal_evidence_attachments` - Adjuntos para reportes (user-owned, cascade delete, soft-delete)

**Tabs**:
1. **📰 Noticias** (NewsPanel)
   - Selecciona instrumento (obligatorio)
   - CRUD noticias: título, URL, fuente, relevancia (0-100), impacto (High/Medium/Low)
   - Ordenamiento: timestamp_utc desc
   - RLS: owner-only

2. **📅 Calendario** (CalendarPanel)
   - Selecciona instrumento (obligatorio)
   - CRUD eventos: nombre, impacto, timestamp_utc
   - Ordenamiento: timestamp_utc asc (próximos primero)
   - RLS: owner-only

3. **📊 Evidencia (IA)** (EvidenceReports + EvidenceAttachments)
   - CRUD reportes: título, contenido, instrumento (opcional)
   - Botón "🤖 Generar con IA (stub)" → POST /api/terminal/evidence/generate
   - Endpoint stub: genera contenido en español como placeholder
   - Adjuntos: multi-upload ≤100MB, bloquear .exe/.bat, signed URLs (60s), preview imágenes
   - Path storage: `${userId}/terminal/evidence/${reportId}/${uuid}_${filename}`
   - Reusan bucket privado existente (`log_attachments`)
   - RLS: owner-only

4. **🔍 Búsqueda** (Placeholder)
   - Coming soon

**Componentes**:
- `TerminalPage` - Layout principal con tab navigation
- `NewsPanel` - CRUD noticias por instrumento
- `CalendarPanel` - CRUD eventos, ordenados por fecha
- `EvidenceReports` - Lista + detalle de reportes, generate button
- `EvidenceAttachments` - Multi-upload, preview, signed URLs

**API Routes** (Backend):
- `GET /api/terminal/instruments` - List instrumentos (global, read-only)
- `GET /api/terminal/news?instrumentId={id}` - List noticias por instrumento
- `POST /api/terminal/news` - Create noticia (requiere instrument_id)
- `PATCH /api/terminal/news/{id}` - Update noticia
- `DELETE /api/terminal/news/{id}` - Soft-delete noticia
- `GET /api/terminal/events?instrumentId={id}` - List eventos por instrumento
- `POST /api/terminal/events` - Create evento (requiere instrument_id)
- `PATCH /api/terminal/events/{id}` - Update evento
- `DELETE /api/terminal/events/{id}` - Soft-delete evento
- `GET /api/terminal/evidence` - List reportes del usuario
- `POST /api/terminal/evidence` - Create reporte (instrument_id opcional)
- `PATCH /api/terminal/evidence/{id}` - Update reporte
- `DELETE /api/terminal/evidence/{id}` - Soft-delete reporte
- `POST /api/terminal/evidence/generate` - STUB: genera reporte con IA simulada
- `GET /api/terminal/evidence/{id}/attachments` - List adjuntos
- `POST /api/terminal/evidence/{id}/attachments` - Upload adjunto
- `DELETE /api/terminal/evidence/{id}/attachments/{attachmentId}` - Soft-delete adjunto
- `GET /api/terminal/evidence/{id}/attachments/{attachmentId}/signed-url` - Signed URL para descargar

**RLS Enforcement**:
- `instruments`: SELECT solo para authenticated (read-only global)
- `terminal_news/events/evidence_reports/evidence_attachments`: owner-only (auth.uid() = user_id)

**Índices**:
- `terminal_news` (user_id, instrument_id, timestamp_utc desc)
- `terminal_events` (user_id, instrument_id, timestamp_utc asc)
- `terminal_evidence_reports` (user_id, created_at desc)
- `terminal_evidence_attachments` (user_id, report_id, created_at desc)

**Seed Data**:
- Instrumentos: US500 (S&P500) sort_index=1, XAUUSD (Gold) sort_index=2

### TradeHub > Accounts (Sprint 4.1)
**Ruta**: `/dashboard/tradehub` (tab: 📋 Cuentas)  
**Descripción**: Gestión de cuentas de trading con categorización, papelera y hard-delete.

**Tablas DB**:
- `account_categories` - Categorías de cuentas por usuario (ej: Propfirm Forex, Forex Real, Opciones)
- `accounts` - Cuentas con propiedades (name, category_id, account_size, current_balance, operation_state, phase_status, role, withdrawals_enabled)

**Funcionalidades**:
- **CRUD Accounts**: create, read, update, delete (soft-delete via deleted_at)
- **Categorías**: seed 5 categorías por defecto, CRUD categorías
- **Papelera**: vista de cuentas eliminadas, restore, hard-delete permanente
- **Anti-duplicados**: no permite 2 cuentas con mismo nombre (case-insensitive via name_lower GENERATED)
- **RLS**: owner-only (auth.uid() = user_id)
- **Vaciar Papelera**: hard-delete todos los registros donde deleted_at NOT NULL

**Componentes**:
- `TradeHubPage` - Layout principal con AccountsPanel + NewTradesLog (tabs)
- `AccountsPanel` - CRUD cuentas, papelera, vaciar papelera
- `AccountDialog` - Create/edit modal con seed categories button
- `AccountCategorySelect` - Dropdown categorías con fallback seed button

**API Routes** (Backend):
- `GET /api/account-categories` - List categorías activas (deleted_at is null)
- `POST /api/account-categories` - Create categoría con anti-duplicados
- `GET /api/accounts?trash=true|false` - List cuentas (filtrado por deleted_at)
- `POST /api/accounts` - Create cuenta (name + category_id obligatorios)
- `PATCH /api/accounts/{id}` - Update cuenta o restore (si restore=true)
- `DELETE /api/accounts/{id}` - Soft-delete cuenta
- `POST /api/accounts/trash/empty` - Hard-delete todas las cuentas en papelera

**Default Categories (Seed)**:
1. Propfirm Forex
2. Propfirm Futuros
3. Forex Real
4. Futuros Real
5. Opciones

### TradeHub > New Trades Log (Sprint 4.3)
**Ruta**: `/dashboard/tradehub` (tab: 📊 New Trades Log)  
**Descripción**: Log de operaciones de trading (trades) con screenshot opcional y relación a setups/cuentas.

**Tablas DB**:
- `setups` - Estrategias/configuraciones de trading por usuario (soft-delete)
  - Columnas: id, user_id, name, description, sort_index, created_at/updated_at/deleted_at
  - Anti-duplicados: (user_id, name_lower) unique where deleted_at is null
  - RLS: owner-only
  
- `trades` - Operaciones de trading (soft-delete)
  - Columnas: id, user_id, account_id (FK), symbol, direction, status, entry_date, exit_date, entry_price, exit_price, quantity, fees, pnl, notes, setup_id (FK opcional), screenshot_path, is_featured_in_report, sort_index, created_at/updated_at/deleted_at
  - direction: texto libre con sugerencias (Long, Short, Buy, Sell)
  - status: texto libre con sugerencias (Open, Closed)
  - screenshot_path: ruta en storage privado (opcional), signed URLs (60s)
  - RLS: owner-only

**Índices**:
- trades: (user_id, created_at desc), (user_id, account_id), (user_id, setup_id)
- setups: (user_id)

**Funcionalidades**:
- **CRUD Trades**: create, read, update, delete (soft-delete via deleted_at)
- **Screenshot Upload**: ≤100MB, bloquea .exe/.bat, almacena en bucket privado, signed URLs
- **Setups**: selector opcional para asociar trade a setup
- **Papelera**: vista de trades eliminados, restore
- **Filtros**: por cuenta, vista activa vs papelera
- **Anti-duplicados**: no aplica (trades pueden tener mismo symbol, direction, etc.)
- **RLS**: owner-only (auth.uid() = user_id)

**Componentes**:
- `NewTradesLog` - CRUD trades, selector cuenta, screenshot upload, papelera
  - Form: symbol*, direction*, status*, entry_date*, exit_date, entry_price, exit_price, quantity, fees, pnl, notes, setup_id, featured checkbox
  - Screenshot: drag-drop zone, validation, preview (image MIME), signed URL
  - Lista con edit/delete, estado: Open/Closed visual
  - Papelera: restore button

**API Routes** (Backend):
- `GET /api/tradehub/trades?accountId={id}&trash=true|false` - List trades filtrados
- `POST /api/tradehub/trades` - Create trade (account_id, symbol, direction, status, entry_date obligatorios)
- `PATCH /api/tradehub/trades/{id}` - Update trade o restore (si restore=true)
- `DELETE /api/tradehub/trades/{id}` - Soft-delete trade
- `GET /api/tradehub/setups` - List setups activos
- `POST /api/tradehub/setups` - Create setup (name obligatorio, description opcional)
- `POST /api/tradehub/trades/{id}/screenshot` - Upload screenshot (multipart, max 100MB)
- `GET /api/tradehub/trades/{id}/screenshot` - Get signed URL para screenshot (60s)

**Storage**:
- Bucket: `log_attachments` (reutiliza bucket existente)
- Path convention: `${user_id}/tradehub/trades/${trade_id}/${uuid}_${filename}`
- Signed URLs: 60 segundos de validez

### TradeHub > Evidence Vault (Sprint 4.4)
**Ruta**: `/dashboard/tradehub` (tab: 📁 Evidence Vault)  
**Descripción**: Almacén de evidencia de análisis con validación de estado y enlaces opcionales a operaciones.

**Tablas DB**:
- `tv_analysis_evidence` - Evidencia de análisis de TradingView (soft-delete)
  - Columnas: id, user_id, image_path, captured_at, user_notes, account_id (FK opcional), trade_id (FK opcional), validation_status (text), sort_index, created_at, updated_at, deleted_at
  - validation_status: CHECK constraint en (needs_review, valid, invalid)
  - Relaciones opcionales: puede estar vinculada a una cuenta o trade específico
  - RLS: owner-only

**Índices**:
- tv_analysis_evidence: (user_id, captured_at desc), (user_id, account_id), (user_id, trade_id)

**Funcionalidades**:
- **Upload**: Drag-drop de imágenes (≤100MB), bloquea .exe/.bat, fecha captura, notas opcionales
- **Validación de Estado**: selector dropdown (needs_review → 🔍, valid → ✅, invalid → ❌)
- **Enlaces Opcionales**: botones/selectores para vincular a cuenta o trade específico
- **Listado**: sidebar con imágenes ordenadas por captured_at desc, indicadores de estado
- **Preview**: vista grande con image preview (signed URL 60s), metadata completa
- **Papelera**: soft-delete con confirmación
- **RLS**: owner-only (auth.uid() = user_id)

**Componentes**:
- `EvidenceVault` - Componente principal
  - Upload dialog: file picker, date input, notes textarea, account selector (optional), trade selector (optional)
  - List sidebar: scrollable lista de evidencia por fecha desc, status indicators, account/trade labels
  - Detail view: large image preview (signed URL), metadata (captured_at, account, trade, notes), status dropdown, delete button
  - File validation: client-side size check (100MB), extension blocking (.exe, .bat)
  - Estados: loading, error, uploading, updating status, delete confirm

**API Routes** (Backend):
- `GET /api/tradehub/evidence` - List evidencia del usuario (joins accounts, trades, ordena por captured_at desc)
- `POST /api/tradehub/evidence` - Upload nueva evidencia
  - Multipart FormData: file, notes, account_id (opcional), trade_id (opcional), captured_at
  - File validation: size (100MB), extension blocking (.exe, .bat)
  - FK verification: verifica account_id y trade_id pertenecen al usuario
  - Upload: path pattern `${user_id}/tradehub/evidence/${uuid}_${filename}` a bucket privado
  - DB insert: crea registro tv_analysis_evidence con validation_status = 'needs_review'
  - Error cleanup: limpia uploaded file si DB insert falla
- `PATCH /api/tradehub/evidence/{id}` - Update validation_status
- `DELETE /api/tradehub/evidence/{id}` - Soft-delete evidencia
- `GET /api/tradehub/evidence/{id}/signed-url` - Genera signed URL para image preview (60s)

**Storage**:
- Bucket: `log_attachments` (reutiliza bucket existente)
- Path convention: `${user_id}/tradehub/evidence/${uuid}_${filename}`
- Signed URLs: 60 segundos de validez

### TradeHub > Playbook (Sprint 4.4)
**Ruta**: `/dashboard/tradehub` (tab: 📖 Playbook)  
**Descripción**: Análisis de setups con estadísticas calculadas de trades cerrados.

**Funcionalidades**:
- **Listado de Setups**: muestra todos los setups activos del usuario
- **Estadísticas por Setup** (calculadas de trades cerrados donde exit_date NOT NULL):
  - totalTrades: count de todos los trades con setup_id
  - closedTrades: count de trades donde exit_date IS NOT NULL
  - openTrades: totalTrades - closedTrades
  - winRate: (count de trades con pnl > 0) / closedTrades * 100%
  - totalPnL: sum(pnl) para trades cerrados
  - avgPnL: totalPnL / closedTrades (null si no hay trades cerrados)
  - recentTrades: últimos 10 trades ordenados por created_at desc
- **UI Expandible**: cards compactos con resumen en header, expandible para ver detalles
- **Detalle expandido**: grid con stats (trades totales, cerrados, abiertos, win rate) + tabla de trades recientes
- **Color Coding**: P&L color-coded (positivo=verde, negativo=rojo, null=blanco)

**Componentes**:
- `Playbook` - Componente principal
  - Fetches: todos los setups + todos los trades al mount
  - Stats calculation: función calculateStats() que filtra trades cerrados
  - UI: collapsible setup cards mostrando resumen en header (trades, win rate, total P&L, avg P&L)
  - On expand: grid detallado (4 columnas: total trades, closed trades, win rate, open trades) + lista de trades recientes
  - Estados: loading, error, expandedSetupId

**API Routes** (Backend):
- `GET /api/tradehub/setups` - List setups activos (donde deleted_at IS NULL)
- `GET /api/tradehub/trades` - List todos los trades del usuario para stats calculation

### TradeHub > Reports (Sprint 4.5)
**Ruta**: `/dashboard/tradehub` (tab: 📊 Reports)  
**Descripción**: Reportes semanales AlphaBrief con métricas agregadas y análisis de trades cerrados.

**Tablas DB**:
- `weekly_reports` - Reportes semanales por usuario (soft-delete)
  - Columnas: id, user_id, week_start, week_end, content_md, total_trades, total_pnl, win_rate, created_at, updated_at, deleted_at
  - Unique parcial: (user_id, week_start, week_end) donde deleted_at IS NULL (evita duplicados)
  - RLS: owner-only (auth.uid() = user_id)

**Funcionalidades**:
- **Generar AlphaBrief**: botón genera reporte para últimos 7 días (UTC)
  - Calcula metrics de trades cerrados (exit_date NOT NULL) dentro del rango
  - Genera markdown ES con Executive Summary, Performance Overview, Account Breakdown, Key Insights, Action Items
  - Si ya existe reporte para esa semana: devuelve existing=true (evita duplicar)
  - Si no existe: crea nuevo registro y retorna report
- **Listado**: mostrados por fecha (más recientes primero)
- **Detalle**: expandible mostrando content_md completo
- **Soft-delete**: botón eliminar con confirmación, sets deleted_at = now()

**Métricas Calculadas**:
- totalTrades: count de trades cerrados en el rango
- totalPnL: sum(pnl) para todos los trades cerrados
- winRate: (count trades con pnl > 0) / totalTrades * 100%
- Account Breakdown: stats por cuenta (trades, pnl, win rate, avg pnl)
- Best/Worst Trade: máximo y mínimo pnl en el período
- Análisis: descriptivo basado en win rate (Excelente >60%, Positiva >50%, Mejorable <50%)

**Componentes**:
- `Reports` - Componente principal
  - Botón "🤖 Generar AlphaBrief" con estado loading
  - Listado de reportes (más recientes primero) con summary in header (week, trades, win rate, P&L, date)
  - Click card → expandible mostrando content_md en formato pre-formateado
  - Botón delete con confirmación (soft-delete)
  - Estados: loading, error, generating, expandedReportId

**API Routes** (Backend):
- `GET /api/tradehub/reports/generate` - List reportes del usuario (deprecated, usa POST)
- `POST /api/tradehub/reports/generate` - Genera nuevo reporte o retorna existente
  - Requiere: sesión autenticada (401 si no)
  - Calcula: week_start = hoy-7, week_end = hoy (UTC)
  - Fetches: trades cerrados en rango (exit_date NOT NULL)
  - Genera: markdown markdown con métricas agregadas
  - Check unique: (user_id, week_start, week_end) donde deleted_at IS NULL
  - Si existe: retorna { existing: true, report: {...} }
  - Si no existe: insert + retorna { existing: false, report: {...} }
- `DELETE /api/tradehub/reports/{id}` - Soft-delete reporte
  - Sets: deleted_at = NOW()

**Markdown Content Template**:
```
# AlphaBrief - Semana YYYY-MM-DD a YYYY-MM-DD

### Treasury (Sprint 7.1)
**Ruta**: `/dashboard/treasury`  
**Descripción**: Gestión de tesorería: configs de retiros, wallets multi-moneda, transacciones, presupuestos, payouts.

**Tablas DB**:
- `treasury_configs` - Configuración por cuenta (soft-delete)
  - Columnas: id, user_id, account_id (FK), withdrawal_day, split_mode, balance_threshold, anti_drawdown_active, anti_drawdown_threshold, tax_buffer_*, milestone_*, created_at/updated_at/deleted_at
  - Unique: (user_id, account_id) where deleted_at IS NULL
  - RLS: owner-only

- `treasury_wallets` - Wallets multi-moneda (soft-delete)
  - Columnas: id, user_id, name, currency, starting_balance, created_at/updated_at/deleted_at
  - Unique: (user_id, lower(name)) where deleted_at IS NULL
  - RLS: owner-only

- `treasury_transactions` - Transacciones (income/expense/transfer/adjustment) (soft-delete)
  - Columnas: id, user_id, wallet_id (FK), account_id (FK opcional), type, amount, occurred_on, description, notes, created_at/updated_at/deleted_at
  - RLS: owner-only

- `treasury_budgets` - Presupuestos por período (soft-delete)
  - Columnas: id, user_id, wallet_id (FK), period_start, period_end, target_income, target_expense, target_payout, notes, created_at/updated_at/deleted_at
  - RLS: owner-only

- `treasury_payouts` - Retiros planificados/realizados (soft-delete)
  - Columnas: id, user_id, account_id (FK), wallet_id (FK), payout_date, amount, status (planned/sent/received/canceled), method, notes, created_at/updated_at/deleted_at
  - RLS: owner-only

**Tabs (8)**:
1. **📊 Overview** - Dashboard: balance actual, retiros pendientes, health score, anti-drawdown status
2. **🎯 Milestone** - Seguimiento de milestone target (ej: 50k+), bonus vault accumulation
3. **📈 Cashflow** - Gráfico de flujo de caja (ingresos, gastos, transferencias) por período
4. **📅 Calendario** - Vista de calendario con payout dates, eventos importantes
5. **💰 Splits** - Gestión de splits mode (growth/safe/cash) y percentages
6. **⚠️ Umbral** - Configuración balance_threshold y alertas de riesgo
7. **🛡️ Anti-Drawdown** - Status de protección anti-drawdown, histórico
8. **🔥 Heatmap** - Mapa de calor de transacciones/payouts por fecha/cuenta

**Componentes**:
- `TreasuryPage` - Layout principal con tab navigation
- `OverviewPanel` - Balance card, pending payouts, health score, protections status
- `MilestonePanel` - Progress bar, milestone target, bonus vault history
- `CashflowPanel` - Chart (income/expense/transfer by period), trend analysis
- `CalendarioPanel` - Monthly grid calendar with events, main component (Sprint 8.2)
- `CalendarMonth` - Calendar grid display with day navigation (Sprint 8.2)
- `EventModal` - CRUD modal for creating/editing/deleting calendar events (Sprint 8.2)
- `SplitsPanel` - Mode selector (growth/safe/cash), percentage splits editor
- `UmbralPanel` - Balance threshold settings, alert configuration, protection rules
- `AntiDrawdownPanel` - Status indicator, threshold config, protection history
- `HeatmapPanel` - Heatmap visualization of transactions/payouts by date/account

**API Routes** (Backend):
- `GET /api/treasury/configs?accountId={id}` - Get/list configs
- `POST /api/treasury/configs` - Create config
- `PATCH /api/treasury/configs/{id}` - Update config
- `DELETE /api/treasury/configs/{id}` - Soft-delete config
- `GET /api/treasury/wallets` - List wallets
- `POST /api/treasury/wallets` - Create wallet
- `PATCH /api/treasury/wallets/{id}` - Update wallet
- `DELETE /api/treasury/wallets/{id}` - Soft-delete wallet
- `GET /api/treasury/transactions?walletId={id}&from={date}&to={date}` - List transactions
- `POST /api/treasury/transactions` - Create transaction
- `PATCH /api/treasury/transactions/{id}` - Update transaction
- `DELETE /api/treasury/transactions/{id}` - Soft-delete transaction
- `GET /api/treasury/budgets?walletId={id}` - List budgets
- `POST /api/treasury/budgets` - Create budget
- `PATCH /api/treasury/budgets/{id}` - Update budget
- `DELETE /api/treasury/budgets/{id}` - Soft-delete budget
- `GET /api/treasury/payouts?accountId={id}&status={status}` - List payouts
- `POST /api/treasury/payouts` - Create payout
- `PATCH /api/treasury/payouts/{id}` - Update payout status
- `DELETE /api/treasury/payouts/{id}` - Soft-delete payout
- `GET /api/treasury/calendar-events?accountId={id}&from={date}&to={date}` - List calendar events (Sprint 8.2)
- `POST /api/treasury/calendar-events` - Create calendar event (Sprint 8.2)
- `PATCH /api/treasury/calendar-events/{id}` - Update calendar event (Sprint 8.2)
- `DELETE /api/treasury/calendar-events/{id}` - Soft-delete calendar event (Sprint 8.2)
- `GET /api/cron/treasury/withdrawal-reminders` - Scheduled cron endpoint for daily withdrawal reminders (Sprint 8.2, requires x-cron-secret header)
- `GET /api/treasury/export?month={YYYY-MM}` - Export monthly treasury summary with payouts and transactions as CSV (Sprint 8.3)

**Scheduled Tasks** (Supabase Edge Functions):
- `treasury-withdrawal-reminders` - Scheduled daily at 00:05 UTC, calls `/api/cron/treasury/withdrawal-reminders` (Sprint 8.2)
  - Sends push notifications for withdrawal days (based on `push_withdrawal_day_enabled` in configs)
  - Sends push notifications for custom calendar events with `push_enabled=true`
  - Tracks last notification per cycle to prevent duplicates (cooldown 1/cycle per account)

**Tables (Database)** (Sprint 8.2 - Migration 013):
- `treasury_calendar_events` - Custom calendar events per account
  - Columnas: id, user_id, account_id (FK), event_date, title, kind (payout_cycle|payout_day|note), push_enabled, created_at/updated_at/deleted_at
  - Unique: (user_id, account_id, event_date, kind) where deleted_at IS NULL
  - RLS: owner-only

**Alterations** (Sprint 8.2 - Migration 013):
- `treasury_configs` - Add push_withdrawal_day_enabled (boolean, default true), last_withdrawal_push_cycle_start (date, tracks cycle for cooldown)

**Export & Offline** (Sprint 8.3):
- **CSV Export**: GET /api/treasury/export?month={YYYY-MM}
  - Returns CSV with summary section (closed PnL, payouts by status, tax/bonus reserves) + payouts section + transactions section
  - Pure CSV format, no external dependencies
  - Browser download via response header (Content-Type: text/csv, Content-Disposition: attachment)
  - Requires authentication (Supabase session)
  
- **Offline Snapshot**: IndexedDB persistence of treasury data
  - Stores: accounts, configs, wallets, transactions, budgets, payouts, trades, calendar_events
  - Persisted when user is logged in via `saveTreasuryDataToSnapshot()`
  - Read-only access when offline: Cashflow shows payouts list, Calendario displays events from snapshot
  - Indicators: "📴 Offline (Read-Only)" badge on components
  - Soft-delete fallback: calendar_events.deleted_at ignored in offline view
  
- **Libraries**:
  - `src/lib/treasury/exportCsv.ts` - Pure TS CSV generation (escapeCsvField, formatCurrencyForCsv, generateTreasuryExportCsv)
  - `src/lib/offline/snapshot.ts` - Extended with saveTreasuryDataToSnapshot(), getTreasuryOfflineData()
  - `src/lib/offline/idb.ts` - DashboardSnapshot interface updated with calendar_events field

- **UI Updates**:
  - `CashflowPanel` - New "Export" section with month input + "Export CSV" button (cyan-600)
  - `CalendarioPanel` - Offline mode detection + offline badge + read-only modal + local snapshot data rendering

```
# AlphaBrief - Semana YYYY-MM-DD a YYYY-MM-DD

## 📋 Resumen Ejecutivo
- Período
- Operaciones
- Resultado (P&L + status)
- Tasa de Aciertos

## 📊 Performance General
[Tabla con totales]

## 💼 Desglose por Cuenta
[Por cada cuenta: operaciones, P&L, win rate, promedio]

## 🔍 Insights Clave
- Mejor/Peor operación
- Operación promedio
- Análisis (Excelente/Positiva/Mejorable)

## ✅ Puntos de Acción
1. Revisar operaciones perdidas
2. Analizar cuentas bajo-performance
3. Mantener disciplina
4. Documentar lecciones
```

### AuthContext
Autenticación global → Migración: Supabase Auth + middleware

### Base44 Client
Cliente SDK → Migración: Supabase JS SDK

### React Query
useQuery() + useMutation() → Migración: Mantener, cambiar queryFn

### Entidades (BD)
Account, Trade, JournalEntry, Goal, etc. → Migración: PostgreSQL

### UI Components
Radix UI + TailwindCSS → Migración: JSX → TSX

### Server Functions
receiveMT5Data.ts, generateScheduledReport.ts → Migración: Supabase Edge Functions

---

## Flujos Clave

1. Auth: Sign/Login → session → Dashboard
2. CRUD Read: useQuery() → Supabase
3. CRUD Write: useMutation() → Supabase
4. Webhooks: MT5 → Edge Function → LiveMarketData
5. Reports: Cron → IA → save

### AlphaShield Logging (Sprint 10.7 + 10.8)
**Descripción**: Sistema de logging interno para captura de errores y eventos con deduplicación, rate limiting, retención 30 días y UI de diagnósticos.

**Tablas DB**:
- `app_logs` - Logs de aplicación (id, user_id, level, area, message, meta, fingerprint, url, user_agent, created_at, resolved_at, deleted_at)
- **RLS**: owner-only (auth.uid() = user_id)
- **Índices**: (user_id, created_at desc), (fingerprint), (user_id, area), (user_id, level)

**Core Logging (Sprint 10.7)**:
- `logger.ts` - Logger principal con deduplicación, rate limiting, offline queue
- `sanitize.ts` - Sanitización de datos (remover tokens, keys, secrets, cookies)
- `fingerprint.ts` - Generación de fingerprints para deduplicación
- `queue.ts` - Cola local (IndexedDB) para offline-first logging
- `/api/logs/ingest` - Endpoint autenticado para ingestar logs
- `/api/logs/cleanup` - Endpoint opcional para limpieza de logs >30 días

**System UI (Sprint 10.8)**:
- `safeMode.ts` - Detección de loops de error (3+ en 60s) y activación de modo seguro
- `debugBundle.ts` - Generador de bundles JSON sanitizados para troubleshooting
- `codexPrompt.ts` - Generador de prompts para Claude/GPT
- `/dashboard/logs/system` - Página de diagnósticos del sistema
- `SystemDiagnostics.client.tsx` - Widget de estado (SW, offline, push, manifest)
- `RecentErrors.client.tsx` - Lista de últimos 20 errores
- `SafeModeBanner.client.tsx` - Banner discreto en dashboard (no sticky)

**Features**:
- ✅ Captura errores y eventos en client y server
- ✅ Cola local (offline-friendly, persiste en IndexedDB)
- ✅ Deduplicación (fingerprinting, ventana 30s)
- ✅ Rate limiting (max 10 eventos/min por area)
- ✅ Sanitización (no loggear tokens, keys, secrets)
- ✅ Auto-flush cuando online
- ✅ Retención 30 días (Supabase cron o API endpoint)
- ✅ **Safe Mode**: Auto-activación con 3+ errores en 60s (read-only UI)
- ✅ **Debug Bundle**: JSON sanitizado con diagnostics completos
- ✅ **Codex Prompt**: Prompt auto-generado para Claude/GPT
- ✅ **System Dashboard**: UI interna para ver estado y errores

**Rutas**:
- `/dashboard/logs/system` - Sistema diagnostics, debug bundle, codex prompt

**Uso Logging**:
```typescript
import { logger } from '@/lib/alphashield/logger';

// Log error
await logger.error('tradehub', 'Failed to fetch prices', error, { symbol: 'EURUSD' });

// Log warning
await logger.warn('treasury', 'Low runway', { days: 5 });

// Log info
await logger.info('auth', 'User logged in');

// Log debug
await logger.debug('pwa', 'Service worker registered');
```

**Uso Safe Mode**:
```typescript
import { isSafeModeActive, shouldDisableWrites, disableSafeMode } from '@/lib/alphashield/safeMode';

// Check si safe mode está activo
if (isSafeModeActive()) {
  // Hide create/save buttons
}

// Disable writes
if (shouldDisableWrites()) {
  button.disabled = true;
}

// Exit safe mode
disableSafeMode();
```

**Safe Mode Behavior**:
- Triggers: 3+ errores (level='error') dentro de 60 segundos
- Effects: 
  - Banner visible en dashboard (no sticky)
  - Write operations disabled (helper: `shouldDisableWrites()`)
  - Stored in localStorage (expires en 24 horas)
- Exit: Click "Salir" button en banner o system page

**Testing**:
- Provocar 3 errores seguidos → safe mode se activa
- Verificar banner aparece en dashboard
- Verificar botones create/save están deshabilitados
- Copiar debug bundle → revisar que no contiene tokens/keys
- Copiar codex prompt → verificar incluye error summary + files
- Desconectar internet, provocar error, reconectar → verifica auto-flush
- Verificar que tokens/keys/secrets NO se loggean (sanitización)

**Documentación**:
- [ALPHASHIELD_RETENTION_SETUP.md](docs/ALPHASHIELD_RETENTION_SETUP.md) - Setup retención 30 días
- [SPRINT_10_7_ALPHASHIELD_REPORT.md](docs/SPRINT_10_7_ALPHASHIELD_REPORT.md) - Logging implementation
- [SPRINT_10_8_ALPHASHIELD_UI_REPORT.md](docs/SPRINT_10_8_ALPHASHIELD_UI_REPORT.md) - UI implementation

---

## Navegación

Home: Dashboard | Trading: Terminal, Accounts, Analytics, Trades
Personal: Journal, Goals, Setups | Capital: Treasury, Business, Map
System: Logs (AlphaShield) | Auth: Login/Logout
## Decisiones MVP (actualizado)
- Rutas: mantener estilo Base44 (ej: /Terminal). Más adelante: redirect desde /terminal → /Terminal.
- Terminal: tab "Dossier" se renombra a "News"; no se eliminan tabs.
- Journal: mood y tags obligatorios; tags mínimo 1; incluye texto libre.
- Dashboard (arriba): % P&L por categoría:
  - % PropForex (Propfirm Forex), % PropFuturos (Propfirm Futuros),
  - % Cuentas Fx (Forex Real), % Cuentas Ft (Futuros Real), % Cuentas Opciones (Opciones)
  Abajo: % Diario Total, % Semanal, % Mensual, % Trimestral, % Anual, % Total.
- Navegación: topbar como patrón principal (sin rediseño global).
- Estilo UI: moderado por sección (sin cambiar el diseño global).
- Banner (Sprint 2C): dentro del layout (no sticky).