import { describe, it, expect } from "vitest";
import { moduleIdFromSub, mergeCompletedLevels } from "../moduleProgress";
import { nextPendingLesson, LESSONS } from "../lessons";

describe("moduleIdFromSub", () => {
  it("parsea 'M<n>' al número de módulo", () => {
    expect(moduleIdFromSub("M5")).toBe(5);
    expect(moduleIdFromSub("M86")).toBe(86);
    expect(moduleIdFromSub(" M12 ")).toBe(12);
  });
  it("devuelve null para subs malformados", () => {
    expect(moduleIdFromSub("Otros")).toBeNull();
    expect(moduleIdFromSub("M")).toBeNull();
    expect(moduleIdFromSub("5")).toBeNull();
    expect(moduleIdFromSub("MX")).toBeNull();
  });
});

describe("mergeCompletedLevels", () => {
  it("agrega un nivel nuevo en orden estable b/i/a", () => {
    expect(mergeCompletedLevels([], "b")).toEqual(["b"]);
    expect(mergeCompletedLevels(["a"], "b")).toEqual(["b", "a"]);
    expect(mergeCompletedLevels(["b"], "i")).toEqual(["b", "i"]);
  });
  it("es idempotente: no duplica un nivel existente", () => {
    expect(mergeCompletedLevels(["b", "i"], "b")).toEqual(["b", "i"]);
    expect(mergeCompletedLevels(["a", "b", "i"], "a")).toEqual(["b", "i", "a"]);
  });
});

describe("nextPendingLesson", () => {
  it("devuelve la primera lección (por id) sin quiz hecho", () => {
    const taken = new Set<number>([1, 2]);
    const next = nextPendingLesson(2, taken);
    expect(next).not.toBeNull();
    expect(next!.id).toBe(3);
  });
  it("excluye la lección actual aunque no esté en el set", () => {
    const taken = new Set<number>([1]);
    const next = nextPendingLesson(2, taken);
    // 2 está excluida explícitamente, así que la próxima pendiente es 3.
    expect(next!.id).toBe(3);
  });
  it("devuelve null si todas las lecciones están hechas", () => {
    const taken = new Set<number>(LESSONS.map((l) => l.id));
    expect(nextPendingLesson(1, taken)).toBeNull();
  });
});
