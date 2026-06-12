import { describe, it, expect } from "vitest";
import { RUBRICS, rubricFor, rubricScore } from "../rubrics";

describe("RUBRICS", () => {
  it("define criterios para cada tipo de homework", () => {
    for (const type of ["research", "practical", "reflection", "code"] as const) {
      expect(rubricFor(type).length).toBeGreaterThan(0);
      expect(RUBRICS[type].every((c) => c.length > 0)).toBe(true);
    }
  });
});

describe("rubricScore", () => {
  it("0 criterios marcados → 0 puntos", () => {
    expect(rubricScore(0, 4, 30)).toBe(0);
  });
  it("todos marcados → puntaje máximo", () => {
    expect(rubricScore(4, 4, 30)).toBe(30);
  });
  it("mitad marcados → mitad de los puntos", () => {
    expect(rubricScore(2, 4, 30)).toBe(15);
  });
  it("clampa si checked excede el total", () => {
    expect(rubricScore(9, 4, 30)).toBe(30);
  });
  it("totalCriteria 0 → 0 (sin división por cero)", () => {
    expect(rubricScore(1, 0, 30)).toBe(0);
  });
});
