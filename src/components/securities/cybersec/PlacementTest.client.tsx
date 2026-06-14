"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, X, Compass, ArrowRight } from "lucide-react";
import { placementBank, scorePlacement, SYLLABUS, type PlacementResult } from "@/lib/securities/cybersec";

export function PlacementTest() {
  const bank = useMemo(() => placementBank(), []);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<PlacementResult | null>(null);

  const total = bank.length;
  const answeredCount = Object.keys(answers).length;

  const finish = () => {
    const arr = bank.map((_, i) => answers[i] ?? -1);
    setResult(scorePlacement(arr, bank));
    // marca como hecho (best-effort, no bloquea el resultado)
    void fetch("/api/securities/cybersec/user-state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placement_done: true }),
    }).catch(() => {});
  };

  const recommendedModule = result?.recommended
    ? SYLLABUS.find((m) => m.cat === result.recommended)?.m ?? null
    : null;

  return (
    <div className="space-y-6">
      <Link href="/securities/cybersec" className="inline-flex items-center gap-1.5 text-sm text-[#94a3b8] hover:text-[#22d3ee]">
        <ArrowLeft size={14} /> Volver al syllabus
      </Link>
      <header className="space-y-1">
        <p className="text-[10px] font-mono uppercase tracking-wider text-[#a78bfa]">Test de nivelación</p>
        <h1 className="text-2xl font-bold text-[#e2e8f0] font-mono">¿Por dónde empezar?</h1>
        <p className="text-sm text-[#94a3b8]">Una pregunta por categoría. Respondé lo que sepas; te recomendamos dónde enfocar.</p>
      </header>

      {result ? (
        <div className="space-y-5">
          <div className="rounded-xl border border-[#22d3ee]/40 bg-[#22d3ee]/5 p-5 text-center">
            <Compass size={36} className="mx-auto text-[#22d3ee]" />
            <p className="mt-2 text-lg font-bold text-[#e2e8f0]">{result.correctCount}/{result.total} correctas</p>
            {result.recommended ? (
              <>
                <p className="text-sm text-[#94a3b8]">Te conviene empezar por <span className="text-[#e2e8f0] font-bold">{result.recommended}</span>.</p>
                {recommendedModule != null && (
                  <Link href={`/securities/cybersec/modules/${recommendedModule}`} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#22d3ee] px-4 py-2 text-sm font-bold text-[#0a0e1a]">
                    Empezar acá <ArrowRight size={14} />
                  </Link>
                )}
              </>
            ) : (
              <p className="text-sm text-[#34d399]">¡Dominás todas las categorías base! Apuntá al Doctorate Track.</p>
            )}
          </div>

          <div className="space-y-1.5">
            {result.perCategory.map((p) => (
              <div key={p.cat} className="flex items-center justify-between rounded-lg border border-[#1f2937] bg-[#0a0e1a] px-3 py-2 text-sm">
                <span className="text-[#e2e8f0]">{p.cat}</span>
                {p.correct
                  ? <span className="inline-flex items-center gap-1 text-[#34d399]"><Check size={14} /> ok</span>
                  : <span className="inline-flex items-center gap-1 text-[#ef4444]"><X size={14} /> repasar</span>}
              </div>
            ))}
          </div>

          <Link href="/securities/cybersec/path" className="inline-flex items-center gap-1.5 text-sm text-[#a78bfa] hover:underline">
            Ver mi camino <ArrowRight size={14} />
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {bank.map((it, i) => (
              <div key={i} className="rounded-lg border border-[#1f2937] bg-[#0a0e1a] p-4">
                <p className="text-[10px] uppercase tracking-wider text-[#a78bfa] font-bold mb-1">{it.cat}</p>
                <p className="text-sm font-bold text-[#e2e8f0] mb-2">{it.question.q}</p>
                <div className="space-y-1.5">
                  {it.question.o.map((opt, oIdx) => {
                    const selected = answers[i] === oIdx;
                    return (
                      <button
                        key={oIdx}
                        onClick={() => setAnswers((p) => ({ ...p, [i]: oIdx }))}
                        className={`w-full text-left px-3 py-2 rounded text-sm border transition-colors ${
                          selected ? "bg-[#22d3ee]/10 border-[#22d3ee]/40 text-[#22d3ee]" : "bg-[#0a0e1a] border-[#1f2937] text-[#e2e8f0] hover:bg-[#151b28]"
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={finish}
              className="px-5 py-2 bg-[#a78bfa] hover:bg-[#9061f9] text-[#0a0e1a] font-bold rounded text-sm"
            >
              Ver resultado
            </button>
            <span className="text-xs text-[#94a3b8]">{answeredCount}/{total} respondidas</span>
          </div>
        </>
      )}
    </div>
  );
}
