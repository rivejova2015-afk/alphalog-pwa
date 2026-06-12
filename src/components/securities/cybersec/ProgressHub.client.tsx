"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Flame, Trophy, BookOpen, ClipboardCheck, GraduationCap, ArrowRight } from "lucide-react";
import {
  LESSONS, SYLLABUS, HW, getLesson, computeProgress,
  type ProgressData, type ProgressStats,
} from "@/lib/securities/cybersec";

const CONTENT = {
  lessons: LESSONS.map((l) => ({ id: l.id, sub: l.sub })),
  modules: SYLLABUS.map((m) => ({ m: m.m, cat: m.cat })),
  homework: HW.map((h) => ({ id: h.id, l: h.l, pts: h.pts })),
};

async function fetchJson<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url);
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

export function ProgressHub() {
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [quiz, exam, hw] = await Promise.all([
        fetchJson<{ results: ProgressData["quizResults"] }>("/api/securities/cybersec/quiz-results", { results: [] }),
        fetchJson<{ results: ProgressData["examResults"] }>("/api/securities/cybersec/exam-results", { results: [] }),
        fetchJson<ProgressData["homework"]>("/api/securities/cybersec/homework-submissions", {}),
      ]);
      if (cancelled) return;
      setData({ quizResults: quiz.results ?? [], examResults: exam.results ?? [], homework: hw ?? {} });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const stats: ProgressStats | null = useMemo(
    () => (data ? computeProgress(CONTENT, data) : null),
    [data],
  );

  return (
    <div className="space-y-6">
      <Link href="/securities/cybersec" className="inline-flex items-center gap-1.5 text-sm text-[#94a3b8] hover:text-[#22d3ee]">
        <ArrowLeft size={14} /> Volver al syllabus
      </Link>
      <header className="space-y-1">
        <p className="text-[10px] font-mono uppercase tracking-wider text-[#a78bfa]">Mi progreso</p>
        <h1 className="text-2xl font-bold text-[#e2e8f0] font-mono">Hub de estudio</h1>
      </header>

      {loading || !stats ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-lg border border-[#1f2937] bg-[#0a0e1a] animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Next step */}
          {stats.nextLessonId != null && (
            <Link
              href={`/securities/cybersec/lessons/${stats.nextLessonId}`}
              className="flex items-center justify-between rounded-lg border border-[#22d3ee]/40 bg-[#22d3ee]/5 p-4 hover:bg-[#22d3ee]/10"
            >
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#22d3ee] font-bold">Próximo paso</p>
                <p className="text-sm text-[#e2e8f0] font-bold">{getLesson(stats.nextLessonId)?.title ?? `Lección ${stats.nextLessonId}`}</p>
              </div>
              <ArrowRight size={18} className="text-[#22d3ee]" />
            </Link>
          )}

          {/* Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Tile icon={<BookOpen size={16} />} label="Quizzes" value={`${stats.quizzesTaken}/${stats.lessonsTotal}`} sub="lecciones con quiz" />
            <Tile icon={<GraduationCap size={16} />} label="Promedio quiz" value={`${stats.quizAvgPct}%`} sub={`${stats.quizzesTaken} tomados`} />
            <Tile icon={<ClipboardCheck size={16} />} label="Homework" value={`${stats.homeworkGraded}/${stats.homeworkTotal}`} sub={`${stats.homeworkPointsEarned}/${stats.homeworkPointsMax} pts`} />
            <Tile icon={<Trophy size={16} />} label="Examen" value={stats.examBestPct != null ? `${stats.examBestPct}%` : "—"} sub={stats.examPassed ? "aprobado" : stats.examBestPct != null ? "sin aprobar" : "sin intentos"} accent={stats.examPassed} />
            <Tile icon={<Flame size={16} />} label="Racha" value={`${stats.streakDays}d`} sub={`${stats.activeDays} días activos`} />
          </div>

          {/* By category */}
          <section className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-[#94a3b8] font-bold">Avance por categoría</p>
            <div className="space-y-2">
              {stats.byCategory.map((c) => {
                const pct = c.lessonsTotal > 0 ? Math.round((c.quizzesTaken / c.lessonsTotal) * 100) : 0;
                return (
                  <div key={c.cat} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#e2e8f0]">{c.cat}</span>
                      <span className="text-[#94a3b8] font-mono">{c.quizzesTaken}/{c.lessonsTotal}</span>
                    </div>
                    <div className="h-1.5 w-full rounded bg-[#1f2937] overflow-hidden">
                      <div className={`h-full ${pct === 100 ? "bg-[#34d399]" : "bg-[#22d3ee]"}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Tile({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${accent ? "border-[#34d399]/40 bg-[#34d399]/5" : "border-[#1f2937] bg-[#0a0e1a]"}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#94a3b8] font-bold">
        <span className={accent ? "text-[#34d399]" : "text-[#22d3ee]"}>{icon}</span> {label}
      </div>
      <p className="text-2xl font-bold text-[#e2e8f0] mt-1">{value}</p>
      <p className="text-[11px] text-[#475569]">{sub}</p>
    </div>
  );
}
