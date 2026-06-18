"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, X, Trophy, Clock, GraduationCap, Timer, RotateCcw, ArrowRight, BookOpen } from "lucide-react";
import { toast } from "sonner";
import type { QuizQuestion, QuizLevel } from "@/lib/securities/cybersec";
import { shuffle, formatClock, QUIZ_LEVEL_LABELS } from "@/lib/securities/cybersec";
import { CelebrationOverlay } from "./CelebrationOverlay.client";

interface Props {
  lessonId: number;
  lessonTitle: string;
  questions: QuizQuestion[];
  level?: QuizLevel;
  moduleId?: number | null;
  nextLessonId?: number | null;
  nextLessonTitle?: string | null;
}

type Mode = "practica" | "test";
type SaveState = "idle" | "saving" | "saved" | "error";
const PASS_RATIO = 0.7;
const SECONDS_PER_Q = 45;

function prepareQuiz(qs: QuizQuestion[]): QuizQuestion[] {
  return shuffle(qs).map((q) => {
    const correctText = q.o[q.c];
    const o = shuffle(q.o);
    return { ...q, o, c: o.indexOf(correctText) };
  });
}

function wrongKey(lessonId: number, level: QuizLevel) {
  return `cybersec.quiz.${lessonId}.${level}.wrong`;
}

export function QuizRunner({ lessonId, lessonTitle, questions, level = "b", moduleId = null, nextLessonId = null, nextLessonTitle = null }: Props) {
  const [mode, setMode] = useState<Mode>("practica");
  const [session, setSession] = useState<QuizQuestion[]>(questions);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false); // test mode: reveals review
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [savedWrong, setSavedWrong] = useState<string[]>([]);
  // Confeti inline: se remonta (key) en cada aprobación para re-disparar la animación.
  const [celebration, setCelebration] = useState<{ key: number; score: number; total: number } | null>(null);

  // Load persisted "wrong" set so the user can review only failed questions.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(wrongKey(lessonId, level));
      if (raw) setSavedWrong(JSON.parse(raw) as string[]);
    } catch { /* ignore */ }
  }, [lessonId, level]);

  const total = session.length;
  const score = useMemo(
    () => session.reduce((acc, q, i) => acc + (answers[i] === q.c ? 1 : 0), 0),
    [session, answers],
  );
  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === total;

  const persistWrong = useCallback((sess: QuizQuestion[], ans: Record<number, number>) => {
    const wrong = sess.filter((q, i) => ans[i] !== q.c).map((q) => q.q);
    try {
      if (wrong.length > 0) localStorage.setItem(wrongKey(lessonId, level), JSON.stringify(wrong));
      else localStorage.removeItem(wrongKey(lessonId, level));
    } catch { /* ignore */ }
    setSavedWrong(wrong);
  }, [lessonId, level]);

  const saveResult = useCallback(async (finalScore: number, sess: QuizQuestion[], ans: Record<number, number>) => {
    const passed = sess.length > 0 && finalScore / sess.length >= PASS_RATIO;
    setSaving(true);
    setSaveState("saving");
    try {
      const res = await fetch("/api/securities/cybersec/quiz-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lesson_id: lessonId, score: finalScore, total: sess.length, level, answers: sess.map((_, i) => ans[i] ?? -1) }),
      });
      if (!res.ok) {
        toast.error("No se pudo guardar el resultado");
        setSaveState("error");
      } else {
        toast.success(`Guardado: ${finalScore}/${sess.length}`);
        setSaveState("saved");
      }
    } catch {
      toast.error("Error de conexión");
      setSaveState("error");
    } finally {
      setSaving(false);
    }

    if (passed) {
      // Confeti inmediato (reutiliza CelebrationOverlay).
      setCelebration((c) => ({ key: (c?.key ?? 0) + 1, score: finalScore, total: sess.length }));
      // Marca el nivel del quiz como progreso del módulo (best-effort, no bloquea).
      if (moduleId != null) {
        void fetch("/api/securities/cybersec/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ module_id: moduleId, add_completed_level: level }),
        }).catch(() => { /* el progreso se recalcula igual al recargar */ });
      }
    }
  }, [lessonId, level, moduleId]);

  const finishTest = useCallback(() => {
    setSubmitted(true);
    const fs = session.reduce((acc, q, i) => acc + (answers[i] === q.c ? 1 : 0), 0);
    persistWrong(session, answers);
    void saveResult(fs, session, answers);
  }, [session, answers, persistWrong, saveResult]);

  // Test-mode countdown.
  useEffect(() => {
    if (mode !== "test" || submitted) return;
    if (secondsLeft <= 0) {
      toast.message("⏱ Tiempo agotado");
      finishTest();
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [mode, submitted, secondsLeft, finishTest]);

  const startSession = (nextMode: Mode, deck: QuizQuestion[]) => {
    const sess = nextMode === "test" ? prepareQuiz(deck) : [...deck];
    setMode(nextMode);
    setSession(sess);
    setAnswers({});
    setSubmitted(false);
    setSecondsLeft(nextMode === "test" ? sess.length * SECONDS_PER_Q : 0);
  };

  const reviewWrong = () => {
    const subset = questions.filter((q) => savedWrong.includes(q.q));
    if (subset.length === 0) return;
    startSession("practica", subset);
    toast.message(`Repasando ${subset.length} pregunta(s) que fallaste`);
  };

  // In práctica, once all answered, auto-persist + save (immediate feedback already shown).
  const practicaDone = mode === "practica" && allAnswered;
  useEffect(() => {
    if (practicaDone && !submitted) {
      setSubmitted(true);
      persistWrong(session, answers);
      void saveResult(score, session, answers);
    }
  }, [practicaDone, submitted, persistWrong, saveResult, session, answers, score]);

  const revealFeedback = (i: number) =>
    mode === "practica" ? answers[i] !== undefined : submitted;

  return (
    <div className="space-y-6">
      {celebration && (
        <CelebrationOverlay
          key={celebration.key}
          milestones={[{
            kind: "achievement",
            title: "¡Quiz aprobado!",
            detail: `${celebration.score}/${celebration.total} · cuenta para tu progreso`,
          }]}
        />
      )}

      <Link href={`/securities/cybersec/lessons/${lessonId}`} className="inline-flex items-center gap-1.5 text-sm text-[#94a3b8] hover:text-[#22d3ee]">
        <ArrowLeft size={14} /> Volver a la lección
      </Link>

      <header className="space-y-1">
        <p className="text-[10px] font-mono uppercase tracking-wider text-[#475569]">Quiz · Lección {lessonId} · Nivel {QUIZ_LEVEL_LABELS[level]}</p>
        <h1 className="text-xl font-bold text-[#e2e8f0] font-mono">{lessonTitle}</h1>
      </header>

      {/* Mode selector */}
      <div className="flex flex-wrap items-center gap-2">
        <ModeBtn active={mode === "practica"} onClick={() => startSession("practica", questions)} icon={<GraduationCap size={14} />} label="Práctica" hint="feedback inmediato" />
        <ModeBtn active={mode === "test"} onClick={() => startSession("test", questions)} icon={<Timer size={14} />} label="Test" hint="cronometrado, sin pistas" />
        {savedWrong.length > 0 && (
          <button onClick={reviewWrong} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs border border-[#eab308]/40 text-[#eab308] hover:bg-[#eab308]/10">
            <RotateCcw size={13} /> Repasar {savedWrong.length} falladas
          </button>
        )}
        {mode === "test" && !submitted && (
          <span className={`ml-auto inline-flex items-center gap-1.5 text-sm font-bold font-mono ${secondsLeft <= 30 ? "text-[#ef4444]" : "text-[#22d3ee]"}`}>
            <Clock size={14} /> {formatClock(secondsLeft)}
          </span>
        )}
      </div>

      {submitted && <ScoreBanner score={score} total={total} saveState={saveState} />}

      <div className="space-y-4">
        {session.map((q, i) => {
          const userAnswer = answers[i];
          const reveal = revealFeedback(i);
          const isCorrect = userAnswer === q.c;
          const locked = mode === "practica" ? answers[i] !== undefined : submitted;
          return (
            <div key={i} className="rounded-lg border border-[#1f2937] bg-[#0a0e1a] p-4">
              <p className="text-sm font-bold text-[#e2e8f0] mb-3">
                <span className="text-[#22d3ee] mr-2">{i + 1}.</span> {q.q}
              </p>
              <div className="space-y-1.5">
                {q.o.map((opt, oIdx) => {
                  const isSelected = userAnswer === oIdx;
                  const showCorrect = reveal && oIdx === q.c;
                  const showWrong = reveal && isSelected && oIdx !== q.c;
                  return (
                    <button
                      key={oIdx}
                      onClick={() => !locked && setAnswers((p) => ({ ...p, [i]: oIdx }))}
                      disabled={locked}
                      className={`w-full text-left px-3 py-2 rounded text-sm border transition-colors ${
                        showCorrect ? "bg-[#34d399]/10 border-[#34d399]/40 text-[#34d399]"
                        : showWrong ? "bg-[#ef4444]/10 border-[#ef4444]/40 text-[#ef4444]"
                        : isSelected ? "bg-[#22d3ee]/10 border-[#22d3ee]/40 text-[#22d3ee]"
                        : "bg-[#0a0e1a] border-[#1f2937] text-[#e2e8f0] hover:bg-[#151b28]"
                      }`}
                    >
                      <span className="inline-flex items-center gap-2">
                        {showCorrect && <Check size={14} />}
                        {showWrong && <X size={14} />}
                        {opt}
                      </span>
                    </button>
                  );
                })}
              </div>
              {reveal && (
                <p className={`mt-2 text-xs ${isCorrect ? "text-[#34d399]" : "text-[#94a3b8]"}`}>
                  {isCorrect ? "✓ Correcto. " : "✗ "} {q.e}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        {mode === "test" && !submitted ? (
          <button
            onClick={finishTest}
            disabled={!allAnswered || saving}
            className="px-5 py-2 bg-[#22d3ee] hover:bg-[#06b6d4] text-[#0a0e1a] font-bold rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Guardando…" : "Enviar respuestas"}
          </button>
        ) : submitted ? (
          <div className="flex flex-wrap items-center gap-2">
            {nextLessonId != null && (
              <Link
                href={`/securities/cybersec/quizzes/${nextLessonId}`}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#22d3ee] hover:bg-[#06b6d4] text-[#0a0e1a] font-bold rounded text-sm"
              >
                Continuar{nextLessonTitle ? `: ${nextLessonTitle}` : ""} <ArrowRight size={15} />
              </Link>
            )}
            <button
              onClick={() => startSession(mode, questions)}
              className="px-5 py-2 bg-[#1f2937] hover:bg-[#151b28] text-[#e2e8f0] font-bold rounded text-sm"
            >
              Reintentar
            </button>
            {moduleId != null && (
              <Link
                href={`/securities/cybersec/modules/${moduleId}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-[#1f2937] hover:bg-[#151b28] text-[#94a3b8] rounded text-sm"
              >
                <BookOpen size={14} /> Volver al módulo
              </Link>
            )}
          </div>
        ) : null}
        <span className="text-xs text-[#94a3b8]">{answeredCount}/{total} respondidas</span>
      </div>
    </div>
  );
}

function ModeBtn({ active, onClick, icon, label, hint }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; hint: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs border transition-colors ${
        active ? "bg-[#22d3ee]/10 border-[#22d3ee]/40 text-[#22d3ee]" : "bg-[#0a0e1a] border-[#1f2937] text-[#94a3b8] hover:bg-[#151b28]"
      }`}
      title={hint}
    >
      {icon} {label}
    </button>
  );
}

function ScoreBanner({ score, total, saveState }: { score: number; total: number; saveState: SaveState }) {
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const passed = pct >= 70;
  const savedLabel =
    saveState === "saving" ? "Guardando…"
    : saveState === "error" ? "No se pudo guardar — reintenta"
    : saveState === "saved" ? (passed ? "Guardado ✓ · cuenta para tu progreso" : "Guardado ✓")
    : null;
  return (
    <div className={`flex items-center gap-3 rounded-lg border p-4 ${passed ? "border-[#34d399]/40 bg-[#34d399]/5" : "border-[#eab308]/40 bg-[#eab308]/5"}`}>
      <Trophy size={22} className={passed ? "text-[#34d399]" : "text-[#eab308]"} />
      <div>
        <p className="text-lg font-bold text-[#e2e8f0]">{score}/{total} ({pct}%)</p>
        <p className="text-xs text-[#94a3b8]">{passed ? "¡Bien hecho!" : "Repasa la lección y reintenta."}</p>
        {savedLabel && (
          <p className={`mt-0.5 text-[11px] font-mono ${saveState === "error" ? "text-[#ef4444]" : "text-[#34d399]"}`}>{savedLabel}</p>
        )}
      </div>
    </div>
  );
}
