"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, X, Trophy } from "lucide-react";
import { toast } from "sonner";
import type { QuizQuestion } from "@/lib/securities/cybersec";

interface Props {
  lessonId: number;
  lessonTitle: string;
  questions: QuizQuestion[];
}

type Answers = Record<number, number>;

export function QuizRunner({ lessonId, lessonTitle, questions }: Props) {
  const [answers, setAnswers] = useState<Answers>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const total = questions.length;
  const score = submitted
    ? questions.reduce((acc, q, i) => acc + (answers[i] === q.c ? 1 : 0), 0)
    : 0;
  const allAnswered = Object.keys(answers).length === total;

  const handleSelect = (qIdx: number, optIdx: number) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [qIdx]: optIdx }));
  };

  const handleSubmit = async () => {
    if (!allAnswered) {
      toast.error(`Faltan ${total - Object.keys(answers).length} respuestas`);
      return;
    }
    setSaving(true);
    setSubmitted(true);
    const finalScore = questions.reduce((acc, q, i) => acc + (answers[i] === q.c ? 1 : 0), 0);
    try {
      const res = await fetch("/api/securities/cybersec/quiz-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lesson_id: lessonId,
          score: finalScore,
          total,
          answers: questions.map((_, i) => answers[i] ?? -1),
        }),
      });
      if (!res.ok) toast.error("No se pudo guardar el resultado");
      else toast.success(`Quiz guardado: ${finalScore}/${total}`);
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  const handleRestart = () => {
    setAnswers({});
    setSubmitted(false);
  };

  return (
    <div className="space-y-6">
      <Link href={`/securities/cybersec/lessons/${lessonId}`} className="inline-flex items-center gap-1.5 text-sm text-[#94a3b8] hover:text-[#22d3ee]">
        <ArrowLeft size={14} /> Volver a la lección
      </Link>

      <header className="space-y-1">
        <p className="text-[10px] font-mono uppercase tracking-wider text-[#475569]">Quiz · Lección {lessonId}</p>
        <h1 className="text-xl font-bold text-[#e2e8f0] font-mono">{lessonTitle}</h1>
      </header>

      {submitted && <ScoreBanner score={score} total={total} />}

      <div className="space-y-4">
        {questions.map((q, i) => {
          const userAnswer = answers[i];
          const isCorrect = userAnswer === q.c;
          return (
            <div key={i} className="rounded-lg border border-[#1f2937] bg-[#0a0e1a] p-4">
              <p className="text-sm font-bold text-[#e2e8f0] mb-3">
                <span className="text-[#22d3ee] mr-2">{i + 1}.</span> {q.q}
              </p>
              <div className="space-y-1.5">
                {q.o.map((opt, oIdx) => {
                  const isSelected = userAnswer === oIdx;
                  const showCorrect = submitted && oIdx === q.c;
                  const showWrong = submitted && isSelected && oIdx !== q.c;
                  return (
                    <button
                      key={oIdx}
                      onClick={() => handleSelect(i, oIdx)}
                      disabled={submitted}
                      className={`w-full text-left px-3 py-2 rounded text-sm border transition-colors ${
                        showCorrect
                          ? "bg-[#34d399]/10 border-[#34d399]/40 text-[#34d399]"
                          : showWrong
                            ? "bg-[#ef4444]/10 border-[#ef4444]/40 text-[#ef4444]"
                            : isSelected
                              ? "bg-[#22d3ee]/10 border-[#22d3ee]/40 text-[#22d3ee]"
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
              {submitted && (
                <p className={`mt-2 text-xs ${isCorrect ? "text-[#34d399]" : "text-[#94a3b8]"}`}>
                  {isCorrect ? "✓ Correcto. " : "✗ "} {q.e}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        {!submitted ? (
          <button
            onClick={() => void handleSubmit()}
            disabled={!allAnswered || saving}
            className="px-5 py-2 bg-[#22d3ee] hover:bg-[#06b6d4] text-[#0a0e1a] font-bold rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Guardando…" : "Enviar respuestas"}
          </button>
        ) : (
          <button
            onClick={handleRestart}
            className="px-5 py-2 bg-[#1f2937] hover:bg-[#151b28] text-[#e2e8f0] font-bold rounded text-sm"
          >
            Reintentar
          </button>
        )}
        <span className="text-xs text-[#94a3b8]">
          {Object.keys(answers).length}/{total} respondidas
        </span>
      </div>
    </div>
  );
}

function ScoreBanner({ score, total }: { score: number; total: number }) {
  const pct = Math.round((score / total) * 100);
  const passed = pct >= 70;
  return (
    <div className={`flex items-center gap-3 rounded-lg border p-4 ${
      passed ? "border-[#34d399]/40 bg-[#34d399]/5" : "border-[#eab308]/40 bg-[#eab308]/5"
    }`}>
      <Trophy size={22} className={passed ? "text-[#34d399]" : "text-[#eab308]"} />
      <div>
        <p className="text-lg font-bold text-[#e2e8f0]">{score}/{total} ({pct}%)</p>
        <p className="text-xs text-[#94a3b8]">{passed ? "¡Bien hecho!" : "Repasa la lección y reintenta."}</p>
      </div>
    </div>
  );
}
