// Unit tests for validateJournalEntry — pure validation helper en
// src/lib/alphacore/journal.ts. Returns array de validation errors.
//
// Validates:
//   1. text vacío → error 'Journal entry text is required'.
//   2. text con solo whitespace → mismo error.
//   3. text < 10 chars → 'at least 10 characters'.
//   4. text > 50000 chars → 'cannot exceed 50,000 characters'.
//   5. text válido (10-50000) → sin error de text.
//   6. mood inválido → 'Invalid mood value'.
//   7. mood válido ('excellent'/'good'/'neutral'/'bad'/'terrible') → sin error.
//   8. mood_score < 1 → error 'Mood score must be between 1 and 10'.
//   9. mood_score > 10 → mismo error.
//   10. mood_score = 0 → mismo error (boundary).
//   11. mood_score válido (1-10) → sin error.
//   12. tags > 20 items → 'Maximum 20 tags allowed'.
//   13. tag vacío → 'Tag cannot be empty'.
//   14. tag > 50 chars → 'Tag cannot exceed 50 characters'.
//   15. action_items > 20 items → 'Maximum 20 action items allowed'.
//   16. input válido completo → array vacío de errors.

import { describe, it, expect } from "vitest";
import { validateJournalEntry } from "../journal";
import type { CreateJournalEntryInput } from "../journal";

describe("validateJournalEntry", () => {
  it("text vacío → error 'required'", () => {
    const errors = validateJournalEntry({ text: "" });
    expect(errors).toContainEqual({
      field: "text", message: "Journal entry text is required",
    });
  });

  it("text con solo whitespace → 'required'", () => {
    const errors = validateJournalEntry({ text: "   \n\t  " });
    expect(errors.some((e) => e.field === "text" && e.message.includes("required"))).toBe(true);
  });

  it("text < 10 chars → 'at least 10 characters'", () => {
    const errors = validateJournalEntry({ text: "hi mom" });
    expect(errors).toContainEqual({
      field: "text", message: "Journal entry must be at least 10 characters",
    });
  });

  it("text > 50000 chars → 'cannot exceed 50,000 characters'", () => {
    const big = "x".repeat(50_001);
    const errors = validateJournalEntry({ text: big });
    expect(errors).toContainEqual({
      field: "text", message: "Journal entry cannot exceed 50,000 characters",
    });
  });

  it("text exactamente 10 chars → sin error de text", () => {
    const errors = validateJournalEntry({ text: "1234567890" });
    expect(errors.filter((e) => e.field === "text")).toEqual([]);
  });

  it("text 11-50000 chars (válido) → sin error", () => {
    const errors = validateJournalEntry({ text: "This is a normal journal entry today." });
    expect(errors.filter((e) => e.field === "text")).toEqual([]);
  });

  it("mood inválido → 'Invalid mood value'", () => {
    const errors = validateJournalEntry({
      text: "Valid text here",
      mood: "ecstatic" as unknown as CreateJournalEntryInput["mood"],
    });
    expect(errors).toContainEqual({ field: "mood", message: "Invalid mood value" });
  });

  it("mood 'excellent' válido → sin error de mood", () => {
    const errors = validateJournalEntry({ text: "Valid text here", mood: "excellent" });
    expect(errors.filter((e) => e.field === "mood")).toEqual([]);
  });

  it("mood 'terrible' válido → sin error", () => {
    const errors = validateJournalEntry({ text: "Valid text here", mood: "terrible" });
    expect(errors.filter((e) => e.field === "mood")).toEqual([]);
  });

  it("mood_score < 1 → error 'between 1 and 10'", () => {
    const errors = validateJournalEntry({ text: "Valid text here", mood_score: 0 });
    expect(errors).toContainEqual({
      field: "mood_score", message: "Mood score must be between 1 and 10",
    });
  });

  it("mood_score > 10 → mismo error", () => {
    const errors = validateJournalEntry({ text: "Valid text here", mood_score: 11 });
    expect(errors).toContainEqual({
      field: "mood_score", message: "Mood score must be between 1 and 10",
    });
  });

  it("mood_score = 1 (boundary mínimo) → sin error", () => {
    const errors = validateJournalEntry({ text: "Valid text here", mood_score: 1 });
    expect(errors.filter((e) => e.field === "mood_score")).toEqual([]);
  });

  it("mood_score = 10 (boundary máximo) → sin error", () => {
    const errors = validateJournalEntry({ text: "Valid text here", mood_score: 10 });
    expect(errors.filter((e) => e.field === "mood_score")).toEqual([]);
  });

  it("tags > 20 items → 'Maximum 20 tags allowed'", () => {
    const tooMany = Array.from({ length: 21 }, (_, i) => `tag${i}`);
    const errors = validateJournalEntry({ text: "Valid text here", tags: tooMany });
    expect(errors).toContainEqual({
      field: "tags", message: "Maximum 20 tags allowed",
    });
  });

  it("tag vacío en array → 'Tag cannot be empty'", () => {
    const errors = validateJournalEntry({
      text: "Valid text here", tags: ["good", "", "ok"],
    });
    expect(errors).toContainEqual({
      field: "tags[1]", message: "Tag cannot be empty",
    });
  });

  it("tag > 50 chars → 'Tag cannot exceed 50 characters'", () => {
    const longTag = "x".repeat(51);
    const errors = validateJournalEntry({
      text: "Valid text here", tags: ["ok", longTag],
    });
    expect(errors).toContainEqual({
      field: "tags[1]", message: "Tag cannot exceed 50 characters",
    });
  });

  it("action_items > 20 items → 'Maximum 20 action items allowed'", () => {
    const tooMany = Array.from({ length: 21 }, (_, i) => `action ${i}`);
    const errors = validateJournalEntry({
      text: "Valid text here", action_items: tooMany,
    });
    expect(errors).toContainEqual({
      field: "action_items", message: "Maximum 20 action items allowed",
    });
  });

  it("input válido completo → array vacío", () => {
    const errors = validateJournalEntry({
      text: "Hoy operé XAUUSD con disciplina.",
      mood: "good",
      mood_score: 7,
      tags: ["xauusd", "patience"],
      market_conditions: "Trending up",
      focus_areas: ["risk management"],
      lessons_learned: "Wait for confirmation before entering.",
      action_items: ["Review trade journal weekly"],
      trade_id: "trade-uuid-here",
      is_private: false,
    });
    expect(errors).toEqual([]);
  });

  it("acumula múltiples errores en un solo call", () => {
    const errors = validateJournalEntry({
      text: "hi",                                          // too short
      mood: "weird" as unknown as CreateJournalEntryInput["mood"],
      mood_score: 99,                                      // out of range
      tags: ["", "x".repeat(51)],                         // empty + too long
    });
    expect(errors.length).toBeGreaterThanOrEqual(5);
    expect(errors.some((e) => e.field === "text")).toBe(true);
    expect(errors.some((e) => e.field === "mood")).toBe(true);
    expect(errors.some((e) => e.field === "mood_score")).toBe(true);
    expect(errors.some((e) => e.field === "tags[0]")).toBe(true);
    expect(errors.some((e) => e.field === "tags[1]")).toBe(true);
  });
});
