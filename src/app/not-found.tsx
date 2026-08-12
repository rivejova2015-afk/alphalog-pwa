import Link from "next/link";
import { SearchX, Home } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Página no encontrada — AlphaLog",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 px-4">
      <div className="max-w-md w-full">
        <div className="bg-slate-800 rounded-lg shadow-xl border border-slate-700 p-8">
          <div className="flex justify-center mb-4">
            <div className="bg-cyan-500/10 rounded-full p-3">
              <SearchX className="w-8 h-8 text-cyan-400" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-white text-center mb-2">
            404 — Página no encontrada
          </h1>

          <p className="text-slate-400 text-center mb-6">
            La página que buscás no existe o fue movida.
          </p>

          <Link
            href="/"
            className="flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            <Home className="w-4 h-4" />
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
