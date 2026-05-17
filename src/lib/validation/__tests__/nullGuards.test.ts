import { describe, it, expect } from "vitest";
import { asString, asNumber, asBoolean, asArray, ensureDefined } from "../nullGuards";

describe("nullGuards", () => {
  describe("asString", () => {
    it("retorna el string si es string", () => {
      expect(asString("hola")).toBe("hola");
    });
    it("fallback cuando es null/undefined", () => {
      expect(asString(null)).toBe("");
      expect(asString(undefined)).toBe("");
      expect(asString(null, "fallback")).toBe("fallback");
    });
    it("coerce a string con String() cuando no es string", () => {
      expect(asString(42)).toBe("42");
      expect(asString(true)).toBe("true");
      expect(asString({ a: 1 })).toBe("[object Object]");
    });
  });

  describe("asNumber", () => {
    it("retorna number si es number finito", () => {
      expect(asNumber(42)).toBe(42);
      expect(asNumber(0)).toBe(0);
      expect(asNumber(-3.14)).toBe(-3.14);
    });
    it("fallback en null/undefined", () => {
      expect(asNumber(null)).toBe(0);
      expect(asNumber(undefined, 99)).toBe(99);
    });
    it("convierte strings numéricas", () => {
      expect(asNumber("42")).toBe(42);
      expect(asNumber("3.14")).toBe(3.14);
    });
    it("fallback para no finitos (NaN, Infinity)", () => {
      expect(asNumber("abc", 5)).toBe(5);
      expect(asNumber(NaN, 5)).toBe(5);
      expect(asNumber(Infinity, 5)).toBe(5);
    });
  });

  describe("asBoolean", () => {
    it("Boolean() coerción estándar", () => {
      expect(asBoolean(true)).toBe(true);
      expect(asBoolean(1)).toBe(true);
      expect(asBoolean("hola")).toBe(true);
      expect(asBoolean(0)).toBe(false);
      expect(asBoolean("")).toBe(false);
    });
    it("fallback en null/undefined", () => {
      expect(asBoolean(null)).toBe(false);
      expect(asBoolean(undefined, true)).toBe(true);
    });
  });

  describe("asArray", () => {
    it("retorna array si es array", () => {
      expect(asArray([1, 2, 3])).toEqual([1, 2, 3]);
      expect(asArray([])).toEqual([]);
    });
    it("fallback en valor no-array", () => {
      expect(asArray("not array")).toEqual([]);
      expect(asArray(null)).toEqual([]);
      expect(asArray(undefined, [99])).toEqual([99]);
    });
  });

  describe("ensureDefined", () => {
    it("retorna value cuando está definido", () => {
      expect(ensureDefined("hola", "err")).toBe("hola");
      expect(ensureDefined(0, "err")).toBe(0);
      expect(ensureDefined(false, "err")).toBe(false);
    });
    it("throw cuando es null/undefined", () => {
      expect(() => ensureDefined(null, "fue null")).toThrow("fue null");
      expect(() => ensureDefined(undefined, "fue undef")).toThrow("fue undef");
    });
  });
});
