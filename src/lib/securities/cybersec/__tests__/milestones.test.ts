import { describe, it, expect } from "vitest";
import { buildSnapshot, detectMilestones } from "../milestones";

describe("buildSnapshot", () => {
  it("suma las coronas y ordena los logros", () => {
    const s = buildSnapshot(3, { 1: 4, 2: 1, 3: 0 }, ["b", "a"], false);
    expect(s.crowns).toBe(5);
    expect(s.earned).toEqual(["a", "b"]);
    expect(s.level).toBe(3);
  });
});

describe("detectMilestones", () => {
  const base = buildSnapshot(2, { 1: 1 }, ["first_quiz"], false);

  it("primera carga (prev null) no celebra", () => {
    expect(detectMilestones(null, base)).toEqual([]);
  });

  it("detecta subida de nivel", () => {
    const next = buildSnapshot(3, { 1: 1 }, ["first_quiz"], false);
    const ms = detectMilestones(base, next);
    expect(ms).toHaveLength(1);
    expect(ms[0].kind).toBe("level");
    expect(ms[0].title).toContain("Nivel 3");
  });

  it("detecta coronas nuevas", () => {
    const next = buildSnapshot(2, { 1: 4 }, ["first_quiz"], false);
    const ms = detectMilestones(base, next);
    expect(ms[0].kind).toBe("crown");
    expect(ms[0].title).toContain("3");
  });

  it("detecta logro nuevo con su nombre", () => {
    const next = buildSnapshot(2, { 1: 1 }, ["first_quiz", "streak7"], false);
    const ms = detectMilestones(base, next, { streak7: "Semana perfecta" });
    expect(ms.some((m) => m.kind === "achievement" && m.detail === "Semana perfecta")).toBe(true);
  });

  it("detecta aprobación del examen una sola vez", () => {
    const next = buildSnapshot(2, { 1: 1 }, ["first_quiz"], true);
    expect(detectMilestones(base, next).some((m) => m.kind === "exam")).toBe(true);
    // si ya estaba aprobado, no recelebra
    const after = buildSnapshot(2, { 1: 1 }, ["first_quiz"], true);
    expect(detectMilestones(next, after)).toEqual([]);
  });

  it("acumula múltiples hitos a la vez", () => {
    const next = buildSnapshot(3, { 1: 4 }, ["first_quiz", "level5"], true);
    const ms = detectMilestones(base, next);
    expect(ms.map((m) => m.kind).sort()).toEqual(["achievement", "crown", "exam", "level"]);
  });
});
