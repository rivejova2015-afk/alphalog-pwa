// Sentry edge-runtime init (middleware running on the Vercel edge layer).
// If SENTRY_DSN is empty, init() short-circuits.
import * as Sentry from '@sentry/nextjs';

const DSN = process.env.SENTRY_DSN;

if (DSN) {
  Sentry.init({
    dsn: DSN,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    tracesSampleRate: 0.05,
  });
}
