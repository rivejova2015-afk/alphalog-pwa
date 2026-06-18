"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Trophy, Check, X, Clock, ChevronLeft, ChevronRight, Play, ArrowRight, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import type { ExamQuestion } from "@/lib/securities/cybersec";
import {
  prepareExam,
  formatClock,
  EXAM_QUESTION_COUNT,
  EXAM_SECONDS_PER_QUESTION,
  type PreparedQuestion,
} from "@/lib/securities/cybersec";
import { CelebrationOverlay } from "./CelebrationOverlay.client";

interface Props {
  questions: ExamQuestion[]; // the full bank
  passRatio: number;
  section?: string; // ausente = examen final global; presente = examen de esa categoría
  count?: number;   // cantidad de preguntas a samplear (default = examen final)
  nextLessonId?: number | null;
  nextLessonTitle?: string | null;
}

type SaveState = "idle" | "saving" | "saved" | "error";

interface PriorAttempt {
  attempt_no: number;
  score: number;
  total: number;
  passed: boolean;
  taken_at: string;
}

type Phase = "intro" | "running" | "done";

export function ExamRunner({ questions, passRatio, section, count = EXAM_QUESTION_COUNT, nextLessonId = null, nextLessonTitle = null }: Props) {
  const historyUrl = section
    ? `/api/securities/cybersec/exam-results?section=${encodeURIComponent(section)}`
    : "/api/securities/cybersec/exam-results";
  const [phase, setPhase] = useState<Phase>("intro");
  const [exam, setExam] = useState<PreparedQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [celebrateKey, setCelebrateKey] = useState(0); // >0 → confeti de aprobación
  const [history, setHistory] = useState<PriorAttempt[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(historyUrl);
        if (!res.ok) return;
        const data = (await res.json()) as { results: PriorAttempt[] };
        if (!cancelled) setHistory(data.results ?? []);
      } catch {
        // silent
      }
    })();
    return () => { cancelled = true; };
  }, [historyUrl]);

  const total = exam.length;
  const minToPass = Math.ceil(total * passRatio);
  const answeredCount = Object.keys(answers).length;
  const score = useMemo(
    () => exam.reduce((acc, q, i) => acc + (answers[i] === q.c ? 1 : 0), 0),
    [exam, answers],
  );

  const submit = useCallback(async () => {
    setPhase("done");
    setSaving(true);
    setSaveState("saving");
    const finalScore = exam.reduce((acc, q, i) => acc + (answers[i] === q.c ? 1 : 0), 0);
    const passed = finalScore >= Math.ceil(exam.length * passRatio);
    try {
      const res = await fetch("/api/securities/cybersec/exam-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          score: finalScore,
          total: exam.length,
          answers: exam.map((_, i) => answers[i] ?? -1),
          ...(section ? { section } : {}),
        }),
      });
      if (!res.ok) {
        toast.error("No se pudo guardar el resultado");
        setSaveState("error");
      } else {
        toast.success(passed ? `¡Aprobaste con ${finalScore}/${exam.length}!` : `${finalScore}/${exam.length} — necesitas ${Math.ceil(exam.length * passRatio)}`);
        setSaveState("saved");
      }
    } catch {
      toast.error("Error de conexión");
      setSaveState("error");
    } finally {
      setSaving(false);
    }
    if (passed) setCelebrateKey((k) => k + 1); // confeti inline
  }, [exam, answers, passRatio, section]);

  // Wall-clock countdown: recompute remaining time from a fixed end timestamp so
  // it stays accurate even if the tab is backgrounded (setTimeout throttling).
  useEffect(() => {
    if (phase !== "running" || endsAt == null) return;
    const tick = () => {
      const left = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0) {
        toast.message("⏱ Tiempo agotado — examen enviado");
        void submit();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [phase, endsAt, submit]);

  const start = () => {
    const prepared = prepareExam(questions, count);
    setExam(prepared);
    setAnswers({});
    setIndex(0);
    setSecondsLeft(prepared.length * EXAM_SECONDS_PER_QUESTION);
    setEndsAt(Date.now() + prepared.length * EXAM_SECONDS_PER_QUESTION * 1000);
    setPhase("running");
  };

  // ── Intro ────────────────────────────────────────────────────────────────
  if (phase === "intro") {
    const sampled = Math.min(count, questions.length);
    return (
      <div className="space-y-6">
        <Back />
        <header className="space-y-1">
          <p className="text-[10px] font-mono uppercase tracking-wider text-[#a78bfa]">{section ? "Examen de sección" : "Examen final"}</p>
          <h1 className="text-2xl font-bold text-[#e2e8f0] font-mono">{section ?? "CyberSec Academy"}</h1>
        </header>

        <div className="rounded-lg border border-[#1f2937] bg-[#0a0e1a] p-5 space-y-3">
          <p className="text-sm text-[#e2e8f0]">Modo certificación:</p>
          <ul className="text-sm text-[#94a3b8] space-y-1.5">
            <li>📋 <span className="text-[#e2e8f0]">{sampled} preguntas</span> muestreadas al azar del banco ({questions.length}).</li>
            <li>🔀 Orden de preguntas y opciones aleatorio — cada intento es distinto.</li>
            <li>⏱ <span className="text-[#e2e8f0]">{formatClock(sampled * EXAM_SECONDS_PER_QUESTION)}</span> de tiempo (1 min por pregunta). Al agotarse se envía solo.</li>
            <li>🚫 Sin feedback hasta finalizar. Una pregunta a la vez.</li>
            <li>🏆 Aprobás con ≥ {Math.round(passRatio * 100)}%.</li>
          </ul>
          <button
            onClick={start}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#a78bfa] hover:bg-[#9061f9] text-[#0a0e1a] font-bold rounded text-sm"
          >
            <Play size={15} /> Comenzar examen
          </button>
        </div>

        {history.length > 0 && (
          <details className="rounded-lg border border-[#1f2937] bg-[#0a0e1a] p-3">
            <summary className="text-xs font-bold uppercase tracking-wider text-[#94a3b8] cursor-pointer">
              Intentos anteriores ({history.length})
            </summary>
            <ul className="mt-2 space-y-1 text-xs text-[#e2e8f0]">
              {history.slice(0, 10).map((h) => (
                <li key={h.attempt_no} className="flex items-center justify-between">
                  <span>#{h.attempt_no} · {new Date(h.taken_at).toLocaleString()}</span>
                  <span className={h.passed ? "text-[#34d399] font-bold" : "text-[#94a3b8]"}>
                    {h.score}/{h.total} {h.passed ? "PASS" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    );
  }

  // ── Done (review) ────────────────────────────────────────────────────────
  if (phase === "done") {
    const passed = score >= minToPass;
    return (
      <div className="space-y-6">
        {passed && celebrateKey > 0 && (
          <CelebrationOverlay
            key={celebrateKey}
            milestones={[{
              kind: "exam",
              title: section ? "¡Sección aprobada!" : "¡Graduado!",
              detail: section ? `${section} · ${score}/${total}` : `Aprobaste el examen final · ${score}/${total}`,
            }]}
          />
        )}
        <Back />
        <ResultBanner score={score} total={total} minToPass={minToPass} saveState={saveState} />
        <div className="space-y-3">
          {exam.map((q, i) => {
            const ua = answers[i];
            return (
              <div key={i} className="rounded-lg border border-[#1f2937] bg-[#0a0e1a] p-3">
                <p className="text-sm font-bold text-[#e2e8f0] mb-2"><span className="text-[#a78bfa] mr-2">{i + 1}.</span> {q.q}</p>
                <div className="space-y-1">
                  {q.o.map((opt, oIdx) => {
                    const correct = oIdx === q.c;
                    const wrong = ua === oIdx && oIdx !== q.c;
                    return (
                      <div key={oIdx} className={`px-3 py-1.5 rounded text-xs border ${
                        correct ? "bg-[#34d399]/10 border-[#34d399]/40 text-[#34d399]"
                        : wrong ? "bg-[#ef4444]/10 border-[#ef4444]/40 text-[#ef4444]"
                        : "border-[#1f2937] text-[#94a3b8]"
                      }`}>
                        {correct && <Check size={11} className="inline mr-1" />}
                        {wrong && <X size={11} className="inline mr-1" />}
                        {opt}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {passed && (
            nextLessonId != null ? (
              <Link
                href={`/securities/cybersec/quizzes/${nextLessonId}`}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#34d399] hover:bg-[#10b981] text-[#0a0e1a] font-bold rounded text-sm"
              >
                Continuar{nextLessonTitle ? `: ${nextLessonTitle}` : ""} <ArrowRight size={15} />
              </Link>
            ) : (
              <Link
                href="/securities/cybersec"
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#34d399] hover:bg-[#10b981] text-[#0a0e1a] font-bold rounded text-sm"
              >
                <TrendingUp size={15} /> Ver tu progreso
              </Link>
            )
          )}
          <button
            onClick={() => setPhase("intro")}
            className="px-5 py-2 bg-[#1f2937] hover:bg-[#151b28] text-[#e2e8f0] font-bold rounded text-sm"
          >
            Nuevo intento
          </button>
        </div>
      </div>
    );
  }

  // ── Running (stepper) ──────────────────────────────────────────────────────
  const q = exam[index];
  const lowTime = secondsLeft <= 60;
  return (
    <div className="space-y-5">
      {/* Sticky-ish header: timer + progress */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-[#94a3b8] font-mono">Pregunta {index + 1} / {total}</span>
        <span className={`inline-flex items-center gap-1.5 text-sm font-bold font-mono ${lowTime ? "text-[#ef4444]" : "text-[#22d3ee]"}`}>
          <Clock size={14} /> {formatClock(secondsLeft)}
        </span>
      </div>
      <div className="h-1.5 w-full rounded bg-[#1f2937] overflow-hidden">
        <div className="h-full bg-[#a78bfa] transition-all" style={{ width: `${((index + 1) / total) * 100}%` }} />
      </div>

      <div className="rounded-lg border border-[#1f2937] bg-[#0a0e1a] p-4">
        <p className="text-base font-bold text-[#e2e8f0] mb-3">{q.q}</p>
        <div className="space-y-1.5" role="radiogroup" aria-label={`Pregunta ${index + 1}`}>
          {q.o.map((opt, oIdx) => {
            const selected = answers[index] === oIdx;
            return (
              <button
                key={oIdx}
                role="radio"
                aria-checked={selected}
                onClick={() => setAnswers((p) => ({ ...p, [index]: oIdx }))}
                className={`w-full text-left px-3 py-2 rounded text-sm border transition-colors ${
                  selected ? "bg-[#a78bfa]/10 border-[#a78bfa]/50 text-[#a78bfa]"
                  : "bg-[#0a0e1a] border-[#1f2937] text-[#e2e8f0] hover:bg-[#151b28]"
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      {/* Nav */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          aria-label="Anterior"
          className="inline-flex items-center gap-1 px-3 py-2 rounded text-sm bg-[#1f2937] hover:bg-[#151b28] text-[#e2e8f0] disabled:opacity-40"
        >
          <ChevronLeft size={16} /> Anterior
        </button>
        {index < total - 1 ? (
          <button
            onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
            aria-label="Siguiente"
            className="inline-flex items-center gap-1 px-3 py-2 rounded text-sm bg-[#1f2937] hover:bg-[#151b28] text-[#e2e8f0]"
          >
            Siguiente <ChevronRight size={16} />
          </button>
        ) : (
          <button
            onClick={() => void submit()}
            disabled={saving}
            className="px-5 py-2 bg-[#a78bfa] hover:bg-[#9061f9] text-[#0a0e1a] font-bold rounded text-sm disabled:opacity-50"
          >
            Finalizar examen
          </button>
        )}
      </div>

      {/* Question palette */}
      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[#1f2937]">
        {exam.map((_, i) => {
          const answered = answers[i] !== undefined;
          const current = i === index;
          return (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Ir a pregunta ${i + 1}${answered ? " (respondida)" : ""}`}
              className={`w-7 h-7 rounded text-[11px] font-mono border ${
                current ? "border-[#a78bfa] text-[#a78bfa]"
                : answered ? "bg-[#a78bfa]/20 border-[#a78bfa]/40 text-[#e2e8f0]"
                : "border-[#1f2937] text-[#475569] hover:bg-[#151b28]"
              }`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-xs text-[#94a3b8]">
        <span>{answeredCount}/{total} respondidas</span>
        <button onClick={() => void submit()} disabled={saving} className="underline hover:text-[#e2e8f0]">
          Finalizar ahora
        </button>
      </div>
    </div>
  );
}

function Back() {
  return (
    <Link href="/securities/cybersec" className="inline-flex items-center gap-1.5 text-sm text-[#94a3b8] hover:text-[#22d3ee]">
      <ArrowLeft size={14} /> Volver al syllabus
    </Link>
  );
}

function ResultBanner({ score, total, minToPass, saveState }: { score: number; total: number; minToPass: number; saveState: SaveState }) {
  const passed = score >= minToPass;
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const savedLabel =
    saveState === "saving" ? "Guardando…"
    : saveState === "error" ? "No se pudo guardar — reintenta"
    : saveState === "saved" ? "Guardado ✓ · cuenta para tu progreso"
    : null;
  return (
    <div className={`flex items-center gap-3 rounded-lg border p-4 ${
      passed ? "border-[#34d399]/40 bg-[#34d399]/5" : "border-[#ef4444]/40 bg-[#ef4444]/5"
    }`}>
      <Trophy size={28} className={passed ? "text-[#34d399]" : "text-[#ef4444]"} />
      <div>
        <p className="text-xl font-bold text-[#e2e8f0]">{score}/{total} ({pct}%)</p>
        <p className="text-xs text-[#94a3b8]">
          {passed ? "¡Aprobaste el examen final!" : `Necesitas al menos ${minToPass} aciertos para aprobar.`}
        </p>
        {savedLabel && (
          <p className={`mt-0.5 text-[11px] font-mono ${saveState === "error" ? "text-[#ef4444]" : "text-[#34d399]"}`}>{savedLabel}</p>
        )}
      </div>
    </div>
  );
}
