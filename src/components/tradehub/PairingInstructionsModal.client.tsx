"use client";

import { useState, useEffect } from "react";
import { Copy, Download, X, Check } from "lucide-react";
import { toast } from "sonner";

interface Props {
  token: string;
  expiresAt: string;
  expiresInMinutes: number;
  onClose: () => void;
}

export default function PairingInstructionsModal({ token, expiresAt, expiresInMinutes, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    const tick = () => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      setSecondsLeft(Math.max(0, Math.floor(ms / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const copyToken = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      toast.success("Token copiado");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  const minsLeft = Math.floor(secondsLeft / 60);
  const secsLeft = secondsLeft % 60;
  const expired = secondsLeft <= 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Instrucciones de emparejamiento MT5"
    >
      <div className="w-full max-w-lg rounded-lg bg-slate-900 border border-slate-800 p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-50">Vincula tu MT5</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-slate-300 mb-4">
          Cuenta creada. Sigue estos pasos en tu terminal MT5 para que el balance se sincronice automáticamente:
        </p>

        <div className="space-y-3 text-sm text-slate-300">
          <Step n={1}>
            Descarga el EA:
            <a
              href="/ea/AlphaLogTelemetry.ex5"
              download
              className="ml-2 inline-flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs"
            >
              <Download size={12} /> AlphaLogTelemetry.ex5
            </a>
          </Step>

          <Step n={2}>
            Cópialo en <code className="bg-slate-800 px-1.5 py-0.5 rounded text-xs">&lt;MT5&gt;/MQL5/Experts/</code>
          </Step>

          <Step n={3}>
            En MT5: <em>Tools → Options → Expert Advisors → Allow WebRequest for:</em>
            <code className="block mt-1 bg-slate-800 px-2 py-1 rounded text-xs font-mono">https://alphalog.io</code>
          </Step>

          <Step n={4}>
            Refresca la lista de Experts (F5 en Navigator) y arrastra <code className="bg-slate-800 px-1.5 py-0.5 rounded text-xs">AlphaLogTelemetry</code> a cualquier chart.
          </Step>

          <Step n={5}>
            En el diálogo de inputs, pega este token en <code className="bg-slate-800 px-1.5 py-0.5 rounded text-xs">InpPairingToken</code>:
            <div className="mt-2 flex items-stretch gap-2">
              <code className={`flex-1 px-3 py-2 rounded font-mono text-base font-bold tracking-wider text-center ${expired ? "bg-red-900/40 text-red-300 line-through" : "bg-slate-800 text-cyan-300"}`}>
                {token}
              </code>
              <button
                type="button"
                onClick={copyToken}
                disabled={expired}
                className="px-3 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded text-xs font-semibold flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>
            <p className={`text-xs mt-1 ${expired ? "text-red-400" : "text-slate-500"}`}>
              {expired
                ? "Token expirado. Cierra este modal y crea una nueva cuenta para regenerarlo."
                : `Expira en ${minsLeft}:${String(secsLeft).padStart(2, "0")} (configurado para ${expiresInMinutes} min)`}
            </p>
          </Step>

          <Step n={6}>
            Activa <strong className="text-slate-100">Algo Trading</strong> (botón verde en la barra superior de MT5). El balance aparecerá aquí en ~30 segundos.
          </Step>
        </div>

        <div className="mt-6 p-3 bg-slate-800/60 border border-slate-700 rounded text-xs text-slate-400">
          <strong className="text-slate-200">Tip:</strong> el EA solo lee balance, equity y conteo de posiciones — no ejecuta órdenes.
          Funciona junto a tu trading manual o cualquier otro EA en el mismo terminal.
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 font-medium rounded transition"
        >
          Listo
        </button>
      </div>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-600 text-white text-xs font-bold flex items-center justify-center">{n}</span>
      <div className="flex-1 pt-0.5">{children}</div>
    </div>
  );
}
