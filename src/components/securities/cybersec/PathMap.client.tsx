"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Crown, Lock, Star, Sparkles } from "lucide-react";
import { SYLLABUS, MASTERY_MAX } from "@/lib/securities/cybersec";
import { CelebrationOverlay } from "./CelebrationOverlay.client";
import { useCybersecSummary } from "./useCybersecSummary";

const ITEMS = SYLLABUS.map((m) => ({ m: m.m, title: m.title, cat: m.cat }));

// Gentle serpentine: horizontal offset per node, cycling.
const OFFSET = [0, 44, 70, 44, 0, -44, -70, -44];

// Precompute static layout (section headers + offsets) once at module load so
// the render never mutates `let` variables (React Compiler safe).
const ROWS = (() => {
  let lastCat: string | null = null;
  let nodeIdx = 0;
  return ITEMS.map((it) => {
    const header = it.cat !== lastCat ? it.cat : null;
    lastCat = it.cat;
    const offset = OFFSET[nodeIdx % OFFSET.length];
    nodeIdx += 1;
    return { ...it, header, offset };
  });
})();

export function PathMap() {
  const { summary, loading } = useCybersecSummary();
  const mastery = summary?.mastery ?? {};

  // First module not yet started = the "current" node.
  const currentM = useMemo(() => {
    if (!summary) return null;
    const item = ITEMS.find((it) => (mastery[it.m] ?? 0) === 0);
    return item?.m ?? null;
  }, [summary, mastery]);

  return (
    <div className="space-y-6">
      <CelebrationOverlay milestones={summary?.milestones ?? []} />
      <Link href="/securities/cybersec" className="inline-flex items-center gap-1.5 text-sm text-[#94a3b8] hover:text-[#22d3ee]">
        <ArrowLeft size={14} /> Volver al syllabus
      </Link>

      {/* Level + XP header */}
      {summary && (
        <div className="rounded-xl border border-[#a78bfa]/40 bg-[#a78bfa]/5 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-[#a78bfa] text-[#0a0e1a] font-bold text-sm">{summary.xp.level.level}</span>
              <div>
                <p className="text-sm font-bold text-[#e2e8f0]">Nivel {summary.xp.level.level}</p>
                <p className="text-[11px] text-[#94a3b8]">{summary.xp.totalXp} XP totales</p>
              </div>
            </div>
            <span className="text-xs text-[#a78bfa] font-mono">{summary.xp.level.xpIntoLevel}/{summary.xp.level.xpForNext} XP</span>
          </div>
          <div className="h-2 w-full rounded bg-[#1f2937] overflow-hidden">
            <div className="h-full bg-[#a78bfa] transition-all" style={{ width: `${summary.xp.level.pct}%` }} />
          </div>
        </div>
      )}

      {loading || !summary ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 w-14 mx-auto rounded-full border border-[#1f2937] bg-[#0a0e1a] animate-pulse" />
          ))}
        </div>
      ) : (
        <Path mastery={mastery} currentM={currentM} />
      )}
    </div>
  );
}

function Path({ mastery, currentM }: { mastery: Record<number, number>; currentM: number | null }) {
  return (
    <div className="space-y-3 overflow-x-hidden" role="tree" aria-label="Camino de módulos">
      {ROWS.map((row) => {
        const m = mastery[row.m] ?? 0;
        const isCurrent = row.m === currentM;
        // "ahead" = un módulo posterior al actual y sin empezar (bloqueo suave visual).
        const ahead = !isCurrent && m === 0 && currentM != null && row.m > currentM;
        return (
          <div key={row.m}>
            {row.header && <SectionHeader cat={row.header} />}
            <div className="flex justify-center" style={{ transform: `translateX(${row.offset}px)` }}>
              <PathNode m={row.m} title={row.title} mastery={m} isCurrent={isCurrent} ahead={ahead} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SectionHeader({ cat }: { cat: string }) {
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-[#1f2937]" />
      <span className="text-[10px] uppercase tracking-[0.2em] text-[#a78bfa] font-bold">{cat}</span>
      <div className="flex-1 h-px bg-[#1f2937]" />
    </div>
  );
}

function PathNode({ m, title, mastery, isCurrent, ahead }: { m: number; title: string; mastery: number; isCurrent: boolean; ahead: boolean }) {
  const legendary = mastery >= MASTERY_MAX;
  const mastered = mastery >= 3;
  const inProgress = mastery >= 1 && mastery < 3;

  const ring = legendary ? "border-[#eab308] bg-[#eab308]/15 text-[#eab308]"
    : mastered ? "border-[#34d399] bg-[#34d399]/15 text-[#34d399]"
    : inProgress ? "border-[#22d3ee] bg-[#22d3ee]/15 text-[#22d3ee]"
    : isCurrent ? "border-[#a78bfa] bg-[#a78bfa]/15 text-[#a78bfa] ring-2 ring-[#a78bfa]/40 animate-pulse"
    : ahead ? "border-[#1f2937] bg-[#0a0e1a] text-[#475569]"
    : "border-[#334155] bg-[#0a0e1a] text-[#94a3b8]";

  const Icon = legendary ? Crown : mastered ? Star : ahead ? Lock : isCurrent ? Sparkles : null;

  return (
    <Link
      href={`/securities/cybersec/modules/${m}`}
      role="treeitem"
      aria-label={`Módulo ${m}: ${title} — maestría ${mastery} de ${MASTERY_MAX}${isCurrent ? " (actual)" : ""}`}
      className="flex flex-col items-center gap-1 w-[120px] group"
    >
      <div className={`flex items-center justify-center w-14 h-14 rounded-full border-2 transition ${ring} group-hover:scale-105`}>
        {Icon ? <Icon size={20} /> : <span className="text-sm font-bold">{m}</span>}
      </div>
      <div className="flex gap-0.5">
        {Array.from({ length: MASTERY_MAX }).map((_, i) => (
          <span key={i} className={`w-1.5 h-1.5 rounded-full ${i < mastery ? (legendary ? "bg-[#eab308]" : "bg-[#34d399]") : "bg-[#1f2937]"}`} />
        ))}
      </div>
      <p className="text-[10px] text-center text-[#94a3b8] leading-tight line-clamp-2 group-hover:text-[#e2e8f0]">{title}</p>
    </Link>
  );
}
