"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RotateCcw, Check, Zap } from "lucide-react";
import { toast } from "sonner";
import { FLASHCARDS, dueIds, type SrsCard, type SrsGrade, type Flashcard } from "@/lib/securities/cybersec";

const SESSION_CAP = 20;

export function ReviewSession() {
  const [map, setMap] = useState<Record<string, SrsCard> | null>(null);
  const [deck, setDeck] = useState<Flashcard[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let m: Record<string, SrsCard> = {};
      try {
        const res = await fetch("/api/securities/cybersec/srs");
        if (res.ok) m = ((await res.json()).srs ?? {}) as Record<string, SrsCard>;
      } catch { /* offline → trata todo como nuevo */ }
      if (cancelled) return;
      const due = dueIds(FLASHCARDS.map((c) => `fc:${c.id}`), m);
      const dueSet = new Set(due);
      setMap(m);
      setDeck(FLASHCARDS.filter((c) => dueSet.has(`fc:${c.id}`)).slice(0, SESSION_CAP));
    })();
    return () => { cancelled = true; };
  }, []);

  const total = deck.length;
  const card = deck[index];
  const finished = map !== null && index >= total;

  const grade = async (g: SrsGrade) => {
    if (!card) return;
    setSaving(true);
    try {
      await fetch("/api/securities/cybersec/srs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: `fc:${card.id}`, grade: g }),
      });
    } catch {
      toast.error("No se pudo guardar el repaso");
    } finally {
      setSaving(false);
    }
    setDone((d) => d + 1);
    setFlipped(false);
    setIndex((i) => i + 1);
  };

  const back = (
    <Link href="/securities/cybersec" className="inline-flex items-center gap-1.5 text-sm text-[#94a3b8] hover:text-[#22d3ee]">
      <ArrowLeft size={14} /> Volver al syllabus
    </Link>
  );

  if (map === null) {
    return <div className="space-y-6">{back}<div className="h-44 rounded-2xl border border-[#1f2937] bg-[#0a0e1a] animate-pulse" /></div>;
  }

  if (total === 0) {
    return (
      <div className="space-y-6">
        {back}
        <div className="rounded-2xl border border-[#34d399]/40 bg-[#34d399]/5 p-8 text-center">
          <Check size={40} className="mx-auto text-[#34d399]" />
          <p className="mt-3 text-lg font-bold text-[#e2e8f0]">¡Estás al día!</p>
          <p className="text-sm text-[#94a3b8]">No hay tarjetas para repasar hoy. Volvé mañana.</p>
        </div>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="space-y-6">
        {back}
        <div className="rounded-2xl border border-[#22d3ee]/40 bg-[#22d3ee]/5 p-8 text-center">
          <Zap size={40} className="mx-auto text-[#22d3ee]" />
          <p className="mt-3 text-lg font-bold text-[#e2e8f0]">Repaso completo</p>
          <p className="text-sm text-[#94a3b8]">Repasaste {done} tarjeta(s). Las volverás a ver según tu desempeño.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {back}
      <header className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-[#22d3ee]">Repaso diario</p>
          <h1 className="text-xl font-bold text-[#e2e8f0] font-mono">{card.cat}</h1>
        </div>
        <span className="text-xs text-[#94a3b8] font-mono">{index + 1} / {total}</span>
      </header>

      <div className="h-1.5 w-full rounded bg-[#1f2937] overflow-hidden">
        <div className="h-full bg-[#22d3ee] transition-all" style={{ width: `${(index / total) * 100}%` }} />
      </div>

      <button
        onClick={() => setFlipped((f) => !f)}
        aria-label={flipped ? "Ver término" : "Ver respuesta"}
        className="w-full min-h-[180px] rounded-2xl border border-[#1f2937] bg-[#0a0e1a] p-6 flex flex-col items-center justify-center text-center hover:border-[#22d3ee]/40"
      >
        <span className="text-[10px] font-mono uppercase tracking-wider text-[#a78bfa] mb-3">{flipped ? "Respuesta" : "Término"} · tocá para girar</span>
        <span className={`${flipped ? "text-base text-[#e2e8f0]" : "text-xl font-bold text-[#e2e8f0] font-mono"} leading-relaxed`}>
          {flipped ? card.back : card.front}
        </span>
      </button>

      {flipped ? (
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => void grade("again")} disabled={saving} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#ef4444]/40 bg-[#ef4444]/10 px-3 py-2.5 text-sm font-bold text-[#ef4444] disabled:opacity-50">
            <RotateCcw size={14} /> Otra vez
          </button>
          <button onClick={() => void grade("good")} disabled={saving} className="rounded-lg border border-[#22d3ee]/40 bg-[#22d3ee]/10 px-3 py-2.5 text-sm font-bold text-[#22d3ee] disabled:opacity-50">
            Bien
          </button>
          <button onClick={() => void grade("easy")} disabled={saving} className="rounded-lg border border-[#34d399]/40 bg-[#34d399]/10 px-3 py-2.5 text-sm font-bold text-[#34d399] disabled:opacity-50">
            Fácil
          </button>
        </div>
      ) : (
        <button onClick={() => setFlipped(true)} className="w-full rounded-lg bg-[#1f2937] hover:bg-[#151b28] px-4 py-2.5 text-sm font-bold text-[#e2e8f0]">
          Mostrar respuesta
        </button>
      )}
    </div>
  );
}
