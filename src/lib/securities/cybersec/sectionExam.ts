import { SYLLABUS, SYLLABUS_CATEGORIES } from "./syllabus";
import { LESSONS } from "./lessons";
import { QUIZZES } from "./quizzes";
import type { ExamQuestion } from "./types";

// Examen por sección/categoría: arma el banco reutilizando las preguntas de los
// quizzes de los módulos de esa categoría (sin contenido nuevo). prepareExam()
// luego samplea + baraja por intento.
export const SECTION_EXAM_COUNT = 15;

export function sectionBank(category: string): ExamQuestion[] {
  const moduleIds = new Set(SYLLABUS.filter((m) => m.cat === category).map((m) => m.m));
  const bank: ExamQuestion[] = [];
  for (const lesson of LESSONS) {
    const mid = Number(lesson.sub.slice(1)); // "M5" → 5
    if (!moduleIds.has(mid)) continue;
    const quiz = QUIZZES[lesson.id];
    if (quiz) for (const q of quiz) bank.push({ q: q.q, o: q.o, c: q.c });
  }
  return bank;
}

// Las rutas usan el índice de categoría (evita slugificar nombres con "/").
export function categoryByIndex(idx: number): string | null {
  return SYLLABUS_CATEGORIES[idx] ?? null;
}

export function categoryIndex(category: string): number {
  return (SYLLABUS_CATEGORIES as readonly string[]).indexOf(category);
}
