/**
 * SprintDefinitions - Source of truth for Sprint structure, requirements and checks
 * Usado por sprintAudit.ts para verificar estado actual vs expected
 */

export interface FileCheck {
  path: string;
  description: string;
  required: boolean;
}

export interface EndpointCheck {
  path: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  description: string;
  required: boolean;
}

export interface MigrationCheck {
  name: string;
  number: number;
  tables: string[];
  description: string;
  required: boolean;
}

export interface SprintDefinition {
  id: number;
  name: string;
  description: string;
  estimatedHours: number;
  status: 'completed' | 'partial' | 'not-started';
  files: FileCheck[];
  endpoints: EndpointCheck[];
  migrations: MigrationCheck[];
  features: string[];
  acceptanceCriteria: string[];
}

export const SPRINT_DEFINITIONS: Record<number, SprintDefinition> = {
  2: {
    id: 2,
    name: 'Supabase Auth + Middleware',
    description: 'Auth flow seguro, rutas protegidas, sesión persistente, logout',
    estimatedHours: 3,
    status: 'partial',
    files: [
      {
        path: 'src/app/auth/page.tsx',
        description: 'Auth/Login page con email/password y Google OAuth',
        required: true,
      },
      {
        path: 'src/app/auth/callback/route.ts',
        description: 'OAuth callback handler (exchange code for session)',
        required: true,
      },
      {
        path: 'middleware.ts',
        description: 'Middleware que protege rutas /dashboard, redirige no-auth a /auth',
        required: true,
      },
      {
        path: 'src/proxy.ts',
        description: 'Proxy de sesión para mantener cookies actualizadas',
        required: true,
      },
      {
        path: 'src/components/LogoutButton.tsx',
        description: 'Componente Logout que llama supabase.auth.signOut()',
        required: true,
      },
      {
        path: 'src/lib/supabase/browser.ts',
        description: 'Cliente Supabase para browser',
        required: true,
      },
    ],
    endpoints: [
      {
        path: '/auth',
        method: 'GET',
        description: 'Login page (email/password + Google OAuth)',
        required: true,
      },
      {
        path: '/auth/callback',
        method: 'GET',
        description: 'OAuth callback route (maneja code exchange)',
        required: true,
      },
      {
        path: '/dashboard',
        method: 'GET',
        description: 'Protected dashboard (solo autenticados)',
        required: true,
      },
      {
        path: '/api/auth/logout',
        method: 'POST',
        description: 'Logout endpoint (opcional si usa form en component)',
        required: false,
      },
    ],
    migrations: [],
    features: [
      '✅ Email/Password login',
      '✅ Google OAuth',
      '✅ Session exchange (code → session)',
      '✅ Middleware protection (/dashboard)',
      '✅ Persistent session (refresh)',
      '✅ Logout funcional',
    ],
    acceptanceCriteria: [
      'Signup/Login pages funcionales',
      'Middleware protege /dashboard (redirige no-auth)',
      'Logout funciona y redirige a /auth',
      'Session persiste en refresh',
      'Email/password auth completo',
      'No pantalla en blanco post-login',
    ],
  },

  5: {
    id: 5,
    name: 'Edge Functions + Real-time Data',
    description: 'Server functions, webhooks, live subscriptions',
    estimatedHours: 3,
    status: 'not-started',
    files: [
      {
        path: 'supabase/functions/receive-mt5-data/index.ts',
        description: 'Edge Function: Recibe datos MT5 (symbol, bid, ask, last)',
        required: true,
      },
      {
        path: 'supabase/functions/generate-scheduled-report/index.ts',
        description: 'Edge Function: Genera reportes con agregación de datos + IA',
        required: true,
      },
      {
        path: 'src/app/api/webhooks/mt5/route.ts',
        description: 'Webhook handler: POST de MT5 → Edge Function',
        required: true,
      },
      {
        path: 'src/lib/realtime/subscriptions.ts',
        description: 'Real-time subscriptions: Dashboard, Terminal (mercados, análisis)',
        required: false, // Nice to have, no es bloqueante
      },
    ],
    endpoints: [
      {
        path: '/functions/v1/receive-mt5-data',
        method: 'POST',
        description: 'Edge Function endpoint: POST { symbol, bid, ask, last }',
        required: true,
      },
      {
        path: '/functions/v1/generate-scheduled-report',
        method: 'POST',
        description: 'Edge Function endpoint: Genera reporte con IA',
        required: true,
      },
      {
        path: '/api/webhooks/mt5',
        method: 'POST',
        description: 'Webhook receiver: valida, parsea, llama Edge Function',
        required: true,
      },
    ],
    migrations: [
      {
        name: '005_live_market_data',
        number: 5,
        tables: ['live_market_data', 'reports'],
        description: 'Tablas para datos en vivo y reportes generados',
        required: true,
      },
    ],
    features: [
      '✅ Edge Function: receive-mt5-data',
      '✅ Edge Function: generate-scheduled-report (con IA)',
      '✅ Webhook handler: MT5',
      '✅ Real-time subs (opcional)',
      '✅ Tablas: live_market_data, reports',
    ],
    acceptanceCriteria: [
      'Ambas Edge Functions deployadas',
      'Webhooks reciben datos correctamente',
      'Datos guardados en live_market_data',
      'Reportes generados con IA',
      'Real-time funciona (si implementado)',
    ],
  },

  7: {
    id: 7,
    name: 'Trading Pages (Partial) + AlphaShield Logger',
    description: 'TradeHub, Treasury basic, AlphaShield logging',
    estimatedHours: 4,
    status: 'partial',
    files: [
      {
        path: 'src/app/(dashboard)/tradehub/page.tsx',
        description: 'TradeHub main page (accounts, trades, evidence, playbook, reports)',
        required: true,
      },
      {
        path: 'src/app/(dashboard)/treasury/page.tsx',
        description: 'Treasury overview page',
        required: true,
      },
      {
        path: 'src/lib/alphashield/logger.ts',
        description: 'AlphaShield logger: client-side logging con dedup + rate limit',
        required: true,
      },
      {
        path: 'src/lib/alphashield/sanitize.ts',
        description: 'Sanitización: remover tokens, keys, secrets',
        required: true,
      },
      {
        path: 'src/lib/alphashield/fingerprint.ts',
        description: 'Fingerprinting: deduplicación de logs',
        required: true,
      },
    ],
    endpoints: [
      {
        path: '/api/logs/ingest',
        method: 'POST',
        description: 'Ingest logs: autenticado, dedup, rate limit (5/min)',
        required: true,
      },
      {
        path: '/api/logs/cleanup',
        method: 'DELETE',
        description: 'Cleanup expired logs (30+ días)',
        required: true,
      },
    ],
    migrations: [
      {
        name: '016_app_logs',
        number: 16,
        tables: ['app_logs'],
        description: 'AlphaShield logging table: level, area, message, fingerprint, expires_at (30d TTL)',
        required: true,
      },
    ],
    features: [
      '✅ app_logs table (migration 016)',
      '✅ Logger library (client-side)',
      '✅ POST /api/logs/ingest (dedup + rate limit)',
      '✅ DELETE /api/logs/cleanup (30d retention)',
      '✅ Sanitización de secrets',
      '✅ Deduplicación por fingerprint',
    ],
    acceptanceCriteria: [
      'app_logs table exists y tiene índices',
      'Logger funciona (error, warn, info, debug)',
      'Dedup funciona (mismo fingerprint en 30s)',
      'Rate limit funciona (max 5/min)',
      'Sanitización completa (no tokens/keys)',
      'TTL cleanup automático',
    ],
  },

  8: {
    id: 8,
    name: 'AlphaShield UI + Debug Bundle + Safe Mode',
    description: '/dashboard/logs/system con filtros, export, AI prompt, safe mode',
    estimatedHours: 3,
    status: 'completed',
    files: [
      {
        path: 'src/app/(dashboard)/logs/system/page.tsx',
        description: 'System logs viewer page',
        required: true,
      },
      {
        path: 'src/components/logs/SystemLogs.client.tsx',
        description: 'Main container: filters, pagination, real-time',
        required: true,
      },
      {
        path: 'src/components/logs/LogsTable.tsx',
        description: 'Table component con logs',
        required: true,
      },
      {
        path: 'src/lib/alphashield/debugBundle.ts',
        description: 'Debug Bundle generator (JSON sanitizado)',
        required: true,
      },
      {
        path: 'src/lib/alphashield/codexPrompt.ts',
        description: 'Codex Prompt generator (para Claude/GPT)',
        required: true,
      },
      {
        path: 'src/lib/alphashield/safeMode.ts',
        description: 'Safe mode: trigger (3+ errores en 60s), helpers',
        required: true,
      },
    ],
    endpoints: [],
    migrations: [],
    features: [
      '✅ Real-time log streaming',
      '✅ Filtros (level, area, time)',
      '✅ Search (full-text)',
      '✅ Pagination (50 logs/page)',
      '✅ Debug Bundle export (JSON)',
      '✅ Copy Codex Fix Prompt',
      '✅ Safe Mode (3+ errors → read-only)',
      '✅ Resolveability tracking',
    ],
    acceptanceCriteria: [
      'Page carga sin errores',
      'Logs aparecen en real-time',
      'Filtros funcionan',
      'Export JSON valid',
      'Copy prompt funciona',
      'Safe mode se activa con 3+ errores',
    ],
  },

  9: {
    id: 9,
    name: 'Playwright E2E Tests',
    description: '24+ test cases: auth, navigation, workflows, smoke',
    estimatedHours: 3,
    status: 'completed',
    files: [
      {
        path: 'playwright.config.ts',
        description: 'Playwright configuration (browsers, reporters, base URL)',
        required: true,
      },
      {
        path: 'tests/e2e/auth.spec.ts',
        description: 'Auth tests: login, invalid, logout',
        required: true,
      },
      {
        path: 'tests/e2e/navigation.spec.ts',
        description: 'Navigation tests: 7 modules',
        required: true,
      },
      {
        path: 'tests/e2e/tradehub.spec.ts',
        description: 'TradeHub workflow tests',
        required: true,
      },
      {
        path: 'tests/e2e/smoke.spec.ts',
        description: 'Smoke tests: cross-module',
        required: true,
      },
    ],
    endpoints: [],
    migrations: [],
    features: [
      '✅ 8 test suites',
      '✅ 24+ test cases',
      '✅ Multi-browser (Chrome, Firefox, Safari)',
      '✅ Email/password auth tests',
      '✅ All 7 modules navigation',
      '✅ Create workflows (5 modules)',
      '✅ HTML report with screenshots',
    ],
    acceptanceCriteria: [
      'All 24+ tests pass',
      'Build passes (npm run build)',
      'Tests run (npm run test:e2e)',
      'Verify:all passes',
      'No TypeScript errors',
    ],
  },

  10: {
    id: 10,
    name: 'Sprint Audit + AlphaShield Integration',
    description: 'Audit engine, status UI, reporte guardado en app_logs',
    estimatedHours: 3,
    status: 'completed',
    files: [
      {
        path: 'src/lib/alphashield/sprintAudit.ts',
        description: 'Audit engine: filesystem checks, definitions, reporte JSON',
        required: true,
      },
      {
        path: 'src/lib/alphashield/sprintDefinitions.ts',
        description: 'Sprint definitions: source of truth (este archivo)',
        required: true,
      },
      {
        path: 'src/app/api/alphashield/audit/route.ts',
        description: 'API endpoint: ejecuta audit, guarda resultado en app_logs',
        required: true,
      },
      {
        path: 'src/components/logs/SprintStatus.client.tsx',
        description: 'Sprint Status UI component con Run Audit button',
        required: true,
      },
    ],
    endpoints: [
      {
        path: '/api/alphashield/audit',
        method: 'POST',
        description: 'Run audit, save to app_logs, return reporte',
        required: true,
      },
    ],
    migrations: [],
    features: [
      '✅ Audit engine (checks files, endpoints, migrations)',
      '✅ Sprint definitions (2, 5, 7-10)',
      '✅ API endpoint (guarda en app_logs)',
      '✅ Sprint Status UI (badges, expand)',
      '✅ Run Audit button',
      '✅ Último reporte cacheado',
    ],
    acceptanceCriteria: [
      'API audit route funciona',
      'Reporte JSON generado',
      'Guardado en app_logs (area=alphashield)',
      'Sprint Status UI muestra status',
      'Badges muestran ✅/⚠️/❌',
      'Offline mode (último reporte en cache)',
    ],
  },
};

/**
 * Helper: obtener definición de sprint por ID
 */
export function getSprintDefinition(id: number): SprintDefinition | null {
  return SPRINT_DEFINITIONS[id] || null;
}

/**
 * Helper: obtener lista de sprints en orden
 */
export function getAllSprints(): SprintDefinition[] {
  return [
    SPRINT_DEFINITIONS[2],
    SPRINT_DEFINITIONS[5],
    SPRINT_DEFINITIONS[7],
    SPRINT_DEFINITIONS[8],
    SPRINT_DEFINITIONS[9],
    SPRINT_DEFINITIONS[10],
  ].filter(Boolean);
}
