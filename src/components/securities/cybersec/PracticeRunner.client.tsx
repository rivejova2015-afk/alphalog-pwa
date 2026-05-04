"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, X, Trophy } from "lucide-react";
import { toast } from "sonner";
import type { PracticeExercise } from "@/lib/securities/cybersec";

interface Props {
  practice: PracticeExercise;
}

export function PracticeRunner({ practice }: Props) {
  const [picks, setPicks] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const total = practice.items.length;
  const score = useMemo(() => {
    if (!submitted) return 0;
    return practice.items.reduce((acc, it, i) => acc + (picks[i] === it.a ? 1 : 0), 0);
  }, [picks, submitted, practice.items]);

  const allAnswered = Object.keys(picks).length === total;

  const handlePick = (i: number, opt: string) => {
    if (submitted) return;
    setPicks((prev) => ({ ...prev, [i]: opt }));
  };

  const handleSubmit = () => {
    if (!allAnswered) {
      toast.error(`Faltan ${total - Object.keys(picks).length} por emparejar`);
      return;
    }
    setSubmitted(true);
    const finalScore = practice.items.reduce((acc, it, i) => acc + (picks[i] === it.a ? 1 : 0), 0);
    if (finalScore === total) toast.success("¡Perfecto!");
    else toast.success(`${finalScore}/${total} correctos`);
  };

  return (
    <div className="space-y-6">
      <Link
        href={`/securities/cybersec/lessons/${practice.lesson}`}
        className="inline-flex items-center gap-1.5 text-sm text-[#94a3b8] hover:text-[#22d3ee]"
      >
        <ArrowLeft size={14} /> Volver a la lección
      </Link>

      <header className="space-y-1">
        <p className="text-[10px] font-mono uppercase tracking-wider text-[#475569]">Práctica · #{practice.id}</p>
        <h1 className="text-xl font-bold text-[#e2e8f0] font-mono">{practice.title}</h1>
        <p className="text-xs text-[#94a3b8]">Empareja cada enunciado con la opción correcta.</p>
      </header>

      {submitted && (
        <div className={`flex items-center gap-3 rounded-lg border p-4 ${
          score === total ? "border-[#34d399]/40 bg-[#34d399]/5" : "border-[#eab308]/40 bg-[#eab308]/5"
        }`}>
          <Trophy size={22} className={score === total ? "text-[#34d399]" : "text-[#eab308]"} />
          <p className="text-lg font-bold text-[#e2e8f0]">{score}/{total} correctos</p>
        </div>
      )}

      <div className="space-y-3">
        {practice.items.map((it, i) => {
          const userPick = picks[i];
          const isCorrect = userPick === it.a;
          return (
            <div key={i} className="rounded-lg border border-[#1f2937] bg-[#0a0e1a] p-3">
              <p className="text-sm text-[#e2e8f0] font-mono mb-2">
                <span className="text-[#22d3ee] mr-1.5">{i + 1}.</span> {it.s}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {practice.opts.map((opt) => {
                  const isSelected = userPick === opt;
                  const showCorrect = submitted && opt === it.a;
                  const showWrong = submitted && isSelected && opt !== it.a;
                  return (
                    <button
                      key={opt}
                      onClick={() => handlePick(i, opt)}
                      disabled={submitted}
                      className={`px-2.5 py-1 rounded text-xs border transition-colors ${
                        showCorrect
                          ? "bg-[#34d399]/10 border-[#34d399]/40 text-[#34d399]"
                          : showWrong
                            ? "bg-[#ef4444]/10 border-[#ef4444]/40 text-[#ef4444]"
                            : isSelected
                              ? "bg-[#22d3ee]/10 border-[#22d3ee]/40 text-[#22d3ee]"
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
              {submitted && !isCorrect && (
                <p className="mt-1.5 text-[11px] text-[#94a3b8]">Respuesta correcta: <span className="text-[#34d399] font-bold">{it.a}</span></p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        {!submitted ? (
          <button
            onClick={handleSubmit}
            disabled={!allAnswered}
            className="px-5 py-2 bg-[#22d3ee] hover:bg-[#06b6d4] text-[#0a0e1a] font-bold rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Verificar
          </button>
        ) : (
          <button
            onClick={() => { setPicks({}); setSubmitted(false); }}
            className="px-5 py-2 bg-[#1f2937] hover:bg-[#151b28] text-[#e2e8f0] font-bold rounded text-sm"
          >
            Reintentar
          </button>
        )}
        <span className="text-xs text-[#94a3b8]">{Object.keys(picks).length}/{total} emparejados</span>
      </div>
    </div>
  );
}
