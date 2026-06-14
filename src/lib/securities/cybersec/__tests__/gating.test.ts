import { describe, it, expect } from "vitest";
import { lockedModules } from "../gating";

const ordered = [
  { m: 1, cat: "A" },
  { m: 2, cat: "A" },
  { m: 3, cat: "B" },
  { m: 4, cat: "B" },
];

describe("lockedModules", () => {
  it("soft → nada bloqueado", () => {
    expect(lockedModules("soft", ordered, {}).size).toBe(0);
  });

  describe("strict", () => {
    it("sin progreso: solo el primero abierto", () => {
      const locked = lockedModules("strict", ordered, {});
      expect([...locked].sort()).toEqual([2, 3, 4]);
    });
    it("dominado M1: M1 y M2 abiertos, resto bloqueado", () => {
      const locked = lockedModules("strict", ordered, { 1: 1 });
      expect([...locked].sort()).toEqual([3, 4]);
    });
    it("todo dominado → nada bloqueado", () => {
      const locked = lockedModules("strict", ordered, { 1: 2, 2: 1, 3: 4, 4: 1 });
      expect(locked.size).toBe(0);
    });
  });

  describe("block", () => {
    it("primer bloque abierto, segundo bloqueado si el primero no está completo", () => {
      const locked = lockedModules("block", ordered, { 1: 1 }); // M2 sin dominar
      expect([...locked].sort()).toEqual([3, 4]);
    });
    it("primer bloque completo → segundo se abre", () => {
      const locked = lockedModules("block", ordered, { 1: 1, 2: 2 });
      expect(locked.size).toBe(0);
    });
    it("cascada: bloque 2 incompleto no afecta porque ya está abierto", () => {
      const locked = lockedModules("block", ordered, { 1: 1, 2: 1 });
      expect(locked.size).toBe(0);
    });
  });
});
