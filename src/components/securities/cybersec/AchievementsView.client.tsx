"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Award, Lock } from "lucide-react";
import {
  LESSONS, SYLLABUS, HW, computeProgress, computeXp, streakWithFreeze, activityDays, computeAchievements,
  type XpData, type Achievement,
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

export function AchievementsView() {
  const [data, setData] = useState<XpData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [quiz, exam, hw, prog] = await Promise.all([
        fetchJson<{ results: XpData["quizResults"] }>("/api/securities/cybersec/quiz-results", { results: [] }),
        fetchJson<{ results: XpData["examResults"] }>("/api/securities/cybersec/exam-results", { results: [] }),
        fetchJson<XpData["homework"]>("/api/securities/cybersec/homework-submissions", {}),
        fetchJson<NonNullable<XpData["progress"]>>("/api/securities/cybersec/progress", {}),
      ]);
      if (cancelled) return;
      setData({ quizResults: quiz.results ?? [], examResults: exam.results ?? [], homework: hw ?? {}, progress: prog ?? {} });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const achievements: Achievement[] = useMemo(() => {
    if (!data) return [];
    const xp = computeXp(CONTENT, data);
    const stats = computeProgress(CONTENT, data);
    const streak = streakWithFreeze(activityDays(data)).streak;
    return computeAchievements(CONTENT, data, xp, stats, streak);
  }, [data]);

  const earned = achievements.filter((a) => a.earned);
  const locked = achievements.filter((a) => !a.earned);

  return (
    <div className="space-y-6">
      <Link href="/securities/cybersec/progress" className="inline-flex items-center gap-1.5 text-sm text-[#94a3b8] hover:text-[#22d3ee]">
        <ArrowLeft size={14} /> Volver al progreso
      </Link>
      <header className="space-y-1">
        <p className="text-[10px] font-mono uppercase tracking-wider text-[#eab308]">Logros</p>
        <h1 className="text-2xl font-bold text-[#e2e8f0] font-mono">
          {loading ? "—" : `${earned.length} / ${achievements.length} desbloqueados`}
        </h1>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg border border-[#1f2937] bg-[#0a0e1a] animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {earned.length > 0 && (
            <section className="space-y-2">
              <p className="text-xs uppercase tracking-wider text-[#94a3b8] font-bold">Desbloqueados ({earned.length})</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {earned.map((a) => <Card key={a.id} a={a} />)}
              </div>
            </section>
          )}
          {locked.length > 0 && (
            <section className="space-y-2">
              <p className="text-xs uppercase tracking-wider text-[#94a3b8] font-bold">En progreso ({locked.length})</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {locked.map((a) => <Card key={a.id} a={a} />)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Card({ a }: { a: Achievement }) {
  const pct = a.progress && a.progress.target > 0 ? Math.round((a.progress.cur / a.progress.target) * 100) : 0;
  return (
    <div className={`rounded-lg border p-3 ${a.earned ? "border-[#eab308]/40 bg-[#eab308]/5" : "border-[#1f2937] bg-[#0a0e1a]"}`}>
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${a.earned ? "bg-[#eab308]/20 text-[#eab308]" : "bg-[#1f2937] text-[#475569]"}`}>
          {a.earned ? <Award size={18} /> : <Lock size={16} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-bold ${a.earned ? "text-[#e2e8f0]" : "text-[#94a3b8]"}`}>{a.name}</p>
          <p className="text-[11px] text-[#475569] leading-tight">{a.desc}</p>
          {!a.earned && a.progress && a.progress.target > 1 && (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1.5 flex-1 rounded bg-[#1f2937] overflow-hidden">
                <div className="h-full bg-[#22d3ee]/70" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[10px] text-[#475569] font-mono">{a.progress.cur}/{a.progress.target}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
