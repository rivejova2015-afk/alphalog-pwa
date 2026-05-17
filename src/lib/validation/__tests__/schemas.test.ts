import { describe, it, expect } from "vitest";
import {
  tradeCreateSchema,
  tradeUpdateSchema,
  journalEntrySchema,
  sendEmailSchema,
  exportRequestSchema,
  goalCreateSchema,
  paginationSchema,
  validatePayload,
  validatePayloadSafe,
  validationErrorResponse,
} from "../schemas";

const VALID_TRADE = {
  account_id: "00000000-0000-4000-8000-000000000001",
  symbol: "XAUUSD",
  direction: "BUY",
  status: "open",
  entry_date: "2026-05-03",
  exit_date: null,
  entry_price: 2000.5,
  exit_price: 2010.5,
  lots: 0.5,
  stop_loss_price: 1990,
  take_profit_price: 2020,
};

describe("schemas", () => {
  describe("tradeCreateSchema", () => {
    it("acepta payload válido", () => {
      const r = tradeCreateSchema.safeParse(VALID_TRADE);
      expect(r.success).toBe(true);
    });

    it("rechaza account_id no-uuid", () => {
      const r = tradeCreateSchema.safeParse({ ...VALID_TRADE, account_id: "not-uuid" });
      expect(r.success).toBe(false);
    });

    it("rechaza direction inválida", () => {
      const r = tradeCreateSchema.safeParse({ ...VALID_TRADE, direction: "LONG" });
      expect(r.success).toBe(false);
    });

    it("rechaza entry_price <= 0", () => {
      const r = tradeCreateSchema.safeParse({ ...VALID_TRADE, entry_price: 0 });
      expect(r.success).toBe(false);
    });

    it("rechaza fecha mal formada", () => {
      const r = tradeCreateSchema.safeParse({ ...VALID_TRADE, entry_date: "03/05/2026" });
      expect(r.success).toBe(false);
    });

    it("rechaza symbol vacío", () => {
      const r = tradeCreateSchema.safeParse({ ...VALID_TRADE, symbol: "" });
      expect(r.success).toBe(false);
    });

    it("rechaza notes > 5000 chars", () => {
      const r = tradeCreateSchema.safeParse({ ...VALID_TRADE, notes: "x".repeat(5001) });
      expect(r.success).toBe(false);
    });
  });

  describe("tradeUpdateSchema", () => {
    it("acepta partial update (sólo campos relevantes)", () => {
      const r = tradeUpdateSchema.safeParse({ notes: "actualizado" });
      expect(r.success).toBe(true);
    });

    it("acepta restore: true (campo extra opcional)", () => {
      const r = tradeUpdateSchema.safeParse({ restore: true });
      expect(r.success).toBe(true);
    });

    it("rechaza campos con tipos incorrectos aunque sean opcionales", () => {
      const r = tradeUpdateSchema.safeParse({ lots: "media" });
      expect(r.success).toBe(false);
    });
  });

  describe("journalEntrySchema", () => {
    it("acepta entry mínima válida", () => {
      const r = journalEntrySchema.safeParse({ text: "Hoy operé bien" });
      expect(r.success).toBe(true);
    });

    it("rechaza text < 10 chars", () => {
      const r = journalEntrySchema.safeParse({ text: "corto" });
      expect(r.success).toBe(false);
    });

    it("rechaza mood inválido", () => {
      const r = journalEntrySchema.safeParse({ text: "Diez chars aquí", mood: "happy" });
      expect(r.success).toBe(false);
    });

    it("rechaza mood_score fuera de 1-10", () => {
      const r = journalEntrySchema.safeParse({ text: "Diez chars aquí", mood_score: 11 });
      expect(r.success).toBe(false);
    });

    it("rechaza tags > 20 items", () => {
      const r = journalEntrySchema.safeParse({
        text: "Diez chars aquí",
        tags: Array.from({ length: 21 }, (_, i) => `tag${i}`),
      });
      expect(r.success).toBe(false);
    });
  });

  describe("sendEmailSchema", () => {
    it("acepta payload válido", () => {
      const r = sendEmailSchema.safeParse({
        mailbox_id: "00000000-0000-4000-8000-000000000002",
        to_email: "to@ejemplo.com",
        subject_ciphertext: "x".repeat(20),
        body_ciphertext: "y".repeat(20),
      });
      expect(r.success).toBe(true);
    });

    it("rechaza to_email no válido", () => {
      const r = sendEmailSchema.safeParse({
        mailbox_id: "00000000-0000-4000-8000-000000000002",
        to_email: "no-es-email",
        subject_ciphertext: "x".repeat(20),
        body_ciphertext: "y".repeat(20),
      });
      expect(r.success).toBe(false);
    });

    it("rechaza más de 10 attachments", () => {
      const r = sendEmailSchema.safeParse({
        mailbox_id: "00000000-0000-4000-8000-000000000002",
        to_email: "ok@ejemplo.com",
        subject_ciphertext: "x".repeat(20),
        body_ciphertext: "y".repeat(20),
        attachments: Array.from({ length: 11 }, () => ({
          filename: "f.txt", content_base64: "AAAA", content_type: "text/plain",
        })),
      });
      expect(r.success).toBe(false);
    });
  });

  describe("exportRequestSchema", () => {
    it("acepta formatos y resource_types válidos", () => {
      for (const fmt of ["csv", "json", "pdf"] as const) {
        const r = exportRequestSchema.safeParse({ resource_type: "trades", format: fmt });
        expect(r.success).toBe(true);
      }
    });
    it("rechaza format desconocido", () => {
      const r = exportRequestSchema.safeParse({ resource_type: "trades", format: "xml" });
      expect(r.success).toBe(false);
    });
  });

  describe("goalCreateSchema", () => {
    it("acepta goal con campos obligatorios", () => {
      const r = goalCreateSchema.safeParse({
        title: "Goal X",
        goal_value: 100,
        metrics_type: "currency",
        start_date: "2026-01-01",
        end_date: "2026-12-31",
      });
      expect(r.success).toBe(true);
    });
    it("rechaza title corto", () => {
      const r = goalCreateSchema.safeParse({
        title: "X",
        goal_value: 100,
        metrics_type: "currency",
        start_date: "2026-01-01",
        end_date: "2026-12-31",
      });
      expect(r.success).toBe(false);
    });
    it("rechaza priority no permitida", () => {
      const r = goalCreateSchema.safeParse({
        title: "Goal X",
        goal_value: 100,
        metrics_type: "currency",
        start_date: "2026-01-01",
        end_date: "2026-12-31",
        priority: "urgent",
      });
      expect(r.success).toBe(false);
    });
  });

  describe("paginationSchema", () => {
    it("acepta limit y offset válidos", () => {
      const r = paginationSchema.safeParse({ limit: 50, offset: 100 });
      expect(r.success).toBe(true);
    });
    it("rechaza limit > 1000", () => {
      const r = paginationSchema.safeParse({ limit: 5000 });
      expect(r.success).toBe(false);
    });
    it("rechaza offset negativo", () => {
      const r = paginationSchema.safeParse({ offset: -1 });
      expect(r.success).toBe(false);
    });
  });

  describe("validatePayload", () => {
    it("retorna data tipada en happy path", () => {
      const r = validatePayload(tradeCreateSchema, VALID_TRADE);
      expect(r.symbol).toBe("XAUUSD");
    });
    it("throw para payload inválido", () => {
      expect(() => validatePayload(tradeCreateSchema, { foo: "bar" })).toThrow();
    });
  });

  describe("validatePayloadSafe", () => {
    it("success=true para válido", () => {
      const r = validatePayloadSafe(tradeCreateSchema, VALID_TRADE);
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.symbol).toBe("XAUUSD");
    });
    it("success=false con errores por path", () => {
      const r = validatePayloadSafe(tradeCreateSchema, {});
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(Object.keys(r.errors).length).toBeGreaterThan(0);
      }
    });
  });

  describe("validationErrorResponse", () => {
    it("retorna shape estándar { error, details }", () => {
      const r = validationErrorResponse({ field: "invalid" });
      expect(r.error).toBe("Validation failed");
      expect(r.details).toEqual({ field: "invalid" });
    });
  });
});
