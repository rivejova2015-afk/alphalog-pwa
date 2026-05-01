"use client";
import { useState, useEffect, useRef } from "react";
import { Zap, Grid3x3, ArrowLeftRight, Play, CheckCircle, Rocket, Pause, Trash2, MoreHorizontal, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import type { TradingAlgorithm, AlgoType } from "@/types/algorithms";
import { ALGO_STATUS_LABELS, ALGO_STATUS_COLORS, ALGO_TYPE_LABELS, ALGO_TYPE_COLORS } from "@/types/algorithms";

const TYPE_ICONS: Record<AlgoType, React.ReactNode> = {
  scalping:    <Zap className="w-4 h-4" />,
  grid_basket: <Grid3x3 className="w-4 h-4" />,
  arbitrage:   <ArrowLeftRight className="w-4 h-4" />,
};

interface Props {
  algo: TradingAlgorithm;
  onRefresh: () => void;
  onDeploy:  (algo: TradingAlgorithm) => void;
}

export default function AlgorithmCard({ algo, onRefresh, onDeploy }: Props) {
  const [menu, setMenu]             = useState(false);
  const [loading, setLoading]       = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menu]);

  async function transition(toStatus: string) {
    setLoading(true);
    try {
      if (toStatus === "paper") {
        const res = await fetch(`/api/algorithms/${algo.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "paper" }),
        });
        if (!res.ok) { toast.error("Error al iniciar paper test"); return; }
        toast.success("Paper test iniciado");
      } else if (toStatus === "approved") {
        const res = await fetch(`/api/algorithms/${algo.id}/approve`, { method: "POST" });
        if (!res.ok) { toast.error("Error al aprobar"); return; }
        toast.success("Algoritmo aprobado");
      } else if (toStatus === "paused") {
        const res = await fetch(`/api/algorithms/${algo.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "paused" }),
        });
        if (!res.ok) { toast.error("Error al pausar"); return; }
        toast.success("Algoritmo pausado");
      }
      onRefresh();
    } finally {
      setLoading(false);
      setMenu(false);
    }
  }

  async function handleDelete() {
    setMenu(false);
    setConfirmDelete(true);
  }

  async function confirmDeleteAction() {
    setConfirmDelete(false);
    setLoading(true);
    try {
      const res = await fetch(`/api/algorithms/${algo.id}`, { method: "DELETE" });
      if (!res.ok) { toast.error("Error al eliminar"); return; }
      toast.success(`"${algo.name}" eliminado`);
      onRefresh();
    } finally { setLoading(false); }
  }

  const activeDeployments = (algo.deployments ?? []).filter((d) => d.status === "active");
  const bt = algo.backtest;
  const paper = algo.paper_stats;

  const winRateDisplay = bt?.win_rate ?? paper?.win_rate ?? null;
  const pnlDisplay     = bt?.net_profit ?? paper?.total_pnl ?? null;

  return (
    <div className={`relative rounded-2xl border bg-slate-900 p-4 flex flex-col gap-3 transition-all hover:border-slate-600 ${
      algo.status === "live"   ? "border-emerald-800/60 shadow-[0_0_20px_rgba(16,185,129,0.06)]" :
      algo.status === "paper"  ? "border-yellow-800/60" :
      algo.status === "archived" ? "border-slate-800 opacity-50" :
      "border-slate-800"
    }`}>

      {/* Slot badge */}
      <span className="absolute top-3 right-10 text-xs font-mono text-slate-600">#{algo.slot_number}</span>

      {/* Menu button */}
      <button
        onClick={() => setMenu((m) => !m)}
        className="absolute top-3 right-3 text-slate-600 hover:text-slate-300 transition-colors"
        aria-label="Opciones"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {menu && (
        <div ref={menuRef} className="absolute top-8 right-3 z-10 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden min-w-[140px]">
          {algo.status === "draft"    && <MenuItem label="Iniciar Paper Test" icon={<Play className="w-3 h-3" />} onClick={() => transition("paper")} />}
          {algo.status === "paper"    && <MenuItem label="Aprobar"     icon={<CheckCircle className="w-3 h-3" />} onClick={() => transition("approved")} />}
          {algo.status === "approved" && <MenuItem label="Deploy Live" icon={<Rocket className="w-3 h-3" />}     onClick={() => { setMenu(false); onDeploy(algo); }} />}
          {algo.status === "live"     && <MenuItem label="Pausar"      icon={<Pause className="w-3 h-3" />}      onClick={() => transition("paused")} />}
          {algo.status === "paused"   && <MenuItem label="Reanudar"    icon={<Play className="w-3 h-3" />}       onClick={() => transition("approved")} />}
          <MenuItem label="Eliminar" icon={<Trash2 className="w-3 h-3" />} onClick={handleDelete} danger />
        </div>
      )}

      {confirmDelete && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-2xl bg-slate-900/95 backdrop-blur-sm border border-red-800/60 p-4">
          <AlertTriangle className="w-6 h-6 text-red-400" />
          <p className="text-xs text-slate-300 text-center font-medium">
            ¿Eliminar <span className="text-slate-100 font-semibold">&quot;{algo.name}&quot;</span>?<br />
            <span className="text-slate-500">Se detendrán todos los deploys activos.</span>
          </p>
          <div className="flex gap-2 w-full">
            <button onClick={() => setConfirmDelete(false)}
              className="flex-1 py-1.5 rounded-lg border border-slate-700 text-slate-400 text-xs hover:border-slate-500 transition-all">
              Cancelar
            </button>
            <button onClick={confirmDeleteAction} disabled={loading}
              className="flex-1 py-1.5 rounded-lg bg-red-700 hover:bg-red-600 text-white text-xs font-semibold transition-all disabled:opacity-50">
              Eliminar
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="pr-14">
        <h3 className="font-semibold text-slate-100 text-sm leading-tight truncate">{algo.name}</h3>
        {algo.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{algo.description}</p>}
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5">
        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${ALGO_TYPE_COLORS[algo.algo_type]}`}>
          {TYPE_ICONS[algo.algo_type]} {ALGO_TYPE_LABELS[algo.algo_type]}
        </span>
        <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${ALGO_STATUS_COLORS[algo.status]}`}>
          {ALGO_STATUS_LABELS[algo.status]}
        </span>
      </div>

      {/* Metrics row */}
      {(winRateDisplay !== null || pnlDisplay !== null) && (
        <div className="flex gap-3 border-t border-slate-800 pt-2">
          {winRateDisplay !== null && (
            <div className="flex items-center gap-1 text-xs">
              {winRateDisplay >= 50
                ? <TrendingUp className="w-3 h-3 text-emerald-500" />
                : <TrendingDown className="w-3 h-3 text-red-500" />}
              <span className="text-slate-400">Win</span>
              <span className={`font-mono font-semibold ${winRateDisplay >= 50 ? "text-emerald-400" : "text-red-400"}`}>
                {winRateDisplay.toFixed(1)}%
              </span>
            </div>
          )}
          {pnlDisplay !== null && (
            <div className="flex items-center gap-1 text-xs">
              <span className="text-slate-400">PnL</span>
              <span className={`font-mono font-semibold ${pnlDisplay >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {pnlDisplay >= 0 ? "+" : ""}{pnlDisplay.toFixed(2)}
              </span>
            </div>
          )}
          {bt?.profit_factor !== null && bt?.profit_factor !== undefined && (
            <div className="flex items-center gap-1 text-xs">
              <span className="text-slate-400">PF</span>
              <span className="font-mono text-blue-400">{bt.profit_factor.toFixed(2)}</span>
            </div>
          )}
        </div>
      )}

      {/* Deployments */}
      {activeDeployments.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Rocket className="w-3 h-3 text-emerald-500" />
          <span>Activo en {activeDeployments.length} cuenta{activeDeployments.length > 1 ? "s" : ""}</span>
        </div>
      )}

      {/* CTA button */}
      {algo.status === "draft" && (
        <button
          disabled={loading}
          onClick={() => transition("paper")}
          className="mt-auto w-full py-1.5 rounded-lg bg-yellow-900/60 border border-yellow-800 text-yellow-300 text-xs font-semibold hover:bg-yellow-900 transition-all disabled:opacity-50"
        >
          Iniciar Paper Test
        </button>
      )}
      {algo.status === "paper" && (
        <button
          disabled={loading}
          onClick={() => transition("approved")}
          className="mt-auto w-full py-1.5 rounded-lg bg-blue-900/60 border border-blue-800 text-blue-300 text-xs font-semibold hover:bg-blue-900 transition-all disabled:opacity-50"
        >
          Aprobar
        </button>
      )}
      {algo.status === "approved" && (
        <button
          onClick={() => onDeploy(algo)}
          className="mt-auto w-full py-1.5 rounded-lg bg-emerald-900/60 border border-emerald-800 text-emerald-300 text-xs font-semibold hover:bg-emerald-900 transition-all"
        >
          Deploy Live
        </button>
      )}
    </div>
  );
}

function MenuItem({ label, icon, onClick, danger }: {
  label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-slate-700 transition-colors text-left ${
        danger ? "text-red-400 hover:text-red-300" : "text-slate-300"}`}
    >
      {icon} {label}
    </button>
  );
}
