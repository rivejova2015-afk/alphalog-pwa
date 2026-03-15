'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Terminal } from 'lucide-react';

export default function CommandCenterError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[CommandCenterError]', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-center gap-3">
          <Terminal className="w-8 h-8 text-cyan-400" />
          <div>
            <h1 className="text-4xl font-bold text-white">Agent Command Center</h1>
            <p className="text-slate-400 text-sm mt-1">AlphaLog — 10 agents across Claude Code</p>
          </div>
        </div>
        <div className="max-w-2xl">
          <div className="bg-slate-800 rounded-lg shadow-xl border border-red-500/20 p-8">
            <div className="flex justify-center mb-4">
              <div className="bg-red-500/10 rounded-full p-3">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white text-center mb-2">Command Center Error</h2>
            <p className="text-slate-300 text-center mb-6 bg-slate-900/50 rounded p-4 border border-slate-700">
              {error.message || 'Failed to load the Command Center'}
            </p>
            {process.env.NODE_ENV === 'development' && error.digest && (
              <div className="bg-slate-900 rounded p-3 mb-6 border border-slate-700">
                <p className="text-xs text-slate-500 font-mono break-all">Error ID: {error.digest}</p>
              </div>
            )}
            <div className="flex flex-col gap-3">
              <button
                onClick={() => reset()}
                className="flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Try again
              </button>
              <button
                onClick={() => { window.location.href = '/dashboard'; }}
                className="bg-slate-700 hover:bg-slate-600 text-white font-medium py-3 px-4 rounded-lg transition-colors"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
