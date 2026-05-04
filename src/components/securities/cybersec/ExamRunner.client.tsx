"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Trophy, Check, X } from "lucide-react";
import { toast } from "sonner";
import type { ExamQuestion } from "@/lib/securities/cybersec";

interface Props {
  questions: ExamQuestion[];
  passRatio: number;
}

interface PriorAttempt {
  attempt_no: number;
  score: number;
  total: number;
  passed: boolean;
  taken_at: string;
}

export function ExamRunner({ questions, passRatio }: Props) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<PriorAttempt[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/securities/cybersec/exam-results");
        if (!res.ok) return;
        const data = (await res.json()) as { results: PriorAttempt[] };
        if (!cancelled) setHistory(data.results ?? []);
      } catch {
        // silent
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const total = questions.length;
  const score = submitted
    ? questions.reduce((acc, q, i) => acc + (answers[i] === q.c ? 1 : 0), 0)
    : 0;
  const allAnswered = Object.keys(answers).length === total;
  const minToPass = Math.ceil(total * passRatio);

  const handleSubmit = async () => {
    if (!allAnswered) {
      toast.error(`Faltan ${total - Object.keys(answers).length} respuestas`);
      return;
    }
    setSaving(true);
    setSubmitted(true);
    const finalScore = questions.reduce((acc, q, i) => acc + (answers[i] === q.c ? 1 : 0), 0);
    try {
      const res = await fetch("/api/securities/cybersec/exam-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          score: finalScore,
          total,
          answers: questions.map((_, i) => answers[i] ?? -1),
        }),
      });
      if (!res.ok) {
        toast.error("No se pudo guardar el resultado");
      } else {
        const passed = finalScore >= minToPass;
        toast.success(passed ? `¡Aprobaste con ${finalScore}/${total}!` : `${finalScore}/${total} — necesitas ${minToPass}`);
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link href="/securities/cybersec" className="inline-flex items-center gap-1.5 text-sm text-[#94a3b8] hover:text-[#22d3ee]">
        <ArrowLeft size={14} /> Volver al syllabus
      </Link>

      <header className="space-y-1">
        <p className="text-[10px] font-mono uppercase tracking-wider text-[#a78bfa]">Examen final</p>
        <h1 className="text-2xl font-bold text-[#e2e8f0] font-mono">CyberSec Academy</h1>
        <p className="text-xs text-[#94a3b8]">{total} preguntas · pasa con ≥ {minToPass} aciertos ({Math.round(passRatio * 100)}%)</p>
      </header>

      {submitted && <ResultBanner score={score} total={total} minToPass={minToPass} />}

      {history.length > 0 && !submitted && (
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

      <div className="space-y-3">
        {questions.map((q, i) => {
          const userAnswer = answers[i];
          return (
            <div key={i} className="rounded-lg border border-[#1f2937] bg-[#0a0e1a] p-3">
              <p className="text-sm font-bold text-[#e2e8f0] mb-2">
                <span className="text-[#a78bfa] mr-2">{i + 1}.</span> {q.q}
              </p>
              <div className="space-y-1">
                {q.o.map((opt, oIdx) => {
                  const isSelected = userAnswer === oIdx;
                  const showCorrect = submitted && oIdx === q.c;
                  const showWrong = submitted && isSelected && oIdx !== q.c;
                  return (
                    <button
                      key={oIdx}
                      onClick={() => !submitted && setAnswers((p) => ({ ...p, [i]: oIdx }))}
                      disabled={submitted}
                      className={`w-full text-left px-3 py-1.5 rounded text-xs border transition-colors ${
                        showCorrect
                          ? "bg-[#34d399]/10 border-[#34d399]/40 text-[#34d399]"
                          : showWrong
                            ? "bg-[#ef4444]/10 border-[#ef4444]/40 text-[#ef4444]"
                            : isSelected
                              ? "bg-[#a78bfa]/10 border-[#a78bfa]/40 text-[#a78bfa]"
                              : "bg-[#0a0e1a] border-[#1f2937] text-[#e2e8f0] hover:bg-[#151b28]"
                      }`}
                    >
                      {showCorrect && <Check size={11} className="inline mr-1" />}
                      {showWrong && <X size={11} className="inline mr-1" />}
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 pt-2 border-t border-[#1f2937]">
        {!submitted ? (
          <button
            onClick={() => void handleSubmit()}
            disabled={!allAnswered || saving}
            className="px-5 py-2 bg-[#a78bfa] hover:bg-[#9061f9] text-[#0a0e1a] font-bold rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Guardando…" : "Finalizar examen"}
          </button>
        ) : (
          <button
            onClick={() => { setAnswers({}); setSubmitted(false); }}
            className="px-5 py-2 bg-[#1f2937] hover:bg-[#151b28] text-[#e2e8f0] font-bold rounded text-sm"
          >
            Nuevo intento
          </button>
        )}
        <span className="text-xs text-[#94a3b8]">{Object.keys(answers).length}/{total} respondidas</span>
      </div>
    </div>
  );
}

function ResultBanner({ score, total, minToPass }: { score: number; total: number; minToPass: number }) {
  const passed = score >= minToPass;
  const pct = Math.round((score / total) * 100);
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
      </div>
    </div>
  );
}
