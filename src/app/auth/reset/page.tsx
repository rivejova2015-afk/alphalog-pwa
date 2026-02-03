"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/browser";

export default function ResetPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const searchParams = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search);
  }, []);

  useEffect(() => {
    const run = async () => {
      try {
        const code = searchParams?.get("code");
        if (!code) {
          setError("Enlace invalido o expirado.");
          return;
        }

        const supabase = createClient();
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setError(exchangeError.message || "No se pudo validar el enlace.");
          return;
        }

        setReady(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo validar el enlace.");
      }
    };

    void run();
  }, [searchParams]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    try {
      setLoading(true);
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message || "No se pudo actualizar la contraseña");
        return;
      }
      setMessage("Contraseña actualizada. Ya puedes iniciar sesion.");
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la contraseña");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden px-6 py-12 text-slate-200">
      <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-blue-600/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-64 w-64 translate-x-1/3 rounded-full bg-cyan-600/10 blur-3xl" />

      <section className="relative mx-auto w-full max-w-lg rounded-3xl border border-slate-700/70 bg-slate-900/80 p-8 shadow-[0_24px_60px_rgba(2,4,10,0.55)] backdrop-blur">
        <h1 className="display-font text-2xl text-slate-50">Crear contraseña</h1>
        <p className="mt-2 text-sm text-slate-400">
          Usa este formulario para crear o actualizar tu contraseña de acceso.
        </p>

        {!ready && !error && (
          <p className="mt-6 text-sm text-slate-400">Validando enlace...</p>
        )}

        {error && (
          <div className="mt-5 rounded-2xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
            <p>
              <strong>Error:</strong> {error}
            </p>
          </div>
        )}

        {message && (
          <div className="mt-5 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-100">
            {message}
          </div>
        )}

        {ready && (
          <form onSubmit={handleUpdatePassword} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-[0.2em] text-slate-400">
                Nueva contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="mt-2 w-full rounded-xl border border-slate-700/70 bg-slate-900/60 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-600/70 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-[0.2em] text-slate-400">
                Confirmar contraseña
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
                className="mt-2 w-full rounded-xl border border-slate-700/70 bg-slate-900/60 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-600/70 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Actualizando..." : "Actualizar contraseña"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
