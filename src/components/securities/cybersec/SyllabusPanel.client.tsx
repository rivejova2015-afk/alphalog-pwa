"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, ListChecks, Puzzle, GraduationCap, Trophy, Lock, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import {
  SYLLABUS,
  SYLLABUS_CATEGORIES,
  modulesByCategory,
  HW,
  PRACTICE,
  LESSONS,
  type Module,
  type ModuleStatus,
  type ProgressMap,
} from "@/lib/securities/cybersec";
import { ProgressBadge } from "./ProgressBadge.client";

const CATEGORY_COLORS: Record<string, string> = {
  Fundamentos:   "border-[#22d3ee]/30 bg-[#22d3ee]/5",
  Redes:         "border-[#34d399]/30 bg-[#34d399]/5",
  Sistemas:      "border-[#f97316]/30 bg-[#f97316]/5",
  Criptografía:  "border-[#a78bfa]/30 bg-[#a78bfa]/5",
  "Web Security":"border-[#f472b6]/30 bg-[#f472b6]/5",
  Pentesting:    "border-[#ef4444]/30 bg-[#ef4444]/5",
  "Social Eng.": "border-[#eab308]/30 bg-[#eab308]/5",
  Malware:       "border-[#dc2626]/30 bg-[#dc2626]/5",
  Forense:       "border-[#06b6d4]/30 bg-[#06b6d4]/5",
  "Blue Team":   "border-[#3b82f6]/30 bg-[#3b82f6]/5",
  Cloud:         "border-[#8b5cf6]/30 bg-[#8b5cf6]/5",
  Especializado: "border-[#94a3b8]/30 bg-[#94a3b8]/5",
  Programación:  "border-[#10b981]/30 bg-[#10b981]/5",
};

function effectiveStatus(mod: Module, progress: ProgressMap): ModuleStatus {
  return progress[mod.m]?.status ?? mod.st;
}

export function SyllabusPanel() {
  const [progress, setProgress] = useState<ProgressMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/securities/cybersec/progress");
        if (!res.ok) {
          toast.error("No se pudo cargar el progreso");
          return;
        }
        const data = (await res.json()) as ProgressMap;
        if (!cancelled) setProgress(data);
      } catch {
        toast.error("Error de conexión");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const grouped = useMemo(() => modulesByCategory(), []);

  const stats = useMemo(() => {
    const total = SYLLABUS.length;
    let completed = 0;
    let active = 0;
    for (const mod of SYLLABUS) {
      const st = effectiveStatus(mod, progress);
      if (st === "completed") completed++;
      else if (st === "active") active++;
    }
    return { total, completed, active, locked: total - completed - active };
  }, [progress]);

  return (
    <div className="space-y-6">
      <SummaryStrip stats={stats} loading={loading} />

      {SYLLABUS_CATEGORIES.map((cat) => {
        const mods = grouped[cat] ?? [];
        if (mods.length === 0) return null;
        return (
          <section key={cat} className="space-y-3">
            <header className="flex items-baseline justify-between border-b border-[#1f2937] pb-1.5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#e2e8f0]">{cat}</h2>
              <span className="text-[10px] uppercase tracking-wider text-[#475569]">{mods.length} módulos</span>
            </header>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {mods.map((mod) => {
                const st = effectiveStatus(mod, progress);
                const isLocked = st === "locked";
                const Inner = (
                  <article
                    className={`rounded-lg border p-3 transition-colors ${CATEGORY_COLORS[cat] ?? "border-[#1f2937]"} ${
                      isLocked ? "opacity-60" : "hover:bg-[#151b28]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="text-[10px] font-mono text-[#94a3b8]">M{mod.m} · Semana {mod.wk}</span>
                      <ProgressBadge status={st} />
                    </div>
                    <h3 className="text-sm font-bold text-[#e2e8f0] leading-snug">{mod.title}</h3>
                    <p className="text-[11px] text-[#94a3b8] mt-1.5 line-clamp-2">{mod.levels.b}</p>
                    <div className="flex items-center justify-end mt-2 text-[10px] text-[#475569]">
                      {isLocked ? <Lock size={11} /> : <ChevronRight size={12} />}
                    </div>
                  </article>
                );
                return isLocked ? (
                  <div key={mod.m} title="Módulo bloqueado">{Inner}</div>
                ) : (
                  <Link key={mod.m} href={`/securities/cybersec/modules/${mod.m}`} className="block">
                    {Inner}
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}

      <ResourceLinks />
    </div>
  );
}

function SummaryStrip({ stats, loading }: { stats: { total: number; completed: number; active: number; locked: number }; loading: boolean }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <Tile label="Total" value={stats.total} accent="#94a3b8" />
      <Tile label="Activos" value={stats.active} accent="#22d3ee" />
      <Tile label="Completados" value={stats.completed} accent="#34d399" />
      <Tile label={loading ? "Cargando…" : "Bloqueados"} value={stats.locked} accent="#475569" />
    </div>
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

function ResourceLinks() {
  return (
    <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-[#1f2937]">
      <Link href="/securities/cybersec/homework" className="flex items-center gap-3 rounded-lg border border-[#1f2937] bg-[#0a0e1a] p-3 hover:bg-[#151b28] transition-colors">
        <ListChecks size={18} className="text-[#22d3ee]" />
        <div>
          <p className="text-sm font-bold text-[#e2e8f0]">Homework</p>
          <p className="text-[11px] text-[#94a3b8]">{HW.length} entregas</p>
        </div>
      </Link>
      <div className="flex items-center gap-3 rounded-lg border border-[#1f2937] bg-[#0a0e1a] p-3">
        <Puzzle size={18} className="text-[#a78bfa]" />
        <div>
          <p className="text-sm font-bold text-[#e2e8f0]">Práctica</p>
          <p className="text-[11px] text-[#94a3b8]">{PRACTICE.length} ejercicios</p>
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-lg border border-[#1f2937] bg-[#0a0e1a] p-3">
        <BookOpen size={18} className="text-[#34d399]" />
        <div>
          <p className="text-sm font-bold text-[#e2e8f0]">Lecciones</p>
          <p className="text-[11px] text-[#94a3b8]">{LESSONS.length} extendidas</p>
        </div>
      </div>
      <Link href="/securities/cybersec/exam" className="flex items-center gap-3 rounded-lg border border-[#a78bfa]/30 bg-[#a78bfa]/5 p-3 hover:bg-[#a78bfa]/10 transition-colors sm:col-span-3">
        <Trophy size={18} className="text-[#a78bfa]" />
        <div className="flex-1">
          <p className="text-sm font-bold text-[#e2e8f0]">Examen final</p>
          <p className="text-[11px] text-[#94a3b8]">30 preguntas · Pasa con ≥ 70%</p>
        </div>
        <GraduationCap size={16} className="text-[#a78bfa]" />
      </Link>
    </section>
  );
}
