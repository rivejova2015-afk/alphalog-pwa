"use client";

import type { HistoryTimeline as HistoryTimelineType, ImpactLevel } from "@/lib/securities/cybersec";

const IMPACT_COLOR: Record<ImpactLevel, string> = {
  low: "#64748b",
  medium: "#eab308",
  high: "#ef4444",
};

const IMPACT_LABEL: Record<ImpactLevel, string> = {
  low: "Bajo",
  medium: "Medio",
  high: "Alto",
};

export function HistoryTimeline({ timelines }: { timelines: HistoryTimelineType[] }) {
  if (timelines.length === 0) return null;
  return (
    <div className="space-y-5">
      {timelines.map((tl) => (
        <div key={tl.id}>
          <div className="space-y-0">
            {tl.events.map((ev, i) => {
              const color = IMPACT_COLOR[ev.impact];
              const isLast = i === tl.events.length - 1;
              return (
                <div key={i} className="flex gap-3">
                  {/* Riel + nodo */}
                  <div className="flex flex-col items-center">
                    <div className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: color }} />
                    {!isLast && <div className="w-px flex-1 bg-[#1f2937]" />}
                  </div>
                  <div className={`flex-1 ${isLast ? "" : "pb-4"}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold font-mono text-[#e2e8f0]">{ev.year}</span>
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-mono" style={{ background: `${color}22`, color }}>
                        {IMPACT_LABEL[ev.impact]}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-[#e2e8f0]">{ev.title}</p>
                    <p className="text-xs text-[#94a3b8]">{ev.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
