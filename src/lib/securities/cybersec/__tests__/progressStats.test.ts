import { describe, it, expect } from "vitest";
import { computeProgress, currentStreak, type ProgressContent, type ProgressData } from "../progressStats";

const content: ProgressContent = {
  lessons: [
    { id: 1, sub: "M1" },
    { id: 2, sub: "M2" },
    { id: 3, sub: "M5" }, // distinta categoría
  ],
  modules: [
    { m: 1, cat: "Fundamentos" },
    { m: 2, cat: "Fundamentos" },
    { m: 5, cat: "Redes" },
  ],
  homework: [
    { id: 1, l: 1, pts: 20 },
    { id: 2, l: 2, pts: 30 },
  ],
};

describe("computeProgress", () => {
  const data: ProgressData = {
    quizResults: [
      { lesson_id: 1, score: 3, total: 4, taken_at: "2026-06-10T10:00:00Z" },
      { lesson_id: 1, score: 4, total: 4, taken_at: "2026-06-11T10:00:00Z" }, // mejor intento
      { lesson_id: 2, score: 2, total: 4, taken_at: "2026-06-11T11:00:00Z" },
    ],
    examResults: [
      { score: 28, total: 40, passed: false, taken_at: "2026-06-11T12:00:00Z" },
      { score: 32, total: 40, passed: true, taken_at: "2026-06-12T09:00:00Z" },
    ],
    homework: {
      1: { status: "graded", points: 18, submitted_at: "2026-06-11T08:00:00Z", graded_at: "2026-06-11T08:30:00Z" },
      2: { status: "submitted", points: null, submitted_at: "2026-06-12T08:00:00Z" },
    },
  };

  const stats = computeProgress(content, data, new Date("2026-06-12T15:00:00Z"));

  it("cuenta quizzes tomados por lección distinta y usa el mejor intento", () => {
    expect(stats.quizzesTaken).toBe(2);
    // lección 1 = 4/4 (100%), lección 2 = 2/4 (50%) → promedio 75%
    expect(stats.quizAvgPct).toBe(75);
  });

  it("agrupa por categoría", () => {
    const fund = stats.byCategory.find((c) => c.cat === "Fundamentos")!;
    const redes = stats.byCategory.find((c) => c.cat === "Redes")!;
    expect(fund.lessonsTotal).toBe(2);
    expect(fund.quizzesTaken).toBe(2);
    expect(redes.lessonsTotal).toBe(1);
    expect(redes.quizzesTaken).toBe(0);
  });

  it("próximo paso = primera lección sin quiz", () => {
    expect(stats.nextLessonId).toBe(3);
  });

  it("agrega homework (enviadas, calificadas, puntos)", () => {
    expect(stats.homeworkSubmitted).toBe(2);
    expect(stats.homeworkGraded).toBe(1);
    expect(stats.homeworkPointsEarned).toBe(18);
    expect(stats.homeworkPointsMax).toBe(50);
  });

  it("examen: mejor % y aprobado", () => {
    expect(stats.examBestPct).toBe(80); // 32/40
    expect(stats.examPassed).toBe(true);
  });

  it("cuenta días activos", () => {
    // 2026-06-10, 06-11, 06-12 → 3 días
    expect(stats.activeDays).toBe(3);
  });
});

describe("currentStreak", () => {
  it("cuenta días consecutivos terminando hoy", () => {
    const days = new Set(["2026-06-12", "2026-06-11", "2026-06-10", "2026-06-08"]);
    expect(currentStreak(days, new Date("2026-06-12T10:00:00Z"))).toBe(3);
  });
  it("0 si hoy no hubo actividad", () => {
    const days = new Set(["2026-06-11", "2026-06-10"]);
    expect(currentStreak(days, new Date("2026-06-12T10:00:00Z"))).toBe(0);
  });
});
