"use client";
import { useState, useEffect } from "react";
import { X, Rocket, Server } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/browser";
import type { TradingAlgorithm } from "@/types/algorithms";

interface BotAccount { id: string; label: string; account_id: string; }

interface Props {
  algo: TradingAlgorithm;
  onClose: () => void;
  onDeployed: () => void;
}

export default function AlgorithmDeployModal({ algo, onClose, onDeployed }: Props) {
  const [accounts, setAccounts]       = useState<BotAccount[]>([]);
  const [selected, setSelected]       = useState<string[]>([]);
  const [notes, setNotes]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [fetching, setFetching]       = useState(true);

  const activeIds = (algo.deployments ?? [])
    .filter((d) => d.status === "active")
    .map((d) => d.bot_account_id);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("bot_accounts")
      .select("id, label, account_id")
      .then(({ data }) => {
        setAccounts(data ?? []);
        setFetching(false);
      });
  }, []);

  const toggle = (id: string) =>
    setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);

  async function handleDeploy() {
    if (selected.length === 0) { toast.error("Selecciona al menos una cuenta"); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/algorithms/${algo.id}/deploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_account_ids: selected, notes: notes || undefined }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { toast.error(data.error ?? "Error al desplegar"); return; }
      toast.success(`"${algo.name}" desplegado en ${selected.length} cuenta${selected.length > 1 ? "s" : ""}`);
      onDeployed();
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Rocket className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-slate-100">Deploy — {algo.name}</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-500">
            Selecciona las cuentas de {algo.platform} donde se activará este algoritmo.
            Las cuentas ya activas se actualizarán.
          </p>

          {fetching ? (
            <div className="text-xs text-slate-500 text-center py-4">Cargando cuentas...</div>
          ) : accounts.length === 0 ? (
            <div className="text-xs text-slate-500 text-center py-4">
              No hay cuentas bot configuradas. Ve a Bot Control para agregar una.
            </div>
          ) : (
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {accounts.map((acc) => {
                const isActive  = activeIds.includes(acc.id);
                const isSel     = selected.includes(acc.id);
                return (
                  <button key={acc.id} type="button"
                    onClick={() => toggle(acc.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
                      isSel ? "border-emerald-700 bg-emerald-950/40" : "border-slate-800 bg-slate-800/50 hover:border-slate-600"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                      isSel ? "bg-emerald-600 border-emerald-500" : "border-slate-600"}`}>
                      {isSel && <span className="text-white text-xs">✓</span>}
                    </div>
                    <Server className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-200 truncate">{acc.label}</p>
                      <p className="text-xs text-slate-500 font-mono">{acc.account_id}</p>
                    </div>
                    {isActive && (
                      <span className="text-xs text-emerald-400 bg-emerald-950 border border-emerald-800 px-1.5 py-0.5 rounded flex-shrink-0">activo</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs text-slate-500 uppercase tracking-wide">Notas (opcional)</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Motivo del deploy, configuración especial..."
              maxLength={300}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs px-3 py-2 focus:outline-none focus:border-slate-500"
            />
          </div>
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-slate-800">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-slate-700 text-slate-400 text-sm hover:border-slate-600 transition-all">
            Cancelar
          </button>
          <button
            onClick={handleDeploy}
            disabled={loading || selected.length === 0}
            className="flex-1 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-semibold transition-all disabled:opacity-50"
          >
            {loading ? "Desplegando..." : `Deploy en ${selected.length || "?"} cuenta${selected.length !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
