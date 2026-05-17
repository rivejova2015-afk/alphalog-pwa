// Sentry Node.js server init (route handlers, Server Components, middleware).
// If SENTRY_DSN is empty, init() short-circuits and the SDK no-ops.
import * as Sentry from '@sentry/nextjs';

const DSN = process.env.SENTRY_DSN;

if (DSN) {
  Sentry.init({
    dsn: DSN,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    release: process.env.VERCEL_GIT_COMMIT_SHA,

    // Performance sampling — server side runs at higher cost than client,
    // so keep this low and bump per-route via Sentry.startSpan in hotspots.
    tracesSampleRate: 0.05,

    // Mask raw bodies that may contain PII or trade data.
    sendDefaultPii: false,
  });
}
