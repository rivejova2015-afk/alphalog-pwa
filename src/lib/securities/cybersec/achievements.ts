import type { ProgressContent, ProgressStats } from "./progressStats";
import type { XpData, XpResult } from "./xp";

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  earned: boolean;
  progress?: { cur: number; target: number };
}

interface Def {
  id: string;
  name: string;
  desc: string;
  cur: number;
  target: number;
}

// Derives the achievement set from the learner's data. Everything is computed,
// no persistence: a badge is "earned" when its condition currently holds.
export function computeAchievements(
  content: ProgressContent,
  data: XpData,
  xp: XpResult,
  stats: ProgressStats,
  streak: number,
): Achievement[] {
  // Perfect quizzes (best attempt == total) per distinct lesson.
  const bestByLesson = new Map<number, { score: number; total: number }>();
  for (const r of data.quizResults) {
    const prev = bestByLesson.get(r.lesson_id);
    if (!prev || r.score / r.total > prev.score / prev.total) bestByLesson.set(r.lesson_id, { score: r.score, total: r.total });
  }
  const perfectQuizzes = [...bestByLesson.values()].filter((b) => b.total > 0 && b.score === b.total).length;
  const legendaryCount = Object.values(xp.mastery).filter((m) => m >= 4).length;
  const categoriesWithQuiz = stats.byCategory.filter((c) => c.quizzesTaken > 0).length;
  const totalCategories = stats.byCategory.length;

  const defs: Def[] = [
    { id: "first_quiz", name: "Primer paso", desc: "Completá tu primer quiz", cur: stats.quizzesTaken, target: 1 },
    { id: "ten_quizzes", name: "Estudiante", desc: "Completá 10 quizzes", cur: stats.quizzesTaken, target: 10 },
    { id: "all_quizzes", name: "Maestría total", desc: "Completá el quiz de cada lección", cur: stats.quizzesTaken, target: stats.lessonsTotal },
    { id: "level5", name: "En marcha", desc: "Alcanzá el nivel 5", cur: xp.level.level, target: 5 },
    { id: "level15", name: "Veterano", desc: "Alcanzá el nivel 15", cur: xp.level.level, target: 15 },
    { id: "streak3", name: "Arrancando el hábito", desc: "Racha de 3 días", cur: streak, target: 3 },
    { id: "streak7", name: "Semana perfecta", desc: "Racha de 7 días", cur: streak, target: 7 },
    { id: "streak30", name: "Imparable", desc: "Racha de 30 días", cur: streak, target: 30 },
    { id: "perfect5", name: "Perfeccionista", desc: "5 quizzes perfectos", cur: perfectQuizzes, target: 5 },
    { id: "legendary5", name: "Coronado", desc: "5 módulos en Legendary", cur: legendaryCount, target: 5 },
    { id: "legendary20", name: "Leyenda", desc: "20 módulos en Legendary", cur: legendaryCount, target: 20 },
    { id: "exam_pass", name: "Graduado", desc: "Aprobá el examen final", cur: stats.examPassed ? 1 : 0, target: 1 },
    { id: "explorer", name: "Explorador", desc: `Tocá ${Math.min(5, totalCategories)} categorías distintas`, cur: categoriesWithQuiz, target: Math.min(5, totalCategories) },
    { id: "homework10", name: "Trabajador", desc: "10 tareas calificadas", cur: stats.homeworkGraded, target: 10 },
  ];

  return defs.map((d) => ({
    id: d.id,
    name: d.name,
    desc: d.desc,
    earned: d.cur >= d.target && d.target > 0,
    progress: { cur: Math.min(d.cur, d.target), target: d.target },
  }));
}
