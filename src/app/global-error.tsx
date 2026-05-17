'use client';

// Root error boundary for the App Router — catches React render errors that
// escape the per-route `error.tsx` files (root-layout rendering failures,
// errors thrown during the initial app shell render, etc).
//
// Without this file Sentry never sees those errors because they tear down the
// entire React tree before any boundary can catch them. The SDK warned about
// this during the Fase 2 build:
//   "It seems like you don't have a global error handler set up. It is
//    recommended that you add a 'global-error.js' file with Sentry
//    instrumentation so that React rendering errors are reported to Sentry."
//
// Must include its own <html>/<body> because it replaces the root layout.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/#react-render-errors-in-app-router

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: 0,
          minHeight: '100vh',
          background: '#0a0e1a',
          color: '#e2e8f0',
          fontFamily: 'system-ui, sans-serif',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            maxWidth: 480,
            padding: '32px',
            background: '#151b28',
            border: '1px solid #1f2937',
            borderRadius: 12,
            textAlign: 'center',
          }}
        >
          <h1 style={{ margin: '0 0 12px', fontSize: 20, color: '#ef4444' }}>
            Algo se rompió
          </h1>
          <p style={{ margin: '0 0 8px', fontSize: 14, color: '#94a3b8' }}>
            Un error inesperado tiró abajo la aplicación. Ya quedó reportado.
          </p>
          {error.digest && (
            <p style={{ margin: '0 0 20px', fontSize: 11, color: '#475569', fontFamily: 'monospace' }}>
              digest: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: '10px 20px',
              background: '#22d3ee',
              color: '#0a0e1a',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
