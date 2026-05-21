import { describe, it, expect } from "vitest";
import {
  interpretDatabaseError,
  getAllDedupeSchemas,
  exportDedupeConfig,
} from "../dedupe-checker";

describe("interpretDatabaseError", () => {
  it("código 23505 → isDuplicate=true con razón clara", () => {
    const r = interpretDatabaseError("trades", "23505", "duplicate key value");
    expect(r.isDuplicate).toBe(true);
    expect(r.reason).toMatch(/Unique constraint/);
  });

  it("código 23503 → isDuplicate=false (FK violation)", () => {
    const r = interpretDatabaseError("trades", "23503", "fk violation");
    expect(r.isDuplicate).toBe(false);
    expect(r.reason).toMatch(/Foreign key/);
  });

  it("detalle con 'duplicate' (lowercased) → isDuplicate=true", () => {
    const r = interpretDatabaseError("trades", "ZZZ", "Some Duplicate detected here");
    expect(r.isDuplicate).toBe(true);
    expect(r.reason).toContain("Duplicate detected");
  });

  it("código desconocido + sin 'duplicate' → isDuplicate=false", () => {
    const r = interpretDatabaseError("trades", "99999", "weird error");
    expect(r.isDuplicate).toBe(false);
    expect(r.reason).toContain("Unknown error");
  });

  it("23505 tiene prioridad sobre 'duplicate' en mensaje", () => {
    // El primer if (23505) atrapa antes del check de 'duplicate'
    const r = interpretDatabaseError("trades", "23505", "duplicate detected");
    expect(r.isDuplicate).toBe(true);
    expect(r.reason).toMatch(/Unique constraint/);
  });
});

describe("getAllDedupeSchemas", () => {
  it("retorna el catálogo DEDUPE_SCHEMAS completo", () => {
    const s = getAllDedupeSchemas();
    expect(s).toBeDefined();
    expect(typeof s).toBe("object");
    expect(s.categories).toBeDefined();
    expect(s.accounts).toBeDefined();
    expect(s.trades).toBeDefined();
  });
});

describe("exportDedupeConfig", () => {
  it("retorna config con totalTables + byStrategy + tables map", () => {
    const c = exportDedupeConfig();
    expect(c.totalTables).toBeGreaterThan(0);
    expect(c.byStrategy).toMatchObject({
      UNIQUE_CONSTRAINT: expect.any(Number),
      DERIVED_FROM_UI_DB: expect.any(Number),
      UNDETERMINED: expect.any(Number),
    });
    expect(typeof c.tables).toBe("object");
  });

  it("byStrategy counts suman totalTables", () => {
    const c = exportDedupeConfig();
    const sum =
      c.byStrategy.UNIQUE_CONSTRAINT +
      c.byStrategy.DERIVED_FROM_UI_DB +
      c.byStrategy.UNDETERMINED;
    expect(sum).toBe(c.totalTables);
  });

  it("cada tabla en .tables tiene enabled, strategy, fields, strictMode", () => {
    const c = exportDedupeConfig();
    for (const [, info] of Object.entries(c.tables)) {
      expect(info).toMatchObject({
        enabled: expect.any(Boolean),
        strategy: expect.any(String),
        fields: expect.any(Array),
        strictMode: expect.any(Boolean),
      });
    }
  });
});
