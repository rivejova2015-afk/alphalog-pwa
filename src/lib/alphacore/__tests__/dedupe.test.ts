import { describe, it, expect } from "vitest";
import {
  DEDUPE_SCHEMAS,
  checkDuplicate,
  interpretDedupeError,
  getDedupeRequirementsForTable,
  generateIndexVerificationSQL,
  generateDedupeDocumentation,
} from "../dedupe";

describe("DEDUPE_SCHEMAS catalog", () => {
  it("contiene entries para tablas críticas", () => {
    const critical = ["categories", "tags", "accounts", "setups", "weekly_reports", "instruments"];
    for (const table of critical) {
      expect(DEDUPE_SCHEMAS[table]).toBeDefined();
    }
  });

  it("cada schema tiene shape válida", () => {
    for (const [, cfg] of Object.entries(DEDUPE_SCHEMAS)) {
      expect(typeof cfg.enabled).toBe("boolean");
      expect(Array.isArray(cfg.fields)).toBe(true);
      expect(["UNIQUE_CONSTRAINT", "DERIVED_FROM_UI_DB", "UNDETERMINED"]).toContain(cfg.source);
      expect(typeof cfg.strictMode).toBe("boolean");
    }
  });

  it("tablas con enabled=false tienen fields vacío", () => {
    for (const [, cfg] of Object.entries(DEDUPE_SCHEMAS)) {
      if (!cfg.enabled) expect(cfg.fields).toEqual([]);
    }
  });
});

describe("checkDuplicate", () => {
  it("retorna {isDuplicate: false} cuando la tabla no está configurada", () => {
    const r = checkDuplicate({ table: "unknown_table", payload: { a: 1 } });
    expect(r.isDuplicate).toBe(false);
  });

  it("retorna {isDuplicate: false} cuando enabled=false (e.g. trades)", () => {
    const r = checkDuplicate({ table: "trades", payload: { symbol: "XAUUSD" } });
    expect(r.isDuplicate).toBe(false);
  });

  it("checkDuplicate de categorías (estructural, retorna false sin DB)", () => {
    const r = checkDuplicate({
      table: "categories",
      payload: { name: "Trading Tips", name_lower: "trading tips" },
      userId: "user-1",
    });
    expect(r.isDuplicate).toBe(false); // structural validation only
  });

  it("auto-genera name_lower cuando hay name pero no name_lower", () => {
    // Confirmamos que no crashea con payload sin name_lower
    expect(() =>
      checkDuplicate({ table: "categories", payload: { name: "Mixed Case" } })
    ).not.toThrow();
  });
});

describe("interpretDedupeError", () => {
  it("23505 → isDuplicateError=true, recoveryAction=SHOW_DIALOG", () => {
    const r = interpretDedupeError("23505", "Key (name_lower)=(test) already exists", "categories");
    expect(r.isDuplicateError).toBe(true);
    expect(r.recoveryAction).toBe("SHOW_DIALOG");
    expect(r.field).toBe("name_lower");
  });

  it("23503 → isDuplicateError=false (FK violation, no duplicate)", () => {
    const r = interpretDedupeError("23503", "violates FK constraint", "trades");
    expect(r.isDuplicateError).toBe(false);
    expect(r.recoveryAction).toBe("SHOW_DIALOG");
  });

  it("42P01 → undefined table, action=SKIP", () => {
    const r = interpretDedupeError("42P01", "relation does not exist", "missing_table");
    expect(r.isDuplicateError).toBe(false);
    expect(r.recoveryAction).toBe("SKIP");
    expect(r.message).toContain("Table schema");
  });

  it("código desconocido → action=SKIP con mensaje passthrough", () => {
    const r = interpretDedupeError("99999", "weird error", "accounts");
    expect(r.recoveryAction).toBe("SKIP");
    expect(r.message).toBe("weird error");
  });

  it("23505 sin pattern 'Key (field)=' usa fallback al primer field del config", () => {
    const r = interpretDedupeError("23505", "no parseable message", "categories");
    // categories.fields = ['user_id', 'name_lower'] → primer field = 'user_id'
    expect(r.field).toBe("user_id");
  });
});

describe("getDedupeRequirementsForTable", () => {
  it("retorna [] cuando la tabla no existe", () => {
    expect(getDedupeRequirementsForTable("ghost_table")).toEqual([]);
  });

  it("retorna [] cuando enabled=false", () => {
    expect(getDedupeRequirementsForTable("trades")).toEqual([]);
  });

  it("retorna 4 líneas descriptivas para tabla habilitada", () => {
    const r = getDedupeRequirementsForTable("categories");
    expect(r.length).toBe(4);
    expect(r[0]).toContain("Check for duplicates");
    expect(r[1]).toContain("Source");
    expect(r[2]).toContain("Strict Mode");
    expect(r[3]).toContain("Description");
  });
});

describe("generateIndexVerificationSQL", () => {
  it("comentario inline cuando tabla no tiene dedupe", () => {
    const r = generateIndexVerificationSQL("trades");
    expect(r).toContain("No deduplication");
  });

  it("genera SQL SELECT con ILIKE para tabla habilitada", () => {
    const r = generateIndexVerificationSQL("categories");
    expect(r).toContain("SELECT");
    expect(r).toContain("FROM pg_indexes");
    expect(r).toContain("'categories'");
    expect(r).toContain("ILIKE");
  });
});

describe("generateDedupeDocumentation", () => {
  it("genera markdown con header + secciones por tabla", () => {
    const md = generateDedupeDocumentation();
    expect(md).toContain("# Deduplication Rules");
    expect(md).toContain("## Configuration");
    expect(md).toContain("### categories");
    expect(md).toContain("### accounts");
  });

  it("incluye Enabled/Source/Strict Mode/Fields por tabla", () => {
    const md = generateDedupeDocumentation();
    expect(md).toContain("**Enabled**:");
    expect(md).toContain("**Source**:");
    expect(md).toContain("**Strict Mode**:");
    expect(md).toContain("**Fields**:");
  });
});
