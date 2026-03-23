# AlphaLog — Resumen Ejecutivo

## Qué es
AlphaLog es una Progressive Web App (PWA) de gestión integral de trading. No es solo un diario de trades — es una plataforma completa que centraliza operaciones, finanzas del negocio, control de bot, inteligencia de mercado y comunicaciones seguras en un solo lugar.

## Para quién
Un trader individual / prop trader que opera su negocio de trading como una LLC. Arquitectura preparada para multi-usuario pero actualmente diseñada para un solo dueño.

## Stack
Next.js 16 + Supabase + Vercel. TypeScript, Tailwind CSS 4, Zod para validación. PWA con soporte offline (IndexedDB + service worker). Cifrado AES-256-GCM para datos sensibles y PGP end-to-end para email.

## Producción
Vivo en https://alphalog.io — desplegado en Vercel (región Washington D.C.), base de datos en Supabase us-east-2.

## Los 8 módulos principales

### 1. TradeHub
Centro de operaciones de trading. CRUD de cuentas y trades, setups, evidencias, playbook de estrategias, reportes semanales con AI. Export CSV. Tabla comparativa de cuentas.

### 2. Treasury
Gestión financiera del negocio de trading. Wallets, configuraciones de retiro por cuenta, transacciones, presupuestos, payouts calculados con split de impuestos y bonus vault, calendario de eventos financieros.

### 3. Business Hub
Operaciones de la LLC. P&L, runway financiero, KPIs, decisiones con tareas, SOPs con checklists ejecutables, roadmap, costos recurrentes automatizados, gestión de documentos LLC.

### 4. Terminal de Análisis
Suite de inteligencia de mercado. Noticias por instrumento con score de relevancia e impacto, calendario económico, reportes de evidencia con attachments, generación automática de análisis con AI (OpenAI + QStash).

### 5. Intelligence
Planificación avanzada de capital. Targets de capital por cuenta, simulaciones manuales de retorno, constraint solver (en desarrollo), knowledge factory (en desarrollo).

### 6. TraderMap
Gamificación del progreso como trader. Sistema de XP y niveles, metas trimestrales por cuenta con balances objetivo, mapa de progreso visual. Diseñado para mantener disciplina y motivación.

### 7. Bot Control
Control remoto del EA GoldRangeBasketR en MetaTrader 5. Telemetría en tiempo real (equity, balance, posiciones), comandos remotos, heartbeat monitoring, auto-recovery, reportes diarios, alertas SLO. Copy Groups para mirroring de trades entre cuentas.

### 8. Secure Mail (Inbox)
Email cifrado end-to-end con PGP. Mailboxes con alias, contactos con claves públicas, whitelist de senders. Inbound via Postmark webhook, outbound via Postmark API. Auditoría de acceso a mensajes.

## Seguridad implementada
- CSRF protection (cookie + header)
- AES-256-GCM en campos sensibles
- PGP E2E en email
- RLS en las 69 tablas de Supabase
- Rate limiting global
- Audit trail completo
- Zod validation + autoFix + contractGuard en todos los endpoints
- Security headers (CSP, HSTS, X-Frame-Options)

## Números del proyecto
- 69 tablas en Supabase con RLS
- 85 API endpoints
- 41 migrations SQL
- PWA con soporte offline (IndexedDB outbox)
- Push notifications VAPID
- Tests: 19 unit (Vitest) + E2E (Playwright)
- CI/CD: GitHub Actions (quality gate + bot maintenance)

## Estado actual
- **Producción y funcionando**: TradeHub, Treasury, Business, Terminal, TraderMap, Bot Control, Secure Mail, Dashboard, Auth, Security, PWA
- **Parcialmente implementado**: P&L periódico (daily/weekly/monthly), Copy Groups UI, Intelligence ConstraintSolver y KnowledgeFactory, conflict resolution rollback
- **Pendiente**: Error monitoring externo (Sentry), multi-usuario real, tests E2E para módulos de negocio
