import { describe, it, expect } from "vitest";
import { newCard, review, isDue, dueIds } from "../srs";

const NOW = new Date("2026-06-14T10:00:00Z");

describe("newCard", () => {
  it("nace pendiente hoy con ease 2.5", () => {
    const c = newCard(NOW);
    expect(c.due).toBe("2026-06-14");
    expect(c.ease).toBe(2.5);
    expect(c.reps).toBe(0);
  });
});

describe("review", () => {
  it("'good' agenda hacia adelante y sube reps", () => {
    const c1 = review(newCard(NOW), "good", NOW); // reps1 → interval 1
    expect(c1.reps).toBe(1);
    expect(c1.interval).toBe(1);
    expect(c1.due).toBe("2026-06-15");
    const c2 = review(c1, "good", NOW); // reps2 → interval 6
    expect(c2.interval).toBe(6);
  });

  it("'again' resetea reps, suma lapse y baja ease", () => {
    const good = review(newCard(NOW), "good", NOW);
    const again = review(good, "again", NOW);
    expect(again.reps).toBe(0);
    expect(again.lapses).toBe(1);
    expect(again.ease).toBeLessThan(good.ease);
    expect(again.interval).toBe(0);
    expect(again.due).toBe("2026-06-14"); // vuelve a hoy
  });

  it("'easy' agenda más lejos que 'good'", () => {
    const good = review(newCard(NOW), "good", NOW);
    const easy = review(newCard(NOW), "easy", NOW);
    expect(easy.interval).toBeGreaterThan(good.interval);
  });

  it("la ease nunca baja de 1.3", () => {
    let c = newCard(NOW);
    for (let i = 0; i < 20; i++) c = review(c, "again", NOW);
    expect(c.ease).toBeGreaterThanOrEqual(1.3);
  });
});

describe("isDue / dueIds", () => {
  it("una tarjeta nueva (sin estado) está pendiente", () => {
    expect(isDue(undefined, NOW)).toBe(true);
  });
  it("una tarjeta agendada al futuro no está pendiente", () => {
    const c = review(newCard(NOW), "good", NOW);
    expect(isDue(c, NOW)).toBe(false);
  });
  it("dueIds incluye nuevas y vencidas, excluye futuras", () => {
    const map = {
      a: review(newCard(NOW), "good", NOW), // futura
      b: { ease: 2.5, interval: 1, reps: 1, lapses: 0, due: "2026-06-13" }, // vencida
    };
    const due = dueIds(["a", "b", "c"], map, NOW);
    expect(due).toContain("b"); // vencida
    expect(due).toContain("c"); // nueva
    expect(due).not.toContain("a"); // futura
  });
});
