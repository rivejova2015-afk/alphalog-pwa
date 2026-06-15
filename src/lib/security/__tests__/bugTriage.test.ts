// Unit tests for src/lib/security/bugTriage.ts.
//
// Pure classifier — categoría + severity + fingerprint determinístico +
// sugerencia por categoría. Validates:
//   - severityFromStatus: 5xx, 503+ critical, 429/4xx medium/low.
//   - categoryFromSignals: keyword matching en errorMessage/path/stack.
//   - fingerprint determinístico (sha256 sobre concatenación).
//   - suggestion mapping por categoría.

import { describe, it, expect } from "vitest";
import { classifyBug } from "../bugTriage";

describe("classifyBug — severity", () => {
  it("503+ → critical", () => {
    expect(classifyBug({ status: 503 }).severity).toBe("critical");
    expect(classifyBug({ status: 504 }).severity).toBe("critical");
  });

  it("500-502 → high", () => {
    expect(classifyBug({ status: 500 }).severity).toBe("high");
    expect(classifyBug({ status: 502 }).severity).toBe("high");
  });

  it("429 → medium", () => {
    expect(classifyBug({ status: 429 }).severity).toBe("medium");
  });

  it("401/403 → medium", () => {
    expect(classifyBug({ status: 401 }).severity).toBe("medium");
    expect(classifyBug({ status: 403 }).severity).toBe("medium");
  });

  it("4xx genérico → low", () => {
    expect(classifyBug({ status: 400 }).severity).toBe("low");
    expect(classifyBug({ status: 404 }).severity).toBe("low");
  });

  it("undefined status → medium (default)", () => {
    expect(classifyBug({}).severity).toBe("medium");
    expect(classifyBug({ status: null }).severity).toBe("medium");
  });
});

describe("classifyBug — category by keywords", () => {
  it("'validation' o 'invalid' en message → 'validation'", () => {
    expect(classifyBug({ errorMessage: "Validation failed" }).category).toBe("validation");
    expect(classifyBug({ errorMessage: "Invalid input" }).category).toBe("validation");
  });

  it("'unauthorized'/'forbidden' o status 401/403 → 'auth'", () => {
    expect(classifyBug({ errorMessage: "Unauthorized request" }).category).toBe("auth");
    expect(classifyBug({ errorMessage: "Forbidden" }).category).toBe("auth");
    expect(classifyBug({ status: 401 }).category).toBe("auth");
    expect(classifyBug({ status: 403 }).category).toBe("auth");
  });

  it("status 429 o 'rate limit' → 'rate_limit'", () => {
    expect(classifyBug({ status: 429 }).category).toBe("rate_limit");
    expect(classifyBug({ errorMessage: "Rate limit exceeded" }).category).toBe("rate_limit");
  });

  it("'encryption'/'decrypt'/'cipher' → 'encryption'", () => {
    expect(classifyBug({ errorMessage: "Encryption failure" }).category).toBe("encryption");
    expect(classifyBug({ errorMessage: "Cannot decrypt" }).category).toBe("encryption");
    expect(classifyBug({ errorMessage: "Cipher error" }).category).toBe("encryption");
  });

  it("'postmark'/'edge function'/'fetch'/'network' → 'external_service'", () => {
    expect(classifyBug({ errorMessage: "Postmark API down" }).category).toBe("external_service");
    expect(classifyBug({ errorMessage: "Network error" }).category).toBe("external_service");
    expect(classifyBug({ errorMessage: "fetch failed" }).category).toBe("external_service");
  });

  it("'supabase'/'pgrst'/'database' en message O 'supabase' en stack → 'database'", () => {
    expect(classifyBug({ errorMessage: "Database connection refused" }).category).toBe("database");
    expect(classifyBug({ errorMessage: "PGRST205" }).category).toBe("database");
    expect(classifyBug({ errorMessage: "x", errorStack: "at supabase.from('y')" }).category).toBe("database");
  });

  it("paths /api/treasury|tradehub|journal → category matching", () => {
    expect(classifyBug({ path: "/api/treasury/payouts" }).category).toBe("treasury");
    expect(classifyBug({ path: "/api/tradehub/trades" }).category).toBe("tradehub");
    expect(classifyBug({ path: "/api/journal" }).category).toBe("journal");
  });

  it("default → 'unknown' cuando no hay signals reconocidas", () => {
    expect(classifyBug({}).category).toBe("unknown");
    expect(classifyBug({ errorMessage: "some random text" }).category).toBe("unknown");
  });

  it("priority: validation > auth (validation gana)", () => {
    expect(classifyBug({ errorMessage: "Invalid token", status: 401 }).category).toBe("validation");
  });
});

describe("classifyBug — fingerprint", () => {
  it("determinístico: same inputs → same fingerprint", () => {
    const a = classifyBug({ errorMessage: "x", path: "/api/y", status: 500 });
    const b = classifyBug({ errorMessage: "x", path: "/api/y", status: 500 });
    expect(a.fingerprint).toBe(b.fingerprint);
  });

  it("64-char SHA-256 hex", () => {
    expect(classifyBug({}).fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("diferentes inputs → diferentes fingerprints", () => {
    const a = classifyBug({ errorMessage: "error A" });
    const b = classifyBug({ errorMessage: "error B" });
    expect(a.fingerprint).not.toBe(b.fingerprint);
  });

  it("case-insensitive message en fingerprint (normalize a lowercase)", () => {
    const a = classifyBug({ errorMessage: "Validation FAILED" });
    const b = classifyBug({ errorMessage: "validation failed" });
    expect(a.fingerprint).toBe(b.fingerprint);
  });
});

describe("classifyBug — suggestion", () => {
  it("retorna sugerencia específica por categoría", () => {
    expect(classifyBug({ errorMessage: "Validation X" }).suggestion).toMatch(/payload schema/i);
    expect(classifyBug({ errorMessage: "Unauthorized" }).suggestion).toMatch(/session.*auth/i);
    expect(classifyBug({ status: 429 }).suggestion).toMatch(/rate limit/i);
    expect(classifyBug({ errorMessage: "Encryption fail" }).suggestion).toMatch(/DATA_ENCRYPTION_KEY/);
    expect(classifyBug({ errorMessage: "Network failed" }).suggestion).toMatch(/upstream service/i);
    expect(classifyBug({ errorMessage: "PGRST error" }).suggestion).toMatch(/RLS policies/i);
    expect(classifyBug({ path: "/api/treasury" }).suggestion).toMatch(/treasury queries/i);
    expect(classifyBug({}).suggestion).toMatch(/Inspect server logs/i);
  });
});
