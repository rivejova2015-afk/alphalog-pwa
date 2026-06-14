import { describe, it, expect } from "vitest";
import { idsToDelete, type QuizRow } from "../quizDedup";

function row(p: Partial<QuizRow> & { id: string }): QuizRow {
  return {
    user_id: "u1",
    lesson_id: 1,
    score: 5,
    total: 10,
    taken_at: "2026-06-01T10:00:00.000Z",
    ...p,
  };
}

describe("idsToDelete", () => {
  it("sin redundancia → no borra nada", () => {
    const rows = [
      row({ id: "a", lesson_id: 1, taken_at: "2026-06-01T10:00:00Z" }),
      row({ id: "b", lesson_id: 2, taken_at: "2026-06-02T10:00:00Z" }),
    ];
    expect(idsToDelete(rows)).toEqual([]);
  });

  it("dos intentos misma lección, mismo día → borra el peor", () => {
    const rows = [
      row({ id: "lo", lesson_id: 1, score: 4, taken_at: "2026-06-01T09:00:00Z" }),
      row({ id: "hi", lesson_id: 1, score: 9, taken_at: "2026-06-01T11:00:00Z" }),
    ];
    expect(idsToDelete(rows)).toEqual(["lo"]);
  });

  it("a igualdad de score, conserva el más reciente", () => {
    const rows = [
      row({ id: "old", lesson_id: 1, score: 7, taken_at: "2026-06-01T09:00:00Z" }),
      row({ id: "new", lesson_id: 1, score: 7, taken_at: "2026-06-01T11:00:00Z" }),
    ];
    expect(idsToDelete(rows)).toEqual(["old"]);
  });

  it("preserva ≥1 intento por día aunque no sea el mejor de la lección", () => {
    // Mejor de la lección es 'best' (día 1). El día 2 solo tiene un intento peor,
    // pero hay que conservarlo para no romper la racha.
    const rows = [
      row({ id: "best", lesson_id: 1, score: 10, taken_at: "2026-06-01T10:00:00Z" }),
      row({ id: "day2", lesson_id: 1, score: 3, taken_at: "2026-06-02T10:00:00Z" }),
    ];
    expect(idsToDelete(rows)).toEqual([]);
  });

  it("colapsa varios intentos del mismo día a uno, conservando el día", () => {
    const rows = [
      row({ id: "best", lesson_id: 1, score: 10, taken_at: "2026-06-01T10:00:00Z" }),
      row({ id: "d2a", lesson_id: 1, score: 2, taken_at: "2026-06-02T08:00:00Z" }),
      row({ id: "d2b", lesson_id: 1, score: 5, taken_at: "2026-06-02T12:00:00Z" }),
    ];
    // Día 2: conserva el mejor (d2b), borra d2a. Día 1 best se conserva.
    expect(idsToDelete(rows).sort()).toEqual(["d2a"]);
  });

  it("aísla por usuario", () => {
    const rows = [
      row({ id: "u1a", user_id: "u1", lesson_id: 1, score: 3, taken_at: "2026-06-01T08:00:00Z" }),
      row({ id: "u1b", user_id: "u1", lesson_id: 1, score: 9, taken_at: "2026-06-01T09:00:00Z" }),
      row({ id: "u2a", user_id: "u2", lesson_id: 1, score: 4, taken_at: "2026-06-01T08:00:00Z" }),
    ];
    // u1 borra el peor; u2 tiene un solo intento, se conserva.
    expect(idsToDelete(rows)).toEqual(["u1a"]);
  });

  it("lista vacía → vacío", () => {
    expect(idsToDelete([])).toEqual([]);
  });

  it("total=0 no rompe el ratio (tratado como 0)", () => {
    const rows = [
      row({ id: "z", lesson_id: 1, score: 0, total: 0, taken_at: "2026-06-01T08:00:00Z" }),
      row({ id: "g", lesson_id: 1, score: 5, total: 10, taken_at: "2026-06-01T09:00:00Z" }),
    ];
    expect(idsToDelete(rows)).toEqual(["z"]);
  });
});
