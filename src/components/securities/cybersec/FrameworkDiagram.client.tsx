"use client";

import { Shield } from "lucide-react";
import type { Framework } from "@/lib/securities/cybersec";

export function FrameworkDiagram({ frameworks }: { frameworks: Framework[] }) {
  if (frameworks.length === 0) return null;
  return (
    <div className="space-y-5">
      {frameworks.map((fw) => (
        <div key={fw.id} className="rounded-lg border border-[#1f2937] bg-[#0a0e1a] p-4">
          <h3 className="text-sm font-bold text-[#e2e8f0]">{fw.name}</h3>
          <p className="mt-1 text-xs text-[#94a3b8]">{fw.summary}</p>

          <ol className="mt-4 space-y-2">
            {fw.phases.map((phase) => (
              <li key={phase.n} className="relative flex gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#22d3ee]/15 text-xs font-bold font-mono text-[#22d3ee]">
                  {phase.n}
                </div>
                <div className="flex-1 rounded-lg border border-[#1f2937] bg-[#05080f] px-3 py-2">
                  <p className="text-sm font-bold text-[#e2e8f0]">{phase.name}</p>
                  <p className="mt-0.5 text-xs text-[#94a3b8]">{phase.desc}</p>
                  {phase.defenses.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Shield size={11} className="text-[#34d399]" />
                      {phase.defenses.map((d) => (
                        <span key={d} className="rounded border border-[#34d399]/30 bg-[#34d399]/5 px-1.5 py-0.5 text-[10px] text-[#34d399]">{d}</span>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
