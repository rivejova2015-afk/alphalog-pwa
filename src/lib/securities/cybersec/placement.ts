import { SYLLABUS_CATEGORIES, SYLLABUS } from "./syllabus";
import { LESSONS } from "./lessons";
import { QUIZZES } from "./quizzes";
import type { ExamQuestion } from "./types";

// Test de nivelación: 1 pregunta representativa por categoría (la primera del
// quiz del primer módulo de la categoría). No auto-completa progreso: solo
// recomienda por dónde empezar.
export interface PlacementItem {
  cat: string;
  question: ExamQuestion;
}

export function placementBank(): PlacementItem[] {
  const items: PlacementItem[] = [];
  for (const cat of SYLLABUS_CATEGORIES) {
    const mod = SYLLABUS.find((m) => m.cat === cat);
    if (!mod) continue;
    const lesson = LESSONS.find((l) => l.sub === `M${mod.m}`);
    if (!lesson) continue;
    const quiz = QUIZZES[lesson.id];
    if (!quiz || quiz.length === 0) continue;
    const q = quiz[0];
    items.push({ cat, question: { q: q.q, o: q.o, c: q.c } });
  }
  return items;
}

export interface PlacementResult {
  perCategory: { cat: string; correct: boolean }[];
  correctCount: number;
  total: number;
  recommended: string | null; // primera categoría fallada = por dónde empezar
}

export function scorePlacement(answers: number[], bank: PlacementItem[]): PlacementResult {
  const perCategory = bank.map((it, i) => ({ cat: it.cat, correct: answers[i] === it.question.c }));
  const correctCount = perCategory.filter((p) => p.correct).length;
  const firstWrong = perCategory.find((p) => !p.correct);
  return { perCategory, correctCount, total: bank.length, recommended: firstWrong?.cat ?? null };
}
