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

---

## Módulos Clave

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

---

## Navegación

Home: Dashboard | Trading: Terminal, Accounts, Analytics, Trades
Personal: Journal, Goals, Setups | Capital: Treasury, Business, Map
Auth: Login/Logout
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
