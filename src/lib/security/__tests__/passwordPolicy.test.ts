// Tests for the client-side password policy (audit 2026-06, Área 1).

import { describe, it, expect } from "vitest";
import { validatePassword, MIN_PASSWORD_LENGTH } from "../passwordPolicy";

describe("validatePassword", () => {
  it("rejects passwords shorter than the minimum", () => {
    expect(validatePassword("short").ok).toBe(false);
    expect(validatePassword("a".repeat(MIN_PASSWORD_LENGTH - 1)).ok).toBe(false);
  });

  it("rejects empty / missing", () => {
    expect(validatePassword("").ok).toBe(false);
    expect(validatePassword(undefined as unknown as string).ok).toBe(false);
  });

  it("accepts passwords at or above the minimum length", () => {
    expect(validatePassword("a".repeat(MIN_PASSWORD_LENGTH)).ok).toBe(true);
    expect(validatePassword("correct horse battery staple").ok).toBe(true);
  });

  it("error message states the minimum length", () => {
    expect(validatePassword("x").error).toContain(String(MIN_PASSWORD_LENGTH));
  });
});
