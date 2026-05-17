"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { logError } from "@/lib/log";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
  scope: string;            // "intelligence" | "securities" | "inbox" | ...
  homeHref?: string;        // where the "Go home" button lands
  homeLabel?: string;
}

// Shared chrome for `error.tsx` route segments. Logs once and offers retry/home.
// Use directly from per-segment error.tsx: pass `scope` + props from Next.
export function ErrorBoundaryPage({ error, reset, scope, homeHref = "/dashboard", homeLabel = "Go to dashboard" }: Props) {
  useEffect(() => {
    logError(`${scope}Error`, { component: scope, message: error.message, error: error.digest });
  }, [error, scope]);

  return (
    <div className="flex items-center justify-center min-h-[70vh] px-4">
      <div className="max-w-md w-full">
        <div className="bg-slate-800 rounded-lg shadow-2xl border border-red-500/20 p-8">
          <div className="flex justify-center mb-4">
            <div className="bg-red-500/10 rounded-full p-3 animate-pulse">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white text-center mb-2 capitalize">
            {scope} error
          </h1>
          <p className="text-slate-400 text-center mb-6 text-sm">
            {error.message || `Failed to load ${scope} module`}
          </p>

          {process.env.NODE_ENV === "development" && error.digest && (
            <div className="bg-slate-900 rounded p-3 mb-6 border border-slate-700">
              <p className="text-xs text-slate-500 font-mono break-all">Error ID: {error.digest}</p>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <button
              onClick={() => reset()}
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Try again
            </button>
            <Link
              href={homeHref}
              className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              <Home className="w-4 h-4" />
              {homeLabel}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
