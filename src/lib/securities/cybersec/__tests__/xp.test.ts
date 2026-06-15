import { describe, it, expect } from "vitest";
import { levelInfo, moduleMastery, moduleMasteryLeveled, computeXp } from "../xp";
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

describe("moduleMasteryLeveled", () => {
  const lv = (b: number | null, i: number | null, a: number | null) => ({ b, i, a });
  it("0 si ningún nivel aprobado", () => {
    expect(moduleMasteryLeveled({ levelPct: lv(0.5, null, null), availableLevels: ["b", "i", "a"], researchDone: false })).toBe(0);
  });
  it("+1 por cada nivel aprobado entre los disponibles", () => {
    expect(moduleMasteryLeveled({ levelPct: lv(0.8, 0.9, 0.5), availableLevels: ["b", "i", "a"], researchDone: false })).toBe(2);
  });
  it("Legendary (4) con b/i/a aprobados + research", () => {
    expect(moduleMasteryLeveled({ levelPct: lv(0.7, 0.7, 0.7), availableLevels: ["b", "i", "a"], researchDone: true })).toBe(4);
  });
  it("sin research no hay Legendary aunque pasen los 3", () => {
    expect(moduleMasteryLeveled({ levelPct: lv(1, 1, 1), availableLevels: ["b", "i", "a"], researchDone: true })).toBe(4);
    expect(moduleMasteryLeveled({ levelPct: lv(1, 1, 1), availableLevels: ["b", "i", "a"], researchDone: false })).toBe(3);
  });
  it("si solo hay nivel b disponible, máximo 1 corona (no Legendary)", () => {
    expect(moduleMasteryLeveled({ levelPct: lv(1, null, null), availableLevels: ["b"], researchDone: true })).toBe(1);
  });
});

const content: ProgressContent = {
  lessons: [{ id: 1, sub: "M1" }, { id: 2, sub: "M2" }],
  modules: [{ m: 1, cat: "Fundamentos" }, { m: 2, cat: "Fundamentos" }],
  homework: [{ id: 1, l: 1, pts: 20 }],
};

const leveledContent: ProgressContent = {
  lessons: [{ id: 1, sub: "M1", levels: ["b", "i", "a"] }],
  modules: [{ m: 1, cat: "Fundamentos" }],
  homework: [],
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

  it("módulo con niveles i/a usa el modelo por niveles", () => {
    const data: XpData = {
      quizResults: [
        { lesson_id: 1, score: 4, total: 4, level: "b" }, // aprobado
        { lesson_id: 1, score: 3, total: 4, level: "i" }, // aprobado (0.75)
        { lesson_id: 1, score: 2, total: 4, level: "a" }, // reprobado (0.5)
      ],
      examResults: [],
      homework: {},
      progress: { 1: { research_done: true } },
    };
    const r = computeXp(leveledContent, data);
    // b + i aprobados = 2; 'a' no; sin los 3 no hay Legendary.
    expect(r.mastery[1]).toBe(2);
  });

  it("intentos históricos sin level se cuentan como 'b'", () => {
    const data: XpData = {
      quizResults: [{ lesson_id: 1, score: 4, total: 4 }], // sin level → 'b'
      examResults: [],
      homework: {},
      progress: { 1: { research_done: true } },
    };
    const r = computeXp(leveledContent, data);
    expect(r.mastery[1]).toBe(1); // solo 'b' aprobado
  });
});
