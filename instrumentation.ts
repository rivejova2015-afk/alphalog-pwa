// Next.js instrumentation hook — invoked once per worker on cold start.
// Routes the Sentry init by runtime so the right config loads in each
// execution context (Node server / edge middleware / browser).
//
// https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation

import * as Sentry from '@sentry/nextjs';

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

// Reports errors from nested React Server Components to Sentry. Without this
// hook, RSC errors inside async components silently swallow — the user sees
// an Error Boundary but no event reaches the dashboard. The SDK warned about
// this during the Fase 2 build.
//
// https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/#errors-from-nested-react-server-components
export const onRequestError = Sentry.captureRequestError;
