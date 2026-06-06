'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { logError } from '@/lib/log';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logError('GlobalError', { component: 'app.errorBoundary', message: error.message, error: error.stack, code: error.digest });
  }, [error]);

  return (
    <html>
      <body>
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 px-4">
          <div className="max-w-md w-full">
            <div className="bg-slate-800 rounded-lg shadow-xl border border-red-500/20 p-8">
              {/* Error Icon */}
              <div className="flex justify-center mb-4">
                <div className="bg-red-500/10 rounded-full p-3">
                  <AlertTriangle className="w-8 h-8 text-red-500" />
                </div>
              </div>

              {/* Error Title */}
              <h1 className="text-2xl font-bold text-white text-center mb-2">
                Something went wrong
              </h1>

              {/* Error Message */}
              <p className="text-slate-400 text-center mb-4">
                {error.message || 'An unexpected error occurred'}
              </p>

              {/* Error Details (Development Only) */}
              {process.env.NODE_ENV === 'development' && error.digest && (
                <div className="bg-slate-900 rounded p-3 mb-6">
                  <p className="text-xs text-slate-500 font-mono break-all">
                    Error ID: {error.digest}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => reset()}
                  className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try again
                </button>
                <button
                  onClick={() => window.location.href = '/'}
                  className="bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Go home
                </button>
              </div>

              {/* Support Note */}
              <p className="text-xs text-slate-500 text-center mt-6">
                If the problem persists, please try refreshing the page or clearing your browser cache.
              </p>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
