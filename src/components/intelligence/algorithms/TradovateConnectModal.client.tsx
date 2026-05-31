"use client";

import { useState } from "react";
import { X, Eye, EyeOff, Loader2, Cloud, AlertCircle, Check } from "lucide-react";
import { toast } from "sonner";

interface Props {
  cmeAccountId: string;
  providerName?: string | null;
  accountNumber?: string | null;
  isPaper: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ConnectResponse {
  ok?: boolean;
  error?: string | Record<string, unknown>;
  connection?: {
    id: string;
    tradovate_account_id: number;
    tradovate_account_spec: string;
    token_expires_at: string;
  };
}

export default function TradovateConnectModal({
  cmeAccountId,
  providerName,
  accountNumber,
  isPaper,
  onClose,
  onSuccess,
}: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError("Username y password son obligatorios.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const csrfToken = document.cookie
        .split("; ")
        .find((row) => row.startsWith("al_csrf="))
        ?.split("=")[1] ?? "";

      const res = await fetch("/api/cme/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({
          cmeAccountId,
          tradovateUsername: username.trim(),
          tradovatePassword: password,
        }),
      });
      const json: ConnectResponse = await res.json().catch(() => ({}));

      if (!res.ok || !json.ok) {
        const msg = typeof json.error === "string"
          ? json.error
          : `Conexión falló (HTTP ${res.status})`;
        setError(msg);
        return;
      }

      toast.success(`Conectado a Tradovate (${isPaper ? "paper" : "live"})`);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tradovate-connect-title"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      onClick={() => !submitting && onClose()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg bg-[#0a0e1a] border border-[#1f2937] shadow-2xl"
      >
        <div className="flex items-center justify-between p-5 border-b border-[#1f2937]">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-amber-400" />
            <h2 id="tradovate-connect-title" className="text-base font-semibold text-slate-100">
              Conectar a Tradovate
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-slate-500 hover:text-slate-200 transition disabled:opacity-40"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Account context — confirms which cme_account is being connected */}
          <div className="rounded-lg bg-[#151b28] border border-[#1f2937] p-3 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Cuenta CME</span>
              <span className="text-slate-200 font-mono">{providerName ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Número</span>
              <span className="text-slate-200 font-mono">{accountNumber ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Modo</span>
              <span className={`font-mono font-bold uppercase ${isPaper ? "text-amber-400" : "text-red-400"}`}>
                {isPaper ? "Paper" : "Live"}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            Usá las credenciales de tu cuenta {isPaper ? "demo (sim)" : "live"} de Tradovate.
            La password se transmite por HTTPS al servidor y queda almacenada como token
            cifrado en el vault — nunca se persiste en texto plano.
          </p>

          <div className="space-y-2">
            <label className="block">
              <span className="block text-xs text-slate-400 mb-1">Username</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={submitting}
                autoComplete="username"
                placeholder="tu-usuario-tradovate"
                className="w-full px-3 py-2 bg-[#151b28] border border-[#1f2937] rounded text-sm text-slate-100 font-mono focus:outline-none focus:border-amber-600 disabled:opacity-40"
              />
            </label>

            <label className="block">
              <span className="block text-xs text-slate-400 mb-1">Password</span>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full pr-9 px-3 py-2 bg-[#151b28] border border-[#1f2937] rounded text-sm text-slate-100 font-mono focus:outline-none focus:border-amber-600 disabled:opacity-40"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={submitting}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200 transition"
                  aria-label={showPassword ? "Ocultar password" : "Mostrar password"}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </label>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-950/40 border border-red-900/60 text-red-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-3 py-1.5 rounded-lg border border-[#1f2937] text-slate-400 text-xs hover:border-slate-600 transition-colors disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || !username.trim() || !password}
              className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition-colors disabled:opacity-40 flex items-center gap-1.5"
            >
              {submitting ? (
                <><Loader2 size={11} className="animate-spin" /> Conectando…</>
              ) : (
                <><Check size={11} /> Conectar</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
