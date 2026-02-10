"use client";

import { useEffect, useState } from "react";

export default function StepUpPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const next = params.get("next") || "/dashboard";

      const response = await fetch("/api/auth/device/verify", { method: "POST" });
      if (!response.ok) {
        setError("No se pudo verificar el dispositivo. Inicia sesion de nuevo.");
        return;
      }

      window.location.href = next;
    };

    run();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4">🔐</div>
        <p className="text-slate-300">
          {error || "Verificando dispositivo..."}
        </p>
      </div>
    </div>
  );
}
