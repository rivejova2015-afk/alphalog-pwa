// Sentry Node.js server init (route handlers, Server Components, middleware).
// If SENTRY_DSN is empty, init() short-circuits and the SDK no-ops.
import * as Sentry from '@sentry/nextjs';

const DSN = process.env.SENTRY_DSN;

// Routes where every transaction matters (execution path, money movement).
// Sampled at 1.0; everything else falls back to tracesSampleRate.
const HOT_ROUTES = [
  '/api/cme/signal',
  '/api/webhooks/mt5',
  '/api/webhooks/algo-trade',
  '/api/algorithms/',          // includes /control, /promote-to-live, /deploy
  '/api/treasury/payouts/',
];

if (DSN) {
  Sentry.init({
    dsn: DSN,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    release: process.env.VERCEL_GIT_COMMIT_SHA,

    // Default sampling. Server side runs at higher cost than client, so keep
    // this low; the tracesSampler below bumps hot routes selectively.
    tracesSampleRate: 0.05,

    tracesSampler: (ctx) => {
      const url = (ctx.normalizedRequest?.url as string | undefined) ?? '';
      if (HOT_ROUTES.some((p) => url.includes(p))) return 1.0;
      // Cron endpoints — useful to see scheduled job latency but at low volume.
      if (url.includes('/api/cron/') || url.includes('/api/ops/cron/')) return 0.5;
      return 0.05;
    },

    // Mask raw bodies that may contain PII or trade data.
    sendDefaultPii: false,

    beforeSend(event, hint) {
      const err = hint.originalException as Error | undefined;
      if (err?.name === 'AbortError') return null;
      // Supabase RLS denials are expected when a user hits a row they do not
      // own — surface them as breadcrumbs, not as events.
      const msg = event.message ?? '';
      if (msg.includes('row-level security') || msg.includes('PGRST301')) return null;
      return event;
    },
  });
}
