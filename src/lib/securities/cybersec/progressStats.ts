// Pure aggregation of the learner's progress across quizzes, exam and homework.
// Kept free of network/imports so it can be unit-tested in isolation.

export interface QuizResultRow { lesson_id: number; score: number; total: number; taken_at?: string | null; level?: string | null }
export interface ExamResultRow { score: number; total: number; passed: boolean; taken_at: string }
export interface HomeworkRow { status: string; points: number | null; submitted_at?: string | null; graded_at?: string | null }

export interface ProgressContent {
  // `levels` = niveles de quiz con contenido (b/i/a); default ['b'] si se omite.
  lessons: { id: number; sub: string; levels?: string[] }[];
  modules: { m: number; cat: string }[];
  homework: { id: number; l: number; pts: number }[];
}

export interface ProgressData {
  quizResults: QuizResultRow[];
  examResults: ExamResultRow[];
  homework: Record<number, HomeworkRow>;
}

export interface CategoryProgress { cat: string; lessonsTotal: number; quizzesTaken: number }

export interface ProgressStats {
  lessonsTotal: number;
  quizzesTaken: number;
  quizAvgPct: number;
  homeworkTotal: number;
  homeworkSubmitted: number;
  homeworkGraded: number;
  homeworkPointsEarned: number;
  homeworkPointsMax: number;
  examBestPct: number | null;
  examPassed: boolean;
  byCategory: CategoryProgress[];
  nextLessonId: number | null;
  activeDays: number;
  streakDays: number;
}

function dayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

export function currentStreak(daySet: Set<string>, today: Date = new Date()): number {
  let streak = 0;
  const d = new Date(today);
  // Count consecutive days with activity ending today.
  for (;;) {
    const key = d.toISOString().slice(0, 10);
    if (daySet.has(key)) {
      streak += 1;
      d.setUTCDate(d.getUTCDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

export function computeProgress(
  content: ProgressContent,
  data: ProgressData,
  today: Date = new Date(),
): ProgressStats {
  // Best quiz score per lesson.
  const bestByLesson = new Map<number, { score: number; total: number }>();
  for (const r of data.quizResults) {
    const prev = bestByLesson.get(r.lesson_id);
    if (!prev || r.score / r.total > prev.score / prev.total) {
      bestByLesson.set(r.lesson_id, { score: r.score, total: r.total });
    }
  }
  const takenSet = new Set(bestByLesson.keys());
  const quizzesTaken = takenSet.size;
  const quizAvgPct = quizzesTaken === 0
    ? 0
    : Math.round(
        ([...bestByLesson.values()].reduce((acc, b) => acc + (b.total > 0 ? b.score / b.total : 0), 0) / quizzesTaken) * 100,
      );

  // Category breakdown via lesson.sub ("M5") → module.cat.
  const catBySub = new Map(content.modules.map((m) => [`M${m.m}`, m.cat]));
  const catAgg = new Map<string, CategoryProgress>();
  for (const lesson of content.lessons) {
    const cat = catBySub.get(lesson.sub) ?? "Otros";
    const c = catAgg.get(cat) ?? { cat, lessonsTotal: 0, quizzesTaken: 0 };
    c.lessonsTotal += 1;
    if (takenSet.has(lesson.id)) c.quizzesTaken += 1;
    catAgg.set(cat, c);
  }

  // Next lesson = first (by id) without a quiz result.
  const sortedLessons = [...content.lessons].sort((a, b) => a.id - b.id);
  const next = sortedLessons.find((l) => !takenSet.has(l.id));

  // Homework.
  const hwRows = Object.values(data.homework);
  const homeworkSubmitted = hwRows.filter((h) => h.status === "submitted" || h.status === "graded").length;
  const homeworkGraded = hwRows.filter((h) => h.status === "graded").length;
  const homeworkPointsEarned = hwRows.reduce((acc, h) => acc + (h.status === "graded" ? h.points ?? 0 : 0), 0);
  const homeworkPointsMax = content.homework.reduce((acc, h) => acc + h.pts, 0);

  // Exam.
  const examBestPct = data.examResults.length === 0
    ? null
    : Math.round(Math.max(...data.examResults.map((e) => (e.total > 0 ? e.score / e.total : 0))) * 100);
  const examPassed = data.examResults.some((e) => e.passed);

  // Activity days / streak.
  const days = new Set<string>();
  for (const r of data.quizResults) if (r.taken_at) days.add(dayKey(r.taken_at));
  for (const e of data.examResults) if (e.taken_at) days.add(dayKey(e.taken_at));
  for (const h of hwRows) {
    if (h.submitted_at) days.add(dayKey(h.submitted_at));
    if (h.graded_at) days.add(dayKey(h.graded_at));
  }

  return {
    lessonsTotal: content.lessons.length,
    quizzesTaken,
    quizAvgPct,
    homeworkTotal: content.homework.length,
    homeworkSubmitted,
    homeworkGraded,
    homeworkPointsEarned,
    homeworkPointsMax,
    examBestPct,
    examPassed,
    byCategory: [...catAgg.values()],
    nextLessonId: next?.id ?? null,
    activeDays: days.size,
    streakDays: currentStreak(days, today),
  };
}
