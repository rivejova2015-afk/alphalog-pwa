import { describe, it, expect } from "vitest";
import { xpEarnedOn, xpEarnedToday, streakWithFreeze, activityDays } from "../habit";
import { computeAchievements } from "../achievements";
import { computeProgress, type ProgressContent } from "../progressStats";
import { computeXp, type XpData } from "../xp";

const data: XpData = {
  quizResults: [
    { lesson_id: 1, score: 4, total: 4, taken_at: "2026-06-13T09:00:00Z" },
    { lesson_id: 2, score: 2, total: 4, taken_at: "2026-06-10T09:00:00Z" },
  ],
  examResults: [{ score: 30, total: 40, passed: true, taken_at: "2026-06-13T10:00:00Z" }],
  homework: { 1: { status: "graded", points: 18, graded_at: "2026-06-13T08:00:00Z", submitted_at: "2026-06-13T07:00:00Z" } },
  progress: {},
};

describe("xpEarnedOn / xpEarnedToday", () => {
  it("suma la actividad de un día", () => {
    // 2026-06-13: quiz 4*10=40 + exam 30*5=150 + hw 18*3=54 = 244
    expect(xpEarnedOn(data, "2026-06-13")).toBe(244);
    expect(xpEarnedToday(data, new Date("2026-06-13T23:00:00Z"))).toBe(244);
  });
  it("0 en un día sin actividad", () => {
    expect(xpEarnedOn(data, "2026-06-12")).toBe(0);
  });
});

describe("streakWithFreeze", () => {
  it("cuenta días consecutivos", () => {
    const days = new Set(["2026-06-13", "2026-06-12", "2026-06-11"]);
    const r = streakWithFreeze(days, new Date("2026-06-13T10:00:00Z"));
    expect(r.streak).toBe(3);
    expect(r.frozenUsed).toBe(0);
  });
  it("congela un día perdido (no rompe la racha)", () => {
    // falta 06-12; con freeze, 06-13 + 06-11 + 06-10 cuentan
    const days = new Set(["2026-06-13", "2026-06-11", "2026-06-10"]);
    const r = streakWithFreeze(days, new Date("2026-06-13T10:00:00Z"));
    expect(r.streak).toBe(3);
    expect(r.frozenUsed).toBe(1);
  });
  it("rompe si los gaps superan el límite", () => {
    const days = new Set(["2026-06-13", "2026-06-09"]); // 3 días de gap
    const r = streakWithFreeze(days, new Date("2026-06-13T10:00:00Z"), 2);
    expect(r.streak).toBe(1);
  });
});

const content: ProgressContent = {
  lessons: [{ id: 1, sub: "M1" }, { id: 2, sub: "M2" }],
  modules: [{ m: 1, cat: "Fundamentos" }, { m: 2, cat: "Redes" }],
  homework: [{ id: 1, l: 1, pts: 20 }],
};

describe("computeAchievements", () => {
  it("marca earned según las condiciones", () => {
    const xp = computeXp(content, data);
    const stats = computeProgress(content, data, new Date("2026-06-13T12:00:00Z"));
    const days = activityDays(data);
    const streak = streakWithFreeze(days, new Date("2026-06-13T12:00:00Z")).streak;
    const ach = computeAchievements(content, data, xp, stats, streak);

    const first = ach.find((a) => a.id === "first_quiz")!;
    expect(first.earned).toBe(true);
    const grad = ach.find((a) => a.id === "exam_pass")!;
    expect(grad.earned).toBe(true);
    const perfect = ach.find((a) => a.id === "perfect5")!;
    expect(perfect.earned).toBe(false);
    expect(perfect.progress).toEqual({ cur: 1, target: 5 });
  });
});
