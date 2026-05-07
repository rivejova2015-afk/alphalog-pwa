// Regression guard for the middleware Content-Type policy.
//
// History: the middleware originally enforced `application/json` on every
// mutating API request. DELETE requests fired from the UI (no body) lack a
// Content-Type header, so they were silently 415'd — strategies couldn't be
// deleted from /intelligence/algorithms. Patch: skip the check for DELETE
// and for any bodyless request (Content-Length 0/missing and no
// Transfer-Encoding). This test asserts the patch stays in place.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const MW_PATH = path.resolve(__dirname, "../../../middleware.ts");
const SRC = readFileSync(MW_PATH, "utf8");

describe("middleware: Content-Type validation", () => {
  it("skips Content-Type enforcement on DELETE requests", () => {
    expect(SRC).toMatch(/request\.method\s*!==\s*["']DELETE["']/);
  });

  it("skips Content-Type enforcement on bodyless requests", () => {
    expect(SRC).toMatch(/content-length/);
    expect(SRC).toMatch(/transfer-encoding/);
  });

  it("still enforces Content-Type for non-DELETE requests with a body", () => {
    // Fail-safe: the 415 response branch must remain present.
    expect(SRC).toMatch(/Invalid Content-Type/);
    expect(SRC).toMatch(/status:\s*415/);
  });
});
