'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { logError } from '@/lib/log';

export default function TradehubError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logError('TradehubError', {
      component: 'tradehub',
      message: error.message,
      error: error.digest,
    });
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="max-w-md w-full bg-slate-800 rounded-xl border border-red-500/20 p-8 shadow-2xl">
        <div className="flex justify-center mb-4">
          <div className="bg-red-500/10 rounded-full p-3">
            <AlertTriangle className="w-7 h-7 text-red-400" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-white text-center mb-2">TradeHub Error</h2>
        <p className="text-slate-400 text-center text-sm mb-6">
          {error.message || 'An unexpected error occurred in TradeHub'}
        </p>
        {process.env.NODE_ENV === 'development' && error.digest && (
          <p className="text-xs text-slate-500 font-mono text-center mb-4">ID: {error.digest}</p>
        )}
        <div className="flex flex-col gap-3">
          <button
            onClick={reset}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition"
          >
            <RefreshCw className="w-4 h-4" /> Try again
          </button>
          <button
            onClick={() => { window.location.href = '/dashboard'; }}
            className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 px-4 rounded-lg transition"
          >
            <Home className="w-4 h-4" /> Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
