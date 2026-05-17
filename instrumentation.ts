// Next.js instrumentation hook — invoked once per worker on cold start.
// Routes the Sentry init by runtime so the right config loads in each
// execution context (Node server / edge middleware / browser).
//
// https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}
