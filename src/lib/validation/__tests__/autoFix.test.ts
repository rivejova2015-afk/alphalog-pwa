import { describe, it, expect } from "vitest";
import {
  autoFixTradeCreate,
  autoFixTradeUpdate,
  autoFixJournalEntry,
} from "../autoFix";

describe("autoFix", () => {
  describe("autoFixTradeCreate", () => {
    it("uppercase symbol y trim", () => {
      const r = autoFixTradeCreate({ symbol: " xauusd " });
      expect(r.data.symbol).toBe("XAUUSD");
      expect(r.changed).toBe(true);
      expect(r.changes).toContain("symbol");
    });

    it("corrige typo 'dirction' → 'direction'", () => {
      const r = autoFixTradeCreate({ dirction: "buy" });
      expect(r.data.direction).toBe("BUY");
      expect(r.changes).toContain("direction");
    });

    it("normaliza status lowercase", () => {
      const r = autoFixTradeCreate({ status: "OPEN" });
      expect(r.data.status).toBe("open");
    });

    it("normaliza entry_date desde Date a YYYY-MM-DD", () => {
      const r = autoFixTradeCreate({ entry_date: new Date("2026-05-03T12:00:00Z") });
      expect(r.data.entry_date).toBe("2026-05-03");
    });

    it("normaliza entry_date desde ISO string", () => {
      const r = autoFixTradeCreate({ entry_date: "2026-05-03T12:00:00Z" });
      expect(r.data.entry_date).toBe("2026-05-03");
    });

    it("convierte string numéricos a number", () => {
      const r = autoFixTradeCreate({ entry_price: "2000.50", lots: "0.5" });
      expect(r.data.entry_price).toBe(2000.5);
      expect(r.data.lots).toBe(0.5);
    });

    it("trim notes", () => {
      const r = autoFixTradeCreate({ notes: "  test  " });
      expect(r.data.notes).toBe("test");
    });

    it("ignora valores undefined/null en el output sin cambios", () => {
      const r = autoFixTradeCreate({});
      expect(r.changed).toBe(false);
      expect(r.changes).toEqual([]);
    });

    it("boolean is_featured_in_report convierte string 'true'", () => {
      const r = autoFixTradeCreate({ is_featured_in_report: "true" });
      expect(r.data.is_featured_in_report).toBe(true);
    });

    it("preserva date inválida sin marcarla como cambio", () => {
      const input = { entry_date: "not-a-date" };
      const r = autoFixTradeCreate(input);
      // Spread preserva el valor original; la normalización no se aplica si parse falla
      expect(r.data.entry_date).toBe("not-a-date");
      expect(r.changes).not.toContain("entry_date");
    });
  });

  describe("autoFixTradeUpdate", () => {
    it("sólo normaliza campos presentes en input (partial)", () => {
      const r = autoFixTradeUpdate({ notes: "  partial  " });
      expect(r.data.notes).toBe("partial");
      // No agrega campos que no estaban
      expect(r.data.symbol).toBeUndefined();
    });

    it("acepta restore: 'false' como boolean false", () => {
      const r = autoFixTradeUpdate({ restore: "false" });
      expect(r.data.restore).toBe(false);
    });

    it("mantiene el resto del payload intacto", () => {
      const input = { custom_field: "yo no me toco", notes: " x " };
      const r = autoFixTradeUpdate(input);
      expect(r.data.custom_field).toBe("yo no me toco");
      expect(r.data.notes).toBe("x");
    });
  });

  describe("autoFixJournalEntry", () => {
    it("trim text", () => {
      const r = autoFixJournalEntry({ text: "  diario  " });
      expect(r.data.text).toBe("diario");
    });

    it("normaliza mood lowercase", () => {
      const r = autoFixJournalEntry({ mood: "GOOD" });
      expect(r.data.mood).toBe("good");
    });

    it("convierte tags string CSV a array", () => {
      const r = autoFixJournalEntry({ tags: "win, focus, learn" });
      expect(r.data.tags).toEqual(["win", "focus", "learn"]);
    });

    it("acepta tags ya como array", () => {
      const r = autoFixJournalEntry({ tags: ["a", "b"] });
      expect(r.data.tags).toEqual(["a", "b"]);
    });

    it("filtra tags vacíos", () => {
      const r = autoFixJournalEntry({ tags: "a,,b, ,c" });
      expect(r.data.tags).toEqual(["a", "b", "c"]);
    });

    it("convierte mood_score string a number", () => {
      const r = autoFixJournalEntry({ mood_score: "7" });
      expect(r.data.mood_score).toBe(7);
    });
  });
});
