"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, RotateCcw, Shuffle } from "lucide-react";
import type { Flashcard } from "@/lib/securities/cybersec";

interface Props {
  cards: Flashcard[];
  categories: string[];
}

const ALL = "Todas";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function FlashcardDeck({ cards, categories }: Props) {
  const [cat, setCat] = useState<string>(ALL);
  const [order, setOrder] = useState<number[] | null>(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const filtered = useMemo(
    () => (cat === ALL ? cards : cards.filter((c) => c.cat === cat)),
    [cards, cat],
  );

  // Apply shuffle order if active, otherwise natural order.
  const deck = useMemo(() => {
    if (!order) return filtered;
    const byId = new Map(filtered.map((c) => [c.id, c]));
    return order.map((id) => byId.get(id)).filter((c): c is Flashcard => Boolean(c));
  }, [filtered, order]);

  const total = deck.length;
  const card = deck[index];

  const reset = (nextCat?: string) => {
    if (nextCat !== undefined) setCat(nextCat);
    setOrder(null);
    setIndex(0);
    setFlipped(false);
  };

  const go = (delta: number) => {
    if (total === 0) return;
    setFlipped(false);
    setIndex((i) => (i + delta + total) % total);
  };

  const doShuffle = () => {
    setOrder(shuffle(filtered.map((c) => c.id)));
    setIndex(0);
    setFlipped(false);
  };

  return (
    <div className="space-y-6">
      <Link href="/securities/cybersec" className="inline-flex items-center gap-1.5 text-sm text-[#94a3b8] hover:text-[#22d3ee]">
        <ArrowLeft size={14} /> Volver al syllabus
      </Link>

      <header className="space-y-1">
        <p className="text-[10px] font-mono uppercase tracking-wider text-[#475569]">Repaso · Active recall</p>
        <h1 className="text-2xl font-bold text-[#e2e8f0] font-mono">Flashcards</h1>
        <p className="text-sm text-[#94a3b8]">Tocá la tarjeta para ver la respuesta.</p>
      </header>

      {/* Category filter */}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por categoría">
        {[ALL, ...categories].map((c) => (
          <button
            key={c}
            onClick={() => reset(c)}
            aria-pressed={cat === c}
            className={`px-2.5 py-1 rounded text-xs border transition-colors ${
              cat === c
                ? "bg-[#22d3ee]/10 border-[#22d3ee]/40 text-[#22d3ee]"
                : "bg-[#0a0e1a] border-[#1f2937] text-[#94a3b8] hover:bg-[#151b28]"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {total === 0 ? (
        <p className="text-sm text-[#475569]">No hay tarjetas en esta categoría.</p>
      ) : (
        <>
          {/* Card */}
          <button
            onClick={() => setFlipped((f) => !f)}
            aria-label={flipped ? "Ver término" : "Ver respuesta"}
            className="w-full min-h-[180px] rounded-2xl border border-[#1f2937] bg-[#0a0e1a] p-6 flex flex-col items-center justify-center text-center transition-colors hover:border-[#22d3ee]/40"
          >
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#a78bfa] mb-3">
              {card.cat} · {flipped ? "Respuesta" : "Término"}
            </span>
            <span className={`${flipped ? "text-base text-[#e2e8f0]" : "text-xl font-bold text-[#e2e8f0] font-mono"} leading-relaxed`}>
              {flipped ? card.back : card.front}
            </span>
          </button>

          {/* Controls */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => go(-1)}
              aria-label="Anterior"
              className="inline-flex items-center gap-1 px-3 py-2 rounded text-sm bg-[#1f2937] hover:bg-[#151b28] text-[#e2e8f0]"
            >
              <ChevronLeft size={16} /> Anterior
            </button>

            <span className="text-xs text-[#94a3b8] font-mono">{index + 1} / {total}</span>

            <button
              onClick={() => go(1)}
              aria-label="Siguiente"
              className="inline-flex items-center gap-1 px-3 py-2 rounded text-sm bg-[#1f2937] hover:bg-[#151b28] text-[#e2e8f0]"
            >
              Siguiente <ChevronRight size={16} />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={doShuffle}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs bg-[#0a0e1a] border border-[#1f2937] text-[#94a3b8] hover:text-[#22d3ee]"
            >
              <Shuffle size={13} /> Mezclar
            </button>
            <button
              onClick={() => reset()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs bg-[#0a0e1a] border border-[#1f2937] text-[#94a3b8] hover:text-[#22d3ee]"
            >
              <RotateCcw size={13} /> Reiniciar
            </button>
          </div>
        </>
      )}
    </div>
  );
}
