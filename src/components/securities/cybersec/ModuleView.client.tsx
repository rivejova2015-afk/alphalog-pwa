"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Check, BookOpen, Search } from "lucide-react";
import { toast } from "sonner";
import {
  type Module,
  type LevelKey,
  type ModuleStatus,
  type ProgressRecord,
  lessonsForModule,
} from "@/lib/securities/cybersec";
import { ProgressBadge } from "./ProgressBadge.client";

interface Props {
  module: Module;
}

const LEVEL_LABELS: Record<LevelKey, string> = { b: "Básico", i: "Intermedio", a: "Avanzado" };
const LEVEL_ORDER: LevelKey[] = ["b", "i", "a"];

export function ModuleView({ module: mod }: Props) {
  const [progress, setProgress] = useState<ProgressRecord | null>(null);
  const [saving, setSaving] = useState<LevelKey | "research" | null>(null);

  const lessons = lessonsForModule(mod.m);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/securities/cybersec/progress");
        if (!res.ok) return;
        const data = (await res.json()) as Record<number, ProgressRecord>;
        if (!cancelled) setProgress(data[mod.m] ?? null);
      } catch {
        // silent
      }
    })();
    return () => { cancelled = true; };
  }, [mod.m]);

  const status: ModuleStatus = progress?.status ?? mod.st;
  const completed = new Set<LevelKey>(progress?.completed_levels ?? []);
  const researchDone = progress?.research_done ?? false;

  const persist = useCallback(async (next: { completed_levels?: LevelKey[]; research_done?: boolean; status?: ModuleStatus }) => {
    try {
      const res = await fetch("/api/securities/cybersec/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module_id: mod.m, ...next }),
      });
      if (!res.ok) {
        toast.error("No se pudo guardar el progreso");
        return false;
      }
      const json = (await res.json()) as { progress: ProgressRecord };
      setProgress(json.progress);
      return true;
    } catch {
      toast.error("Error de conexión");
      return false;
    }
  }, [mod.m]);

  const toggleLevel = async (level: LevelKey) => {
    setSaving(level);
    const nextLevels = completed.has(level)
      ? Array.from(completed).filter((l) => l !== level)
      : [...Array.from(completed), level];
    const allDone = LEVEL_ORDER.every((l) => nextLevels.includes(l));
    const nextStatus: ModuleStatus = allDone && researchDone ? "completed" : "active";
    const ok = await persist({ completed_levels: nextLevels, status: nextStatus });
    if (ok) toast.success(completed.has(level) ? "Nivel desmarcado" : `Nivel ${LEVEL_LABELS[level]} completado`);
    setSaving(null);
  };

  const toggleResearch = async () => {
    setSaving("research");
    const next = !researchDone;
    const allDone = LEVEL_ORDER.every((l) => completed.has(l));
    const nextStatus: ModuleStatus = next && allDone ? "completed" : "active";
    const ok = await persist({ research_done: next, status: nextStatus });
    if (ok) toast.success(next ? "Research marcada como hecha" : "Research desmarcada");
    setSaving(null);
  };

  return (
    <div className="space-y-6">
      <Link href="/securities/cybersec" className="inline-flex items-center gap-1.5 text-sm text-[#94a3b8] hover:text-[#22d3ee]">
        <ArrowLeft size={14} /> Volver al syllabus
      </Link>

      <header className="space-y-2">
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider text-[#475569] font-mono">
          <span>M{mod.m}</span>
          <span>·</span>
          <span>{mod.cat}</span>
          <span>·</span>
          <span>Semana {mod.wk}</span>
          <ProgressBadge status={status} size="md" />
        </div>
        <h1 className="text-2xl font-bold text-[#e2e8f0] font-mono">{mod.title}</h1>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#94a3b8]">Niveles</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {LEVEL_ORDER.map((lvl) => {
            const isDone = completed.has(lvl);
            return (
              <button
                key={lvl}
                onClick={() => void toggleLevel(lvl)}
                disabled={saving !== null}
                className={`text-left rounded-lg border p-3 transition-colors disabled:opacity-50 ${
                  isDone ? "bg-[#34d399]/5 border-[#34d399]/30" : "bg-[#0a0e1a] border-[#1f2937] hover:bg-[#151b28]"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-bold uppercase ${isDone ? "text-[#34d399]" : "text-[#22d3ee]"}`}>
                    {LEVEL_LABELS[lvl]}
                  </span>
                  {isDone && <Check size={14} className="text-[#34d399]" />}
                </div>
                <p className="text-xs text-[#94a3b8] leading-relaxed">{mod.levels[lvl]}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#94a3b8]">Topics</h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {mod.topics.map((topic) => (
            <li key={topic} className="flex items-start gap-2 text-sm text-[#e2e8f0]">
              <span className="text-[#22d3ee] mt-0.5">•</span>
              <span>{topic}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#94a3b8] flex items-center gap-2">
          <Search size={14} /> Research
        </h2>
        <div className={`rounded-lg border p-4 ${researchDone ? "bg-[#34d399]/5 border-[#34d399]/30" : "bg-[#0a0e1a] border-[#1f2937]"}`}>
          <p className="text-sm text-[#e2e8f0] leading-relaxed">{mod.research}</p>
          <button
            onClick={() => void toggleResearch()}
            disabled={saving !== null}
            className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold disabled:opacity-50 ${
              researchDone
                ? "bg-[#34d399]/20 text-[#34d399] hover:bg-[#34d399]/30"
                : "bg-[#22d3ee] text-[#0a0e1a] hover:bg-[#06b6d4]"
            }`}
          >
            {researchDone ? <><Check size={12} /> Research completada</> : "Marcar research como hecha"}
          </button>
        </div>
      </section>

      {lessons.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#94a3b8] flex items-center gap-2">
            <BookOpen size={14} /> Lecciones relacionadas
          </h2>
          <ul className="space-y-2">
            {lessons.map((lesson) => (
              <li key={lesson.id}>
                <Link
                  href={`/securities/cybersec/lessons/${lesson.id}`}
                  className="block rounded-lg border border-[#1f2937] bg-[#0a0e1a] p-3 hover:bg-[#151b28] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-[#e2e8f0]">{lesson.title}</p>
                      <p className="text-[11px] text-[#94a3b8]">
                        {lesson.diff} · {lesson.dur} · {lesson.sections.length} secciones
                      </p>
                    </div>
                    <span className="text-[#22d3ee] text-xs">→</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
