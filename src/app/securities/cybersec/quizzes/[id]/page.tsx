import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  getQuiz, getLesson, availableLevels, QUIZ_LEVELS, QUIZ_LEVEL_LABELS,
  type QuizLevel,
} from "@/lib/securities/cybersec";
import { QuizRunner } from "@/components/securities/cybersec/QuizRunner.client";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ level?: string }>;
}

const PASS = 0.7;

function isLevel(v: string | undefined): v is QuizLevel {
  return v === "b" || v === "i" || v === "a";
}

export default async function QuizPage({ params, searchParams }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { id } = await params;
  const { level: levelRaw } = await searchParams;
  const lessonId = Number.parseInt(id, 10);
  if (!Number.isFinite(lessonId)) notFound();

  const lesson = getLesson(lessonId);
  if (!lesson) notFound();

  const levels = availableLevels(lessonId);
  if (levels.length === 0) notFound();

  // Mejor pct por nivel para esta lección → gating de desbloqueo.
  const { data: rows } = await supabase
    .from("securities_quiz_results")
    .select("score, total, level")
    .eq("user_id", user.id)
    .eq("lesson_id", lessonId);

  const bestPct: Record<QuizLevel, number | null> = { b: null, i: null, a: null };
  for (const r of rows ?? []) {
    const lv = (isLevel(r.level ?? undefined) ? r.level : "b") as QuizLevel;
    const pct = r.total > 0 ? r.score / r.total : 0;
    if (bestPct[lv] == null || pct > (bestPct[lv] as number)) bestPct[lv] = pct;
  }

  // 'b' siempre abierto; 'i' requiere 'b' aprobado; 'a' requiere 'i' aprobado.
  const passed = (lv: QuizLevel) => (bestPct[lv] ?? 0) >= PASS;
  const unlocked = (lv: QuizLevel): boolean =>
    lv === "b" ? true : lv === "i" ? passed("b") : passed("i");

  // Nivel seleccionado: el de la query si existe/está abierto/desbloqueado; si no, 'b'.
  const requested = isLevel(levelRaw) ? levelRaw : "b";
  const level: QuizLevel =
    levels.includes(requested) && unlocked(requested) ? requested : "b";

  const quiz = getQuiz(lessonId, level);
  if (!quiz) notFound();

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-5">
      {/* Selector de nivel */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-[#475569]">Nivel:</span>
        {QUIZ_LEVELS.map((lv) => {
          const exists = levels.includes(lv);
          const open = exists && unlocked(lv);
          const active = lv === level;
          const pct = bestPct[lv];
          const label = QUIZ_LEVEL_LABELS[lv];
          if (!exists) {
            return (
              <span key={lv} title="Próximamente" className="px-2.5 py-1 rounded text-[11px] border border-[#1f2937] bg-[#0a0e1a] text-[#475569]">
                {label} · próximamente
              </span>
            );
          }
          if (!open) {
            return (
              <span key={lv} title="Aprobá el nivel anterior (≥70%) para desbloquear" className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] border border-[#1f2937] bg-[#0a0e1a] text-[#475569] cursor-not-allowed">
                <Lock size={11} /> {label}
              </span>
            );
          }
          return (
            <Link
              key={lv}
              href={`/securities/cybersec/quizzes/${lessonId}?level=${lv}`}
              aria-current={active ? "page" : undefined}
              className={`px-2.5 py-1 rounded text-[11px] border transition-colors ${
                active
                  ? "bg-[#22d3ee]/10 border-[#22d3ee]/40 text-[#22d3ee]"
                  : "bg-[#0a0e1a] border-[#1f2937] text-[#94a3b8] hover:bg-[#151b28]"
              }`}
            >
              {label}{pct != null ? ` · ${Math.round(pct * 100)}%` : ""}
            </Link>
          );
        })}
      </div>

      <QuizRunner key={level} lessonId={lessonId} lessonTitle={lesson.title} questions={quiz} level={level} />
    </div>
  );
}
