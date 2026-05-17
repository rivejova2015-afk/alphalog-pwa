// Sentry browser-side init.
// Loaded by @sentry/nextjs at app startup in the browser. If
// NEXT_PUBLIC_SENTRY_DSN is empty, init() short-circuits and the SDK
// becomes a no-op — captureException calls silently swallow.
import * as Sentry from '@sentry/nextjs';

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (DSN) {
  Sentry.init({
    dsn: DSN,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,

    // Sampling. Keep performance + replay low to control cost; bump later
    // if we need richer traces on a specific release.
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: 1.0,

    // Filter noisy errors that don't reach a real bug:
    ignoreErrors: [
      // Browser extensions injecting code
      'top.GLOBALS',
      // Network blips while service-worker is updating
      'NetworkError when attempting to fetch resource',
      'Load failed',
      // ResizeObserver loop notice — benign Chromium quirk
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
    ],
  });
}
