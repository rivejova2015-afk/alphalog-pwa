import type { ExamQuestion } from "./types";

// Exam session helpers: turn the static question bank into a fresh, randomized
// exam each attempt (sampled subset + shuffled question and option order).

export interface PreparedQuestion {
  q: string;
  o: string[];
  c: number; // index of the correct option AFTER shuffling
}

// Fisher–Yates shuffle returning a NEW array. `rng` is injectable for tests.
export function shuffle<T>(arr: readonly T[], rng: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Builds a randomized exam attempt from the bank: samples `count` questions
 * (shuffled), and shuffles each question's options, recomputing the correct
 * index so it still points at the right answer.
 */
export function prepareExam(
  bank: ExamQuestion[],
  count: number,
  rng: () => number = Math.random,
): PreparedQuestion[] {
  const picked = shuffle(bank, rng).slice(0, Math.max(1, Math.min(count, bank.length)));
  return picked.map((q) => {
    const correctText = q.o[q.c];
    const opts = shuffle(q.o, rng);
    return { q: q.q, o: opts, c: opts.indexOf(correctText) };
  });
}

// Number of questions sampled per attempt and the time budget (1 min/question).
export const EXAM_QUESTION_COUNT = 40;
export const EXAM_SECONDS_PER_QUESTION = 60;

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}
