"use client";

import { useEffect, useState, useCallback } from "react";
import { Check, X, AlertTriangle, TrendingUp } from "lucide-react";
import { toast } from "sonner";

interface Skill {
  id: string;
  instrument: string;
  status: "learning" | "pending_approval" | "approved" | "rejected" | "frozen";
  environment: "paper" | "live";
  model_version: number;
  epsilon_current: number;
  performance_before?: {
    sharpe: number;
    winRate: number;
    avgPnl: number;
    totalTrades: number;
    totalPnl: number;
  };
  created_at: string;
  updated_at: string;
}

interface AuditEntry {
  id: string;
  event_type: string;
  created_at: string;
  parameters?: {
    rl_episode_count?: number;
    rl_avg_reward?: number;
    llm_rules_generated?: number;
    epsilon_before?: number;
    epsilon_after?: number;
    performance_delta?: {
      sharpe_delta?: number;
      win_rate_delta?: number;
      avg_pnl_delta?: number;
    };
  };
}

const STATUS_COLORS: Record<string, string> = {
  learning: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  pending_approval: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  approved: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  rejected: "bg-red-500/20 text-red-400 border-red-500/30",
  frozen: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

export function SkillsPanel() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);
  const [countdownSecond, setCountdownSecond] = useState(3);

  const fetchSkills = useCallback(async () => {
    try {
      const res = await fetch("/api/bot/skills/list");
      if (!res.ok) return;
      const data = await res.json();
      setSkills(data.skills ?? []);
      setAuditLog(data.auditLog ?? []);
    } catch {
      toast.error("Error cargando skills");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSkills();
    const interval = setInterval(fetchSkills, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchSkills]);

  const approveSkill = async (skillId: string) => {
    if (approving === skillId) {
      if (countdownSecond > 1) {
        setCountdownSecond(countdownSecond - 1);
        return;
      }
      // Execute approval
      try {
        const res = await fetch("/api/bot/skills/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ skillId, approved: true }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        toast.success("Skill aprobado y activado para paper trading");
        setApproving(null);
        setCountdownSecond(3);
        await fetchSkills();
      } catch {
        toast.error("Error aprobando skill");
      }
    } else {
      // Start countdown
      setApproving(skillId);
      setCountdownSecond(3);
    }
  };

  const rejectSkill = async (skillId: string) => {
    if (confirm("¿Rechazar este skill?")) {
      try {
        const res = await fetch("/api/bot/skills/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ skillId, approved: false }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        toast.success("Skill rechazado");
        await fetchSkills();
      } catch {
        toast.error("Error rechazando skill");
      }
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-white/10 bg-[#0a0a0f] p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="h-6 w-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin mx-auto mb-2" />
          <p className="text-sm text-white/40">Cargando skills...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* WARNING BANNER */}
      <div className="rounded-xl border border-red-500/40 bg-red-500/15 p-3 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-red-400">⚠️ SKILLS — SOLO PAPER TRADING</p>
          <p className="text-xs text-red-300/70">
            Los skills NUNCA se aplican en live trading automaticamente. Solo se usan en simulations
            de paper trading. Toda aplicacion en live requiere aprobacion manual explícita.
          </p>
        </div>
      </div>

      {/* SKILLS LIST */}
      <div className="space-y-3">
        {skills.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-center">
            <p className="text-sm text-white/40">Sin skills disponibles</p>
          </div>
        ) : (
          skills.map((skill) => {
            const isPending = skill.status === "pending_approval";
            const isApproving = approving === skill.id;
            const perf = skill.performance_before;

            return (
              <div
                key={skill.id}
                className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3"
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-white/40" />
                      <span className="font-mono text-sm text-white/70">
                        {skill.instrument} v{skill.model_version}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded border ${
                          STATUS_COLORS[skill.status] ?? "border-white/10 text-white/40"
                        }`}
                      >
                        {skill.status.replace("_", " ")}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded border border-white/10 text-white/40">
                        {skill.environment}
                      </span>
                    </div>
                    <p className="text-xs text-white/30 mt-1">
                      Actualizado:{" "}
                      {new Date(skill.updated_at).toLocaleDateString("es-ES", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-white/30">Exploracion</p>
                    <p className="font-mono text-sm text-white/70">
                      {(skill.epsilon_current * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>

                {/* Performance Metrics */}
                {perf && (
                  <div className="grid grid-cols-3 gap-2 py-2 px-3 bg-white/[0.03] rounded-lg">
                    <div>
                      <p className="text-xs text-white/30">Sharpe</p>
                      <p className={`font-mono text-sm ${perf.sharpe > 0 ? "text-emerald-400" : "text-white/60"}`}>
                        {perf.sharpe.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-white/30">Win Rate</p>
                      <p className="font-mono text-sm text-white/70">
                        {(perf.winRate * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-white/30">Avg PnL</p>
                      <p
                        className={`font-mono text-sm ${perf.avgPnl > 0 ? "text-emerald-400" : "text-red-400"}`}
                      >
                        ${perf.avgPnl.toFixed(2)}
                      </p>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                {isPending && (
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => approveSkill(skill.id)}
                      disabled={false}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        isApproving
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse"
                          : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30"
                      }`}
                    >
                      <Check className="h-4 w-4" />
                      {isApproving ? `Approving (${countdownSecond}s)` : "Aprobar"}
                    </button>
                    <button
                      onClick={() => rejectSkill(skill.id)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors"
                    >
                      <X className="h-4 w-4" />
                      Rechazar
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* AUDIT LOG */}
      {auditLog.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-2">
          <h3 className="text-sm font-semibold text-white/70 mb-3">Historial de eventos</h3>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {auditLog.slice(-20).map((entry) => (
              <div key={entry.id} className="text-xs text-white/50 flex justify-between">
                <span>
                  {entry.event_type.replace(/_/g, " ")}
                  {entry.parameters?.rl_episode_count && ` (${entry.parameters.rl_episode_count} trades)`}
                </span>
                <span className="font-mono">
                  {new Date(entry.created_at).toLocaleDateString("es-ES", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
