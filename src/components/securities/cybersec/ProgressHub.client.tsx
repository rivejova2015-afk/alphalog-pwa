"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Flame, Trophy, BookOpen, ClipboardCheck, GraduationCap, ArrowRight, Map, Target, Award, Minus, Plus } from "lucide-react";
import {
  LESSONS, SYLLABUS, HW, getLesson, computeProgress, computeXp,
  streakWithFreeze, xpEarnedToday, activityDays, computeAchievements, DEFAULT_DAILY_GOAL,
  snapshotFromData,
  type ProgressData, type ProgressStats, type XpData,
} from "@/lib/securities/cybersec";
import { CelebrationOverlay, useMilestones } from "./CelebrationOverlay.client";

const GOAL_KEY = "cybersec.dailyGoal";

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
  const [data, setData] = useState<XpData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [quiz, exam, hw, prog] = await Promise.all([
        fetchJson<{ results: ProgressData["quizResults"] }>("/api/securities/cybersec/quiz-results", { results: [] }),
        fetchJson<{ results: ProgressData["examResults"] }>("/api/securities/cybersec/exam-results", { results: [] }),
        fetchJson<ProgressData["homework"]>("/api/securities/cybersec/homework-submissions", {}),
        fetchJson<NonNullable<XpData["progress"]>>("/api/securities/cybersec/progress", {}),
      ]);
      if (cancelled) return;
      setData({ quizResults: quiz.results ?? [], examResults: exam.results ?? [], homework: hw ?? {}, progress: prog ?? {} });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const [goal, setGoal] = useState(DEFAULT_DAILY_GOAL);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(GOAL_KEY);
      if (raw) setGoal(Math.max(10, parseInt(raw, 10) || DEFAULT_DAILY_GOAL));
    } catch { /* ignore */ }
  }, []);
  const changeGoal = (delta: number) => {
    setGoal((g) => {
      const next = Math.max(10, Math.min(500, g + delta));
      try { localStorage.setItem(GOAL_KEY, String(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const stats: ProgressStats | null = useMemo(
    () => (data ? computeProgress(CONTENT, data) : null),
    [data],
  );
  const xp = useMemo(() => (data ? computeXp(CONTENT, data) : null), [data]);
  const streak = useMemo(() => (data ? streakWithFreeze(activityDays(data)) : null), [data]);
  const xpToday = useMemo(() => (data ? xpEarnedToday(data) : 0), [data]);
  const achievements = useMemo(
    () => (data && xp && stats && streak ? computeAchievements(CONTENT, data, xp, stats, streak.streak) : []),
    [data, xp, stats, streak],
  );
  const snap = useMemo(() => (data ? snapshotFromData(CONTENT, data) : null), [data]);
  const { current: celebration, dismiss: dismissCelebration } = useMilestones(snap?.snapshot ?? null, snap?.names ?? {});

  return (
    <div className="space-y-6">
      <CelebrationOverlay milestone={celebration} onDismiss={dismissCelebration} />
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
          {/* Level + XP */}
          {xp && (
            <Link href="/securities/cybersec/path" className="block rounded-lg border border-[#a78bfa]/40 bg-[#a78bfa]/5 p-4 hover:bg-[#a78bfa]/10">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-[#a78bfa] text-[#0a0e1a] font-bold text-sm">{xp.level.level}</span>
                  <div>
                    <p className="text-sm font-bold text-[#e2e8f0]">Nivel {xp.level.level}</p>
                    <p className="text-[11px] text-[#94a3b8]">{xp.totalXp} XP · ver mi camino</p>
                  </div>
                </div>
                <Map size={16} className="text-[#a78bfa]" />
              </div>
              <div className="h-2 w-full rounded bg-[#1f2937] overflow-hidden">
                <div className="h-full bg-[#a78bfa]" style={{ width: `${xp.level.pct}%` }} />
              </div>
            </Link>
          )}

          {/* Daily goal */}
          <div className="rounded-lg border border-[#1f2937] bg-[#0a0e1a] p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#e2e8f0]">
                <Target size={14} className="text-[#22d3ee]" /> Meta diaria
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => changeGoal(-10)} aria-label="Bajar meta" className="w-6 h-6 rounded bg-[#1f2937] hover:bg-[#151b28] text-[#94a3b8] inline-flex items-center justify-center"><Minus size={12} /></button>
                <span className="text-xs text-[#94a3b8] font-mono w-16 text-center">{xpToday}/{goal} XP</span>
                <button onClick={() => changeGoal(10)} aria-label="Subir meta" className="w-6 h-6 rounded bg-[#1f2937] hover:bg-[#151b28] text-[#94a3b8] inline-flex items-center justify-center"><Plus size={12} /></button>
              </div>
            </div>
            <div className="h-2 w-full rounded bg-[#1f2937] overflow-hidden">
              <div className={`h-full transition-all ${xpToday >= goal ? "bg-[#34d399]" : "bg-[#22d3ee]"}`} style={{ width: `${Math.min(100, Math.round((xpToday / goal) * 100))}%` }} />
            </div>
            {xpToday >= goal && <p className="text-[11px] text-[#34d399] mt-1">¡Meta de hoy cumplida! 🎯</p>}
          </div>

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
            <Tile icon={<Flame size={16} />} label="Racha" value={`${streak?.streak ?? 0}d`} sub={streak && streak.frozenUsed > 0 ? `🛡 ${streak.frozenUsed} congelado(s)` : `${stats.activeDays} días activos`} />
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

          {/* Achievements */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider text-[#94a3b8] font-bold">Logros</p>
              <Link href="/securities/cybersec/achievements" className="text-[11px] text-[#22d3ee] hover:underline">
                {achievements.filter((a) => a.earned).length}/{achievements.length} · ver todos
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {achievements.map((a) => (
                <div
                  key={a.id}
                  className={`rounded-lg border p-2.5 ${a.earned ? "border-[#eab308]/40 bg-[#eab308]/5" : "border-[#1f2937] bg-[#0a0e1a]"}`}
                  title={a.desc}
                >
                  <div className="flex items-center gap-1.5">
                    <Award size={14} className={a.earned ? "text-[#eab308]" : "text-[#475569]"} />
                    <span className={`text-xs font-bold ${a.earned ? "text-[#e2e8f0]" : "text-[#94a3b8]"}`}>{a.name}</span>
                  </div>
                  <p className="text-[10px] text-[#475569] mt-0.5 leading-tight">{a.desc}</p>
                  {!a.earned && a.progress && a.progress.target > 1 && (
                    <div className="mt-1 h-1 w-full rounded bg-[#1f2937] overflow-hidden">
                      <div className="h-full bg-[#22d3ee]/60" style={{ width: `${Math.round((a.progress.cur / a.progress.target) * 100)}%` }} />
                    </div>
                  )}
                </div>
              ))}
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
