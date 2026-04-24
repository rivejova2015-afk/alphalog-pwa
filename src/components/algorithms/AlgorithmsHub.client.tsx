"use client";
import { useState, useEffect, useCallback } from "react";
import { Plus, Bot, Search, SlidersHorizontal, Upload } from "lucide-react";
import { toast } from "sonner";
import type { TradingAlgorithm, AlgoPlatform, AlgoType, AlgoStatus, AlgorithmBacktestResult } from "@/types/algorithms";
import { ALGO_TYPE_LABELS, ALGO_STATUS_LABELS, MAX_ALGORITHMS_PER_PLATFORM } from "@/types/algorithms";
import AlgorithmCard        from "./AlgorithmCard.client";
import AlgorithmWizard      from "./AlgorithmWizard.client";
import AlgorithmDeployModal from "./AlgorithmDeployModal.client";

type FilterStatus = AlgoStatus | "all";
type FilterType   = AlgoType  | "all";

// ─── Import Backtest Modal ────────────────────────────────────────────────────

function ImportBacktestModal({ algoId, platform, onClose, onImported }: {
  algoId: string; platform: AlgoPlatform; onClose: () => void; onImported: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm]     = useState({
    total_trades: "", win_rate: "", profit_factor: "", max_drawdown: "",
    net_profit: "", sharpe_ratio: "", recovery_factor: "",
    period_start: "", period_end: "",
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit() {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { platform };
      const nums = ["total_trades","win_rate","profit_factor","max_drawdown","net_profit","sharpe_ratio","recovery_factor"];
      nums.forEach((k) => { if (form[k as keyof typeof form]) payload[k] = Number(form[k as keyof typeof form]); });
      if (form.period_start) payload.period_start = form.period_start;
      if (form.period_end)   payload.period_end   = form.period_end;

      const res = await fetch(`/api/algorithms/${algoId}/backtest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { toast.error("Error al importar backtest"); return; }
      toast.success("Resultado de backtest importado");
      onImported();
    } finally { setSaving(false); }
  }

  const field = (label: string, key: string, type = "number", placeholder = "") => (
    <div className="space-y-1">
      <label className="text-xs text-slate-500 uppercase tracking-wide block">{label}</label>
      <input type={type} value={form[key as keyof typeof form]}
        onChange={(e) => set(key, e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm px-3 py-1.5 focus:outline-none focus:border-slate-500" />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-slate-100">Importar resultado de backtest</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xs">✕</button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-3">
          {field("Total trades", "total_trades")}
          {field("Win rate (%)", "win_rate", "number", "e.g. 56.4")}
          {field("Profit factor", "profit_factor", "number", "e.g. 1.45")}
          {field("Max drawdown (%)", "max_drawdown", "number", "e.g. 12.3")}
          {field("Net profit ($)", "net_profit", "number", "e.g. 2340")}
          {field("Sharpe ratio", "sharpe_ratio", "number", "e.g. 1.2")}
          {field("Recovery factor", "recovery_factor", "number", "e.g. 3.1")}
          <div className="col-span-2 border-t border-slate-800 pt-3 grid grid-cols-2 gap-3">
            {field("Período inicio", "period_start", "date")}
            {field("Período fin",   "period_end",   "date")}
          </div>
        </div>
        <div className="flex gap-3 px-5 py-4 border-t border-slate-800">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-slate-700 text-slate-400 text-sm hover:border-slate-600">Cancelar</button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 py-2 rounded-lg bg-blue-700 hover:bg-blue-600 text-white text-sm font-semibold disabled:opacity-50">
            {saving ? "Importando..." : "Importar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Slot grid visual ────────────────────────────────────────────────────────

function SlotGrid({ total, used, platform }: { total: number; used: number; platform: AlgoPlatform }) {
  const pct = Math.round((used / total) * 100);
  const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-orange-500" : "bg-emerald-500";
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 flex items-center gap-3">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-slate-400 font-medium">{platform} — Capacidad</span>
          <span className="text-xs font-mono text-slate-300">{used}/{total}</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
          <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <Bot className={`w-5 h-5 flex-shrink-0 ${used >= total ? "text-red-400" : "text-slate-600"}`} />
    </div>
  );
}

// ─── Main Hub ────────────────────────────────────────────────────────────────

export default function AlgorithmsHub() {
  const [platform, setPlatform]     = useState<AlgoPlatform>("MT5");
  const [algorithms, setAlgorithms] = useState<TradingAlgorithm[]>([]);
  const [loading, setLoading]       = useState(true);

  const [search, setSearch]         = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterType,   setFilterType]   = useState<FilterType>("all");

  const [showWizard,  setShowWizard]  = useState(false);
  const [deployAlgo,  setDeployAlgo]  = useState<TradingAlgorithm | null>(null);
  const [importAlgo,  setImportAlgo]  = useState<string | null>(null);

  const fetchAlgorithms = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/algorithms?platform=${platform}`);
      const data = await res.json() as { algorithms?: TradingAlgorithm[]; error?: string };
      if (res.ok) setAlgorithms(data.algorithms ?? []);
      else toast.error(data.error ?? "Error al cargar algoritmos");
    } finally { setLoading(false); }
  }, [platform]);

  useEffect(() => { void fetchAlgorithms(); }, [fetchAlgorithms]);

  const usedSlots    = algorithms.filter((a) => a.status !== "archived").map((a) => a.slot_number);
  const totalUsed    = algorithms.filter((a) => a.status !== "archived").length;
  const canAddMore   = totalUsed < MAX_ALGORITHMS_PER_PLATFORM;

  const filtered = algorithms.filter((a) => {
    if (filterStatus !== "all" && a.status !== filterStatus) return false;
    if (filterType   !== "all" && a.algo_type !== filterType) return false;
    if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const liveCount     = algorithms.filter((a) => a.status === "live").length;
  const paperCount    = algorithms.filter((a) => a.status === "paper").length;
  const approvedCount = algorithms.filter((a) => a.status === "approved").length;

  return (
    <div className="space-y-6">
      {/* Platform tabs */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-1 p-1 rounded-xl bg-slate-800/80 border border-slate-700">
          {(["MT5", "MT4"] as AlgoPlatform[]).map((p) => (
            <button key={p} onClick={() => setPlatform(p)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                platform === p
                  ? "bg-slate-700 text-slate-100 shadow"
                  : "text-slate-500 hover:text-slate-300"}`}
            >
              {p}
            </button>
          ))}
        </div>

        <button
          disabled={!canAddMore}
          onClick={() => setShowWizard(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-200 text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          Nuevo algoritmo
          {!canAddMore && <span className="text-xs text-red-400 ml-1">(límite)</span>}
        </button>
      </div>

      {/* Capacity + stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SlotGrid total={MAX_ALGORITHMS_PER_PLATFORM} used={totalUsed} platform={platform} />
        <StatTile label="Live" value={liveCount}     color="text-emerald-400" />
        <StatTile label="Paper Test"  value={paperCount}    color="text-yellow-400" />
        <StatTile label="Aprobados"   value={approvedCount} color="text-blue-400" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar algoritmo..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-slate-500" />
        </div>
        <div className="flex items-center gap-1">
          <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
          <select value={filterType} onChange={(e) => setFilterType(e.target.value as FilterType)}
            className="rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-xs px-2 py-1.5 focus:outline-none">
            <option value="all">Todos los tipos</option>
            {(["scalping","grid_basket","arbitrage"] as AlgoType[]).map((t) => (
              <option key={t} value={t}>{ALGO_TYPE_LABELS[t]}</option>
            ))}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
            className="rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-xs px-2 py-1.5 focus:outline-none">
            <option value="all">Todos los estados</option>
            {(["draft","paper","approved","live","paused","archived"] as AlgoStatus[]).map((s) => (
              <option key={s} value={s}>{ALGO_STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-44 rounded-2xl border border-slate-800 bg-slate-900 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Bot className="w-12 h-12 text-slate-700 mb-4" />
          <p className="text-slate-400 font-medium">
            {algorithms.length === 0
              ? `No hay algoritmos en ${platform} todavía`
              : "No hay algoritmos que coincidan con los filtros"}
          </p>
          {algorithms.length === 0 && (
            <button onClick={() => setShowWizard(true)}
              className="mt-4 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-sm transition-all">
              Crear primer algoritmo
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((algo) => (
            <div key={algo.id} className="relative">
              <AlgorithmCard
                algo={algo}
                onRefresh={fetchAlgorithms}
                onDeploy={(a) => setDeployAlgo(a)}
              />
              {/* Backtest import button */}
              <button
                onClick={() => setImportAlgo(algo.id)}
                title="Importar resultado de backtest de MT Strategy Tester"
                className="absolute bottom-14 right-3 text-slate-600 hover:text-blue-400 transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {showWizard && (
        <AlgorithmWizard
          platform={platform}
          usedSlots={usedSlots}
          onClose={() => setShowWizard(false)}
          onCreated={() => { setShowWizard(false); void fetchAlgorithms(); }}
        />
      )}
      {deployAlgo && (
        <AlgorithmDeployModal
          algo={deployAlgo}
          onClose={() => setDeployAlgo(null)}
          onDeployed={() => { setDeployAlgo(null); void fetchAlgorithms(); }}
        />
      )}
      {importAlgo && (
        <ImportBacktestModal
          algoId={importAlgo}
          platform={platform}
          onClose={() => setImportAlgo(null)}
          onImported={() => { setImportAlgo(null); void fetchAlgorithms(); }}
        />
      )}
    </div>
  );
}

function StatTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 flex flex-col gap-1">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-2xl font-bold font-mono ${color}`}>{value}</span>
    </div>
  );
}
