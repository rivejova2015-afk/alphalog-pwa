'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { logError } from '@/lib/log';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logError('DashboardError', { component: 'dashboard', message: error.message, error: error.digest });
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4">
      <div className="max-w-md w-full">
        <div className="bg-slate-800 rounded-lg shadow-2xl border border-red-500/20 p-8">
          {/* Error Icon */}
          <div className="flex justify-center mb-4">
            <div className="bg-red-500/10 rounded-full p-3 animate-pulse">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </div>

          {/* Error Title */}
          <h1 className="text-2xl font-bold text-white text-center mb-2">
            Dashboard Error
          </h1>

          {/* Error Message */}
          <p className="text-slate-400 text-center mb-6 text-sm">
            {error.message || 'Failed to load dashboard module'}
          </p>

          {/* Error Details (Development Only) */}
          {process.env.NODE_ENV === 'development' && error.digest && (
            <div className="bg-slate-900 rounded p-3 mb-6 border border-slate-700">
              <p className="text-xs text-slate-500 font-mono break-all">
                Error ID: {error.digest}
              </p>
            </div>
          )}

          {/* Possible Causes */}
          <div className="bg-slate-900/50 rounded p-4 mb-6">
            <p className="text-xs text-slate-400 font-semibold mb-2">Possible causes:</p>
            <ul className="text-xs text-slate-500 space-y-1">
              <li>• Network connection lost</li>
              <li>• Session expired</li>
              <li>• Database temporarily unavailable</li>
              <li>• Browser cache issues</li>
            </ul>
          </div>

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
              onClick={() => window.location.href = '/dashboard'}
              className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              <Home className="w-4 h-4" />
              Go to dashboard
            </button>
          </div>

          {/* Support Note */}
          <p className="text-xs text-slate-500 text-center mt-6">
            Try refreshing the page. If the issue persists, check your internet connection.
          </p>
        </div>
      </div>
    </div>
  );
}
