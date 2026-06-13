import { describe, it, expect } from "vitest";
import { levelInfo, moduleMastery, computeXp } from "../xp";
import type { ProgressContent } from "../progressStats";
import type { XpData } from "../xp";

describe("levelInfo", () => {
  it("0 XP → nivel 1", () => {
    const l = levelInfo(0);
    expect(l.level).toBe(1);
    expect(l.xpForNext).toBe(100);
  });
  it("100 XP → nivel 2 (consumió el primer tramo)", () => {
    const l = levelInfo(100);
    expect(l.level).toBe(2);
    expect(l.xpIntoLevel).toBe(0);
    expect(l.xpForNext).toBe(200);
  });
  it("250 XP → nivel 2 con 150 dentro (need 200)", () => {
    const l = levelInfo(250);
    expect(l.level).toBe(2);
    expect(l.xpIntoLevel).toBe(150);
    expect(l.pct).toBe(75);
  });
});

describe("moduleMastery", () => {
  it("0 si nada hecho", () => {
    expect(moduleMastery({ bestQuizPct: null, researchDone: false, completedLevels: [] })).toBe(0);
  });
  it("1 al aprobar el quiz", () => {
    expect(moduleMastery({ bestQuizPct: 0.75, researchDone: false, completedLevels: [] })).toBe(1);
  });
  it("2 al perfeccionar el quiz", () => {
    expect(moduleMastery({ bestQuizPct: 1, researchDone: false, completedLevels: [] })).toBe(2);
  });
  it("4 (legendary) con quiz perfecto + research + b/i/a", () => {
    expect(moduleMastery({ bestQuizPct: 1, researchDone: true, completedLevels: ["b", "i", "a"] })).toBe(4);
  });
});

const content: ProgressContent = {
  lessons: [{ id: 1, sub: "M1" }, { id: 2, sub: "M2" }],
  modules: [{ m: 1, cat: "Fundamentos" }, { m: 2, cat: "Fundamentos" }],
  homework: [{ id: 1, l: 1, pts: 20 }],
};

describe("computeXp", () => {
  it("acumula XP de quiz, homework, examen y maestría", () => {
    const data: XpData = {
      quizResults: [{ lesson_id: 1, score: 4, total: 4 }], // perfecto → 40 + 20 bonus
      examResults: [{ score: 32, total: 40, passed: true, taken_at: "2026-06-12T00:00:00Z" }], // 32*5 + 200
      homework: { 1: { status: "graded", points: 18 } }, // 18*3
      progress: { 1: { completed_levels: ["b", "i", "a"], research_done: true } },
    };
    const r = computeXp(content, data);
    // lessonXp 60, hw 54, exam 360, mastery: M1=4 crowns, M2=0 → 4*25=100
    expect(r.breakdown.lessonXp).toBe(60);
    expect(r.breakdown.homeworkXp).toBe(54);
    expect(r.breakdown.examXp).toBe(360);
    expect(r.breakdown.masteryXp).toBe(100);
    expect(r.totalXp).toBe(574);
    expect(r.mastery[1]).toBe(4);
    expect(r.mastery[2]).toBe(0);
    expect(r.level.level).toBeGreaterThanOrEqual(3);
  });

  it("sin datos → 0 XP, nivel 1, todo en 0", () => {
    const r = computeXp(content, { quizResults: [], examResults: [], homework: {} });
    expect(r.totalXp).toBe(0);
    expect(r.level.level).toBe(1);
    expect(r.mastery[1]).toBe(0);
  });
});
