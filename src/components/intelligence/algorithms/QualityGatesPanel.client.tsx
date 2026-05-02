"use client";

import { useEffect, useState, useCallback } from "react";
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw, ShieldCheck, Lock } from "lucide-react";
import { toast } from "sonner";

type Severity = "must" | "should";
type Category = "edge" | "capital" | "micro" | "ops";
type Tier = "TIER_1" | "TIER_2" | "NOT_READY";

interface GateBreakdown {
  gate_key:        string;
  name:            string;
  category:        Category;
  severity:        Severity;
  threshold_op:    string;
  threshold_value: number;
  unit:            string | null;
  description:     string;
  passed:          boolean | null;
  value_observed:  number | null;
  reason:          string | null;
  computed_at:     string | null;
}

interface Score {
  algorithm_id:     string;
  gates_total:      number;
  gates_passed:     number;
  must_failed:      number;
  should_failed:    number;
  last_computed_at: string | null;
  tier:             Tier;
}

interface ApiResponse {
  algorithm: { id: string; name: string; status: string };
  score:     Score;
  breakdown: GateBreakdown[];
}

const CATEGORY_LABEL: Record<Category, string> = {
  edge:    "Edge",
  capital: "Capital",
  micro:   "Microstructure",
  ops:     "Operations",
};

const TIER_BADGE: Record<Tier, { label: string; className: string }> = {
  TIER_1:    { label: "TIER 1 (Production-ready)",    className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" },
  TIER_2:    { label: "TIER 2 (Live OK, no shoulds)", className: "bg-amber-500/15 text-amber-300 border-amber-500/40" },
  NOT_READY: { label: "NOT READY",                     className: "bg-red-500/15 text-red-300 border-red-500/40" },
};

interface Props {
  algorithmId: string;
}

export default function QualityGatesPanel({ algorithmId }: Props) {
  const [data, setData]                 = useState<ApiResponse | null>(null);
  const [loading, setLoading]           = useState(true);
  const [recomputing, setRecomputing]   = useState(false);
  const [promoting, setPromoting]       = useState(false);
  const [expandedCats, setExpandedCats] = useState<Set<Category>>(new Set<Category>(["edge", "capital", "micro", "ops"]));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/algorithms/${algorithmId}/quality-gates`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
      setData(json);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error cargando gates");
    } finally {
      setLoading(false);
    }
  }, [algorithmId]);

  useEffect(() => { void load(); }, [load]);

  async function recompute() {
    setRecomputing(true);
    try {
      const res = await fetch(`/api/algorithms/${algorithmId}/quality-gates/recompute`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
      toast.success(`Score: ${json.score.gates_passed}/${json.score.gates_total} (${json.score.tier})`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error recomputando");
    } finally {
      setRecomputing(false);
    }
  }

  async function promote() {
    if (!confirm("¿Promover a LIVE? El bot empezará a operar con dinero real.")) return;
    setPromoting(true);
    try {
      const res = await fetch(`/api/algorithms/${algorithmId}/promote-to-live`, { method: "POST" });
      const json = await res.json();
      if (res.status === 403) {
        const failedKeys = (json.failed as Array<{ gate_key: string }>)?.map((f) => f.gate_key).join(", ");
        toast.error(`Bloqueado por gates: ${failedKeys}`);
      } else if (!res.ok) {
        throw new Error(json?.error ?? `HTTP ${res.status}`);
      } else {
        toast.success("Promovido a LIVE");
      }
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error promoviendo");
    } finally {
      setPromoting(false);
    }
  }

  function toggleCategory(c: Category) {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c); else next.add(c);
      return next;
    });
  }

  if (loading && !data) {
    return <div className="text-sm text-slate-400 px-4 py-6">Cargando quality gates…</div>;
  }
  if (!data) {
    return <div className="text-sm text-red-400 px-4 py-6">No se pudo cargar el panel.</div>;
  }

  const { score, breakdown } = data;
  const tier = TIER_BADGE[score.tier];
  const promoteBlocked = score.must_failed > 0 || score.gates_passed < 20;

  const groupedByCat: Record<Category, GateBreakdown[]> = {
    edge: [], capital: [], micro: [], ops: [],
  };
  for (const g of breakdown) groupedByCat[g.category].push(g);

  return (
    <div className="space-y-4">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl bg-[#0b1220] border border-cyan-500/20">
        <div className="flex items-center gap-4">
          <ShieldCheck className="w-8 h-8 text-cyan-400" />
          <div>
            <div className="text-3xl font-bold text-cyan-200">
              {score.gates_passed}<span className="text-slate-500 text-xl">/{score.gates_total || 20}</span>
            </div>
            <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${tier.className}`}>
              {tier.label}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={recompute}
            disabled={recomputing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${recomputing ? "animate-spin" : ""}`} />
            Recompute
          </button>
          <button
            onClick={promote}
            disabled={promoteBlocked || promoting}
            title={promoteBlocked ? `Bloqueado: ${score.must_failed} must-gates fallidas` : "Promover a live"}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25 enabled:hover:scale-[1.02] transition"
          >
            <Lock className="w-3.5 h-3.5" />
            {promoting ? "Promoviendo…" : "Promover a LIVE"}
          </button>
        </div>
      </header>

      {score.must_failed > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-200 text-xs">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span><strong>{score.must_failed} must-gates fallidas</strong> — el algoritmo no puede ir a live hasta resolverlas.</span>
        </div>
      )}

      {(["edge", "capital", "micro", "ops"] as Category[]).map((cat) => {
        const items = groupedByCat[cat];
        const passedCount = items.filter((i) => i.passed === true).length;
        const totalCount  = items.length;
        const expanded    = expandedCats.has(cat);

        return (
          <section key={cat} className="rounded-xl border border-slate-700/70 bg-slate-900/40 overflow-hidden">
            <button
              type="button"
              onClick={() => toggleCategory(cat)}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-800/50 transition"
              aria-expanded={expanded}
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                <span className="text-cyan-300">{CATEGORY_LABEL[cat]}</span>
                <span className="text-xs text-slate-400 font-normal">({passedCount}/{totalCount})</span>
              </div>
              <span className="text-xs text-slate-500">{expanded ? "▾" : "▸"}</span>
            </button>

            {expanded && (
              <ul className="divide-y divide-slate-800">
                {items.map((g) => {
                  const Icon = g.passed === true ? CheckCircle2 : g.passed === false ? XCircle : AlertTriangle;
                  const iconCls = g.passed === true ? "text-emerald-400" : g.passed === false ? "text-red-400" : "text-slate-500";
                  return (
                    <li key={g.gate_key} className="px-4 py-2.5 text-xs">
                      <div className="flex items-start gap-2">
                        <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${iconCls}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-slate-200">{g.name}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border ${
                              g.severity === "must" ? "text-red-300 border-red-500/40 bg-red-500/10" : "text-amber-300 border-amber-500/40 bg-amber-500/10"
                            }`}>
                              {g.severity.toUpperCase()}
                            </span>
                            {g.value_observed !== null && (
                              <span className="text-[10px] text-slate-400">
                                obs: <strong className="text-slate-200">{g.value_observed}</strong> {g.unit ?? ""}
                                {" "}<span className="text-slate-500">(thr {g.threshold_op} {g.threshold_value})</span>
                              </span>
                            )}
                          </div>
                          {g.reason && <div className="mt-1 text-[11px] text-slate-400 leading-relaxed">{g.reason}</div>}
                          {!g.reason && <div className="mt-0.5 text-[10px] text-slate-500 leading-relaxed">{g.description}</div>}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}

      {score.last_computed_at && (
        <p className="text-[10px] text-slate-500 text-right">Último compute: {new Date(score.last_computed_at).toLocaleString()}</p>
      )}
    </div>
  );
}
