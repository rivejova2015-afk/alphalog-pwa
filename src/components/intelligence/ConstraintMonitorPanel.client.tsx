"use client";

import { CheckCircle2, AlertTriangle, AlertOctagon, ShieldCheck } from "lucide-react";
import { EmptyState } from "@/components/ui";
import type { ConstraintMonitorData, ConstraintItem, ConstraintStatus } from "@/lib/intelligence/metrics";

interface Props {
  data: ConstraintMonitorData;
}

const STATUS_STYLE: Record<ConstraintStatus, { color: string; bg: string; border: string; Icon: typeof CheckCircle2; label: string }> = {
  ok:       { color: "#34d399", bg: "#34d399/5",  border: "#34d399/30", Icon: CheckCircle2,  label: "OK" },
  warning:  { color: "#eab308", bg: "#eab308/5",  border: "#eab308/30", Icon: AlertTriangle, label: "WARNING" },
  critical: { color: "#ef4444", bg: "#ef4444/5",  border: "#ef4444/30", Icon: AlertOctagon,  label: "CRITICAL" },
};

export function ConstraintMonitorPanel({ data }: Props) {
  if (!data.authenticated || data.constraints.length === 0) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="Sin datos para evaluar"
        message="Registra trades y entradas en journal para ver tus constraints en acción."
      />
    );
  }

  const okCount = data.constraints.filter((c) => c.status === "ok").length;
  const warnCount = data.constraints.filter((c) => c.status === "warning").length;
  const criticalCount = data.blockedCount;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-2">
        <Tile label="OK"       value={okCount}       accent="#34d399" />
        <Tile label="Warning"  value={warnCount}     accent="#eab308" />
        <Tile label="Critical" value={criticalCount} accent="#ef4444" />
      </div>

      <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {data.constraints.map((c) => (
          <ConstraintCard key={c.id} item={c} />
        ))}
      </ul>

      {criticalCount > 0 && (
        <section className="rounded-lg border border-[#ef4444]/30 bg-[#ef4444]/5 p-4">
          <p className="text-sm font-bold text-[#ef4444] mb-1">
            ⚠ {criticalCount} constraint{criticalCount > 1 ? "s" : ""} en estado crítico
          </p>
          <p className="text-xs text-[#94a3b8]">
            Considera pausar nuevas operaciones hasta normalizar los indicadores en rojo.
          </p>
        </section>
      )}
    </div>
  );
}

function ConstraintCard({ item }: { item: ConstraintItem }) {
  const style = STATUS_STYLE[item.status];
  const Icon = style.Icon;
  return (
    <li
      className="rounded-lg border p-4"
      style={{
        borderColor: `${style.color}40`,
        backgroundColor: `${style.color}08`,
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-[#e2e8f0]">{item.title}</h3>
        <span
          className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider rounded border px-1.5 py-0.5"
          style={{ color: style.color, borderColor: `${style.color}50` }}
        >
          <Icon size={11} />
          {style.label}
        </span>
      </div>
      <div className="text-xs text-[#94a3b8] mb-1">
        <span className="font-mono">{item.metric}</span>
        <span className="text-[#475569] mx-1">·</span>
        <span>target {item.target}</span>
      </div>
      <p className="text-xs mt-2 text-[#e2e8f0] leading-relaxed">{item.suggestion}</p>
    </li>
  );
}

function Tile({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-lg border border-[#1f2937] bg-[#0a0e1a] p-3">
      <p className="text-[10px] uppercase tracking-wider text-[#475569]">{label}</p>
      <p className="text-2xl font-bold font-mono mt-1" style={{ color: accent }}>{value}</p>
    </div>
  );
}
