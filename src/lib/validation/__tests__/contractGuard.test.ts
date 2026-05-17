import { describe, it, expect } from "vitest";
import { z } from "zod";
import { enforceResponseContract } from "../contractGuard";

describe("contractGuard", () => {
  describe("enforceResponseContract", () => {
    it("retorna ok=true con data tipada para payload válido", () => {
      const schema = z.object({ name: z.string(), age: z.number() });
      const r = enforceResponseContract(schema, { name: "Ana", age: 30 });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.data.name).toBe("Ana");
        expect(r.data.age).toBe(30);
      }
    });

    it("retorna ok=false con errores indexados por path", () => {
      const schema = z.object({ name: z.string(), age: z.number() });
      const r = enforceResponseContract(schema, { name: 123, age: "treinta" });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.errors).toHaveProperty("name");
        expect(r.errors).toHaveProperty("age");
      }
    });

    it("path vacío se reporta como 'root'", () => {
      const schema = z.string();
      const r = enforceResponseContract(schema, 42);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.errors).toHaveProperty("root");
      }
    });

    it("paths anidados se unen con '.'", () => {
      const schema = z.object({
        user: z.object({ profile: z.object({ email: z.string() }) }),
      });
      const r = enforceResponseContract(schema, {
        user: { profile: { email: 123 } },
      });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(Object.keys(r.errors)).toContain("user.profile.email");
      }
    });

    it("payload null sigue el schema (rechaza schemas no-nulables)", () => {
      const schema = z.object({ x: z.number() });
      const r = enforceResponseContract(schema, null);
      expect(r.ok).toBe(false);
    });
  });
});
