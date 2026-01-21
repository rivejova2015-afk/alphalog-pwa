/**
 * Error Boundary para /dashboard/terminal
 * Atrapa crashes de componentes y muestra UI de error sin romper la página
 */

"use client";

import { useEffect } from "react";

interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function TerminalErrorBoundary({
  error,
  reset,
}: ErrorBoundaryProps) {
  useEffect(() => {
    // Log error para monitoreo (en producción irías a Sentry/etc)
    console.error("[TerminalErrorBoundary]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-8 text-center space-y-6">
          {/* Icono */}
          <div className="text-6xl">⚠️</div>

          {/* Titulo */}
          <h1 className="text-3xl font-bold text-red-200">
            Oops, algo salió mal
          </h1>

          {/* Descripción */}
          <p className="text-red-300 text-lg">
            Ocurrió un error inesperado en el Terminal. No te preocupes, puedes
            intentar de nuevo.
          </p>

          {/* Error detail (solo en desarrollo) */}
          {process.env.NODE_ENV === "development" && error.message && (
            <details className="mt-6 text-left bg-red-900/40 rounded p-4 border border-red-700">
              <summary className="cursor-pointer text-red-300 font-mono text-sm">
                Detalles técnicos (desarrollo)
              </summary>
              <pre className="mt-3 text-red-400 text-xs overflow-auto">
                {error.message}
                {"\n"}
                {error.stack}
              </pre>
            </details>
          )}

          {/* Botones */}
          <div className="flex gap-4 justify-center pt-4">
            <button
              onClick={() => reset()}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded text-white font-medium transition"
            >
              🔄 Reintentar
            </button>
            <a
              href="/dashboard"
              className="px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded text-white font-medium transition inline-block"
            >
              ← Volver al Dashboard
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
