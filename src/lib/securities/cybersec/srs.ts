// Spaced-repetition scheduler (SM-2 lite) for flashcard review. Pure → testeable.
// State per item is persisted in securities_user_state.srs (jsonb).

export interface SrsCard {
  ease: number;     // factor de facilidad (>= 1.3)
  interval: number; // días hasta el próximo repaso
  reps: number;     // repasos correctos seguidos
  lapses: number;   // veces que se falló
  due: string;      // YYYY-MM-DD del próximo repaso
}

export type SrsGrade = "again" | "good" | "easy";

const DAY = 86400000;

function dayStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function newCard(now: Date = new Date()): SrsCard {
  return { ease: 2.5, interval: 0, reps: 0, lapses: 0, due: dayStr(now) };
}

export function review(card: SrsCard, grade: SrsGrade, now: Date = new Date()): SrsCard {
  let { ease, interval, reps, lapses } = card;

  if (grade === "again") {
    reps = 0;
    lapses += 1;
    ease = Math.max(1.3, ease - 0.2);
    interval = 0; // vuelve a estar pendiente hoy
  } else {
    reps += 1;
    if (grade === "easy") ease += 0.15;
    if (reps === 1) interval = grade === "easy" ? 2 : 1;
    else if (reps === 2) interval = grade === "easy" ? 8 : 6;
    else interval = Math.round(interval * ease * (grade === "easy" ? 1.3 : 1));
  }

  const due = new Date(now.getTime() + interval * DAY);
  return { ease: Math.round(ease * 100) / 100, interval, reps, lapses, due: dayStr(due) };
}

export function isDue(card: SrsCard | undefined, now: Date = new Date()): boolean {
  if (!card) return true; // tarjeta nueva → pendiente
  return card.due <= dayStr(now);
}

// IDs de los ítems pendientes de repaso hoy (nuevos + vencidos).
export function dueIds(allIds: string[], map: Record<string, SrsCard>, now: Date = new Date()): string[] {
  return allIds.filter((id) => isDue(map[id], now));
}
