import { describe, it, expect } from "vitest";
import { sectionBank, categoryByIndex, categoryIndex } from "../sectionExam";

describe("sectionBank", () => {
  it("arma un banco con las preguntas de los módulos de la categoría", () => {
    const redes = sectionBank("Redes");
    expect(redes.length).toBeGreaterThan(0);
    for (const q of redes) {
      expect(q.q.length).toBeGreaterThan(0);
      expect(q.o.length).toBeGreaterThan(1);
      expect(q.c).toBeGreaterThanOrEqual(0);
      expect(q.c).toBeLessThan(q.o.length);
    }
  });

  it("categoría inexistente → banco vacío", () => {
    expect(sectionBank("NoExiste")).toEqual([]);
  });

  it("cada categoría del syllabus tiene preguntas", () => {
    const cats = ["Fundamentos", "Pentesting", "Cripto Avanzada", "AI/ML Security"];
    for (const c of cats) expect(sectionBank(c).length).toBeGreaterThan(0);
  });
});

describe("categoryByIndex / categoryIndex", () => {
  it("ida y vuelta", () => {
    expect(categoryByIndex(0)).toBe("Fundamentos");
    expect(categoryIndex("Fundamentos")).toBe(0);
    expect(categoryByIndex(999)).toBeNull();
    expect(categoryIndex("NoExiste")).toBe(-1);
  });
});
