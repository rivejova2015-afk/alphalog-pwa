import type { ProgressContent, ProgressData } from "./progressStats";

// XP engine + learner level + per-module mastery. Everything is DERIVED from the
// data the learner already generates (quiz/exam/homework results + module
// progress), so no new storage/migration is needed. Pure → unit-tested.

export interface XpData extends ProgressData {
  // securities_progress map keyed by module id (m).
  progress?: Record<number, { completed_levels?: string[]; research_done?: boolean }>;
}

export interface LevelInfo {
  level: number;
  xpIntoLevel: number;
  xpForNext: number;
  pct: number;
}

// Level L→L+1 needs L*100 XP (100, 200, 300, ...). Smooth, ever-increasing.
export function levelInfo(totalXp: number): LevelInfo {
  let level = 1;
  let remaining = Math.max(0, Math.floor(totalXp));
  let need = 100;
  while (remaining >= need) {
    remaining -= need;
    level += 1;
    need = level * 100;
  }
  return { level, xpIntoLevel: remaining, xpForNext: need, pct: Math.round((remaining / need) * 100) };
}

// Mastery "crowns" per module (0–4), derived from quiz performance + module
// progress. 4 = Legendary.
export function moduleMastery(args: {
  bestQuizPct: number | null;
  researchDone: boolean;
  completedLevels: string[];
}): number {
  let s = 0;
  if (args.bestQuizPct != null && args.bestQuizPct >= 0.7) s += 1;        // aprobado
  if (args.bestQuizPct != null && args.bestQuizPct >= 1) s += 1;          // perfecto
  if (args.researchDone) s += 1;                                          // research hecho
  const lv = new Set(args.completedLevels);
  if (lv.has("b") && lv.has("i") && lv.has("a")) s += 1;                  // b/i/a completos
  return s;
}

const PASS = 0.7;

// Maestría por niveles de quiz (Fase A): +1 por cada nivel APROBADO entre los
// disponibles + 1 Legendary si los tres niveles (b/i/a) existen, están aprobados
// y el research está hecho. Se usa solo para módulos que ya tienen contenido
// intermedio/avanzado autoríado; los demás caen al modelo legacy (moduleMastery).
export function moduleMasteryLeveled(args: {
  levelPct: Record<string, number | null>;
  availableLevels: string[];
  researchDone: boolean;
}): number {
  let s = 0;
  for (const lv of args.availableLevels) {
    const pct = args.levelPct[lv];
    if (pct != null && pct >= PASS) s += 1;
  }
  const allThree = (["b", "i", "a"] as const).every(
    (lv) => args.availableLevels.includes(lv) && (args.levelPct[lv] ?? 0) >= PASS,
  );
  if (allThree && args.researchDone) s += 1; // Legendary
  return s;
}

export const MASTERY_MAX = 4;

export interface XpBreakdown { lessonXp: number; homeworkXp: number; examXp: number; masteryXp: number }

export interface XpResult {
  totalXp: number;
  level: LevelInfo;
  mastery: Record<number, number>; // by module id (m)
  breakdown: XpBreakdown;
}

export function computeXp(content: ProgressContent, data: XpData): XpResult {
  // Best quiz score per (lesson, level). Filas históricas sin nivel = 'b'.
  const bestByLessonLevel = new Map<string, { score: number; total: number }>();
  for (const r of data.quizResults) {
    const lv = r.level ?? "b";
    const key = `${r.lesson_id}:${lv}`;
    const prev = bestByLessonLevel.get(key);
    if (!prev || r.score / r.total > prev.score / prev.total) {
      bestByLessonLevel.set(key, { score: r.score, total: r.total });
    }
  }

  // XP por lección: cada (lección, nivel) con su mejor intento aporta.
  let lessonXp = 0;
  for (const b of bestByLessonLevel.values()) {
    lessonXp += b.score * 10;
    if (b.total > 0 && b.score === b.total) lessonXp += 20; // perfect bonus
  }

  const hwRows = Object.values(data.homework);
  const homeworkXp = hwRows.reduce((acc, h) => acc + (h.status === "graded" ? (h.points ?? 0) * 3 : 0), 0);

  const examXp = data.examResults.length === 0
    ? 0
    : Math.max(...data.examResults.map((e) => e.score)) * 5 + (data.examResults.some((e) => e.passed) ? 200 : 0);

  // Per-module mastery (+25 XP per crown).
  const lessonBySub = new Map(content.lessons.map((l) => [l.sub, l]));
  const mastery: Record<number, number> = {};
  let masteryXp = 0;
  for (const m of content.modules) {
    const lesson = lessonBySub.get(`M${m.m}`);
    const prog = data.progress?.[m.m];
    const researchDone = Boolean(prog?.research_done);

    // Niveles con contenido para esta lección (default ['b'] para back-compat).
    const levels = lesson?.levels ?? ["b"];
    const levelPct: Record<string, number | null> = { b: null, i: null, a: null };
    if (lesson) {
      for (const lv of ["b", "i", "a"]) {
        const best = bestByLessonLevel.get(`${lesson.id}:${lv}`);
        levelPct[lv] = best && best.total > 0 ? best.score / best.total : null;
      }
    }

    // Maestría = max(modelo por niveles, modelo legacy). El leveled premia
    // aprobar b/i/a; el legacy (quiz aprobado/perfecto + research + niveles
    // marcados) es el PISO que preserva las coronas ya ganadas antes de Fase A.
    // Tomar el máximo es monótono: ninguna corona histórica se pierde, pero
    // ejercitar los niveles intermedio/avanzado puede sumar más.
    const leveled = moduleMasteryLeveled({ levelPct, availableLevels: levels, researchDone });
    const legacy = moduleMastery({
      bestQuizPct: levelPct.b,
      researchDone,
      completedLevels: prog?.completed_levels ?? [],
    });
    const ms = Math.max(leveled, legacy);
    mastery[m.m] = ms;
    masteryXp += ms * 25;
  }

  const totalXp = lessonXp + homeworkXp + examXp + masteryXp;
  return { totalXp, level: levelInfo(totalXp), mastery, breakdown: { lessonXp, homeworkXp, examXp, masteryXp } };
}
