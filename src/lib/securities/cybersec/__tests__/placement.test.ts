import { describe, it, expect } from "vitest";
import { placementBank, scorePlacement } from "../placement";

describe("placementBank", () => {
  const bank = placementBank();

  it("tiene una pregunta por categoría con contenido", () => {
    expect(bank.length).toBeGreaterThanOrEqual(13);
    // categorías únicas
    const cats = new Set(bank.map((b) => b.cat));
    expect(cats.size).toBe(bank.length);
  });

  it("cada pregunta es válida", () => {
    for (const it of bank) {
      expect(it.question.q.length).toBeGreaterThan(0);
      expect(it.question.o.length).toBeGreaterThan(1);
      expect(it.question.c).toBeGreaterThanOrEqual(0);
      expect(it.question.c).toBeLessThan(it.question.o.length);
    }
  });
});

describe("scorePlacement", () => {
  const bank = placementBank();

  it("todo correcto → sin recomendación (recommended null)", () => {
    const answers = bank.map((it) => it.question.c);
    const r = scorePlacement(answers, bank);
    expect(r.correctCount).toBe(bank.length);
    expect(r.recommended).toBeNull();
  });

  it("recomienda la primera categoría fallada", () => {
    const answers = bank.map((it) => it.question.c);
    // fallar la 2da a propósito
    answers[1] = (bank[1].question.c + 1) % bank[1].question.o.length;
    const r = scorePlacement(answers, bank);
    expect(r.recommended).toBe(bank[1].cat);
    expect(r.correctCount).toBe(bank.length - 1);
  });

  it("respuestas faltantes (-1) cuentan como incorrectas", () => {
    const answers = bank.map(() => -1);
    const r = scorePlacement(answers, bank);
    expect(r.correctCount).toBe(0);
    expect(r.recommended).toBe(bank[0].cat);
  });
});
