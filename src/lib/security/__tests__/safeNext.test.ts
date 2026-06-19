// Tests for the open-redirect guard (audit 2026-06, Área 7).

import { describe, it, expect } from "vitest";
import { safeNextPath } from "../safeNext";

describe("safeNextPath", () => {
  it("accepts clean internal paths", () => {
    expect(safeNextPath("/dashboard")).toBe("/dashboard");
    expect(safeNextPath("/business/journal")).toBe("/business/journal");
    expect(safeNextPath("/intelligence?tab=x")).toBe("/intelligence?tab=x");
  });

  it("rejects absolute URLs and dangerous schemes", () => {
    expect(safeNextPath("https://evil.tld")).toBe("/dashboard");
    expect(safeNextPath("http://evil.tld")).toBe("/dashboard");
    expect(safeNextPath("javascript:alert(1)")).toBe("/dashboard");
    expect(safeNextPath("data:text/html,x")).toBe("/dashboard");
  });

  it("rejects protocol-relative and backslash tricks", () => {
    expect(safeNextPath("//evil.tld")).toBe("/dashboard");
    expect(safeNextPath("/\\evil.tld")).toBe("/dashboard");
  });

  it("falls back on null/undefined/empty", () => {
    expect(safeNextPath(null)).toBe("/dashboard");
    expect(safeNextPath(undefined)).toBe("/dashboard");
    expect(safeNextPath("")).toBe("/dashboard");
  });

  it("honors a custom fallback", () => {
    expect(safeNextPath("https://evil.tld", "/auth")).toBe("/auth");
  });
});
