"use client";

import { NotebookPen, Smile, TrendingUp, TrendingDown, Minus, Lightbulb, Tags } from "lucide-react";
import { EmptyState } from "@/components/ui";
import type { MindOpsData } from "@/lib/intelligence/metrics";

interface Props {
  data: MindOpsData;
}

const fmtScore = (n: number) => (n > 0 ? n.toFixed(1) : "—");
const fmtCurrency = (n: number | null) =>
  n === null
    ? "—"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const BIAS_LABEL: Record<MindOpsData["moodOutcomeCorrelation"]["biasSignal"], { txt: string; color: string; Icon: typeof TrendingUp }> = {
  positive: { txt: "Sesgo positivo · mood alto ≈ mejores trades", color: "#34d399", Icon: TrendingUp },
  negative: { txt: "Sesgo negativo · mood alto ≈ peores trades (revenge / overconfidence)", color: "#ef4444", Icon: TrendingDown },
  neutral:  { txt: "Sin sesgo claro entre mood y outcome", color: "#94a3b8", Icon: Minus },
};

export function MindOpsPanel({ data }: Props) {
  if (!data.authenticated || data.entries30d === 0) {
    return (
      <EmptyState
        icon={NotebookPen}
        title="Sin entradas de journal"
        message="Empieza a escribir en /business/journal para que MindOps analice patrones."
      />
    );
  }

  const bias = BIAS_LABEL[data.moodOutcomeCorrelation.biasSignal];
  const BiasIcon = bias.Icon;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Tile label="Entries 7d"  value={data.entries7d.toString()}  accent="#22d3ee" />
        <Tile label="Entries 30d" value={data.entries30d.toString()} accent="#22d3ee" />
        <Tile
          label="Mood score 7d"
          value={fmtScore(data.moodScore7d)}
          accent={data.moodScore7d >= 6 ? "#34d399" : data.moodScore7d >= 4 ? "#eab308" : "#ef4444"}
        />
        <Tile
          label="Mood score 30d"
          value={fmtScore(data.moodScore30d)}
          accent={data.moodScore30d >= 6 ? "#34d399" : data.moodScore30d >= 4 ? "#eab308" : "#ef4444"}
        />
      </div>

      <section className="rounded-lg border p-4" style={{ borderColor: `${bias.color}40`, backgroundColor: `${bias.color}08` }}>
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#94a3b8] mb-3 flex items-center gap-2">
          <BiasIcon size={14} style={{ color: bias.color }} /> Mood ↔ Outcome correlation
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#475569]">PnL promedio · mood alto</p>
            <p className="text-lg font-bold font-mono text-[#34d399]">
              {fmtCurrency(data.moodOutcomeCorrelation.highMoodAvgPnl)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#475569]">PnL promedio · mood bajo</p>
            <p className="text-lg font-bold font-mono text-[#ef4444]">
              {fmtCurrency(data.moodOutcomeCorrelation.lowMoodAvgPnl)}
            </p>
          </div>
        </div>
        <p className="text-xs mt-3" style={{ color: bias.color }}>
          {bias.txt}
        </p>
        <p className="text-[10px] text-[#475569] mt-1">
          Muestra: {data.moodOutcomeCorrelation.correlationSampleSize} trades con journal en ±2 días
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-lg border border-[#1f2937] bg-[#0a0e1a] p-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#94a3b8] mb-3 flex items-center gap-2">
            <Smile size={14} /> Mood breakdown
          </h2>
          {data.moodBreakdown.length === 0 ? (
            <p className="text-xs text-[#475569]">Sin datos.</p>
          ) : (
            <ul className="space-y-1.5">
              {data.moodBreakdown.map((m) => (
                <li key={m.mood} className="flex items-center justify-between text-sm">
                  <span className="text-[#e2e8f0] capitalize">{m.mood}</span>
                  <span className="font-mono text-[#94a3b8]">{m.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-[#1f2937] bg-[#0a0e1a] p-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#94a3b8] mb-3 flex items-center gap-2">
            <Tags size={14} /> Top tags
          </h2>
          {data.topTags.length === 0 ? (
            <p className="text-xs text-[#475569]">Sin tags.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {data.topTags.map((t) => (
                <span key={t.tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-[#22d3ee]/10 text-[#22d3ee] border border-[#22d3ee]/30">
                  {t.tag} <span className="text-[10px] text-[#94a3b8]">·{t.count}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {data.actionItems.length > 0 && (
        <section className="rounded-lg border border-[#a78bfa]/30 bg-[#a78bfa]/5 p-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#94a3b8] mb-3 flex items-center gap-2">
            <Lightbulb size={14} className="text-[#a78bfa]" /> Acciones recomendadas
          </h2>
          <ul className="space-y-2 text-sm text-[#e2e8f0]">
            {data.actionItems.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-[#a78bfa] mt-0.5">→</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Tile({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-lg border border-[#1f2937] bg-[#0a0e1a] p-3">
      <p className="text-[10px] uppercase tracking-wider text-[#475569]">{label}</p>
      <p className="text-xl font-bold font-mono mt-1" style={{ color: accent }}>{value}</p>
    </div>
  );
}
