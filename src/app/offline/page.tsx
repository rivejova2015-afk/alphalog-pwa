// src/app/offline/page.tsx
"use client";

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-6">📡</div>
        <h1 className="display-font text-3xl font-semibold text-slate-50 mb-3">Estás offline</h1>
        <p className="text-slate-400 mb-6">
          No hay conexión a internet. Puedes usar AlphaLog en modo lectura con los datos disponibles.
        </p>
        <button
          onClick={() => window.location.href = "/dashboard"}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-slate-950 rounded-full font-semibold"
        >
          Ir a Dashboard
        </button>
      </div>
    </div>
  );
}
