import { describe, it, expect } from "vitest";
import { shuffle, prepareExam, formatClock } from "../examSession";
import type { ExamQuestion } from "../types";

// Deterministic RNG cycling through fixed values (good enough to exercise paths).
function seededRng(seq: number[]): () => number {
  let i = 0;
  return () => seq[i++ % seq.length];
}

const bank: ExamQuestion[] = [
  { q: "Q1", o: ["a", "b", "c"], c: 0 },
  { q: "Q2", o: ["d", "e", "f"], c: 1 },
  { q: "Q3", o: ["g", "h", "i"], c: 2 },
  { q: "Q4", o: ["j", "k", "l"], c: 0 },
  { q: "Q5", o: ["m", "n", "o"], c: 1 },
];

describe("shuffle", () => {
  it("devuelve un array nuevo con los mismos elementos", () => {
    const a = [1, 2, 3, 4];
    const b = shuffle(a, seededRng([0.1, 0.9, 0.5]));
    expect(b).not.toBe(a);
    expect([...b].sort()).toEqual([1, 2, 3, 4]);
  });
});

describe("prepareExam", () => {
  it("samplea exactamente `count` preguntas", () => {
    const exam = prepareExam(bank, 3, seededRng([0.2, 0.7, 0.4, 0.9, 0.1]));
    expect(exam).toHaveLength(3);
  });

  it("no excede el tamaño del banco", () => {
    const exam = prepareExam(bank, 99);
    expect(exam).toHaveLength(bank.length);
  });

  it("el índice correcto sigue apuntando a la respuesta correcta tras barajar", () => {
    const exam = prepareExam(bank, bank.length, seededRng([0.3, 0.8, 0.1, 0.6, 0.95, 0.45]));
    for (const pq of exam) {
      const original = bank.find((b) => b.q === pq.q)!;
      const correctText = original.o[original.c];
      expect(pq.o[pq.c]).toBe(correctText);
      expect(pq.o.length).toBe(original.o.length);
    }
  });
});

describe("formatClock", () => {
  it("formatea segundos a m:ss", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(65)).toBe("1:05");
    expect(formatClock(600)).toBe("10:00");
  });
  it("nunca devuelve negativo", () => {
    expect(formatClock(-5)).toBe("0:00");
  });
});
