import { describe, it, expect } from "vitest";
import { streakReminder } from "../notify";

describe("streakReminder", () => {
  it("racha en riesgo: tiene racha y 0 XP hoy", () => {
    const r = streakReminder(5, 0, 50);
    expect(r?.kind).toBe("streak");
    expect(r?.title).toContain("5 días");
  });

  it("singular para racha de 1 día", () => {
    const r = streakReminder(1, 0, 50);
    expect(r?.title).toContain("1 día");
    expect(r?.title).not.toContain("1 días");
  });

  it("meta casi cumplida: estudió algo pero falta", () => {
    const r = streakReminder(3, 30, 50);
    expect(r?.kind).toBe("goal");
    expect(r?.body).toContain("30/50");
  });

  it("no recuerda si ya cumplió la meta", () => {
    expect(streakReminder(3, 60, 50)).toBeNull();
  });

  it("no recuerda si no hay racha ni actividad", () => {
    expect(streakReminder(0, 0, 50)).toBeNull();
  });

  it("prioriza la racha sobre la meta cuando hay 0 XP", () => {
    expect(streakReminder(2, 0, 50)?.kind).toBe("streak");
  });
});
