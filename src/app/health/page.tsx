// src/app/health/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Estado del sistema — AlphaLog",
  description: "Página pública de health check.",
};

export default function HealthPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-emerald-300 text-sm">
      ok
    </div>
  );
}
