import { describe, it, expect } from "vitest";
import {
  MODULE_REGISTRY,
  getModule,
  getModuleTables,
  getSubsection,
  findModuleForTable,
} from "../moduleRegistry";

describe("MODULE_REGISTRY catalog", () => {
  it("incluye los 7 módulos esperados (logs, terminal, tradehub, journal, tradermap, treasury, business)", () => {
    const expected = ["logs", "terminal", "tradehub", "journal", "tradermap", "treasury", "business"];
    for (const m of expected) {
      expect(MODULE_REGISTRY[m as keyof typeof MODULE_REGISTRY]).toBeDefined();
    }
  });

  it("cada módulo tiene name, displayName, route, hasSubsections, tables", () => {
    for (const [, def] of Object.entries(MODULE_REGISTRY)) {
      expect(typeof def.name).toBe("string");
      expect(typeof def.displayName).toBe("string");
      expect(def.route).toMatch(/^\/dashboard\//);
      expect(typeof def.hasSubsections).toBe("boolean");
      expect(Array.isArray(def.tables)).toBe(true);
      expect(def.tables.length).toBeGreaterThan(0);
    }
  });

  it("hasSubsections=true implica subsections array poblado", () => {
    for (const [, def] of Object.entries(MODULE_REGISTRY)) {
      if (def.hasSubsections) {
        expect(def.subsections).toBeDefined();
        expect((def.subsections ?? []).length).toBeGreaterThan(0);
      }
    }
  });

  it("tradehub tiene 5 subsections (accounts, newTradesLog, evidenceVault, playbook, reports)", () => {
    expect(MODULE_REGISTRY.tradehub.subsections).toHaveLength(5);
    const names = MODULE_REGISTRY.tradehub.subsections?.map((s) => s.name);
    expect(names).toContain("accounts");
    expect(names).toContain("reports");
  });

  it("treasury tiene 8 subsections", () => {
    expect(MODULE_REGISTRY.treasury.subsections?.length).toBe(8);
  });

  it("business tiene 8 subsections", () => {
    expect(MODULE_REGISTRY.business.subsections?.length).toBe(8);
  });
});

describe("getModule", () => {
  it("retorna la definición correcta", () => {
    expect(getModule("logs").name).toBe("logs");
    expect(getModule("tradehub").displayName).toBe("TradeHub");
  });
});

describe("getModuleTables", () => {
  it("retorna las tables de un módulo simple", () => {
    expect(getModuleTables("logs")).toContain("categories");
    expect(getModuleTables("logs")).toContain("tags");
  });

  it("incluye todas las tables principales del módulo", () => {
    expect(getModuleTables("tradehub")).toContain("trades");
    expect(getModuleTables("tradehub")).toContain("setups");
    expect(getModuleTables("treasury")).toContain("treasury_wallets");
  });
});

describe("getSubsection", () => {
  it("retorna la subsection correcta", () => {
    const r = getSubsection("tradehub", "accounts");
    expect(r).toBeDefined();
    expect(r?.displayName).toBe("Accounts");
  });

  it("retorna undefined cuando la subsection no existe", () => {
    expect(getSubsection("tradehub", "nonexistent" as never)).toBeUndefined();
  });

  it("retorna undefined cuando el módulo no tiene subsections", () => {
    expect(getSubsection("logs", "any" as never)).toBeUndefined();
  });

  it("subsection tiene tables array", () => {
    const r = getSubsection("treasury", "cashflow");
    expect(r?.tables).toContain("treasury_transactions");
  });
});

describe("findModuleForTable", () => {
  it("encuentra 'tradehub' para 'trades'", () => {
    expect(findModuleForTable("trades")).toBe("tradehub");
  });

  it("encuentra 'logs' para 'categories'", () => {
    expect(findModuleForTable("categories")).toBe("logs");
  });

  it("encuentra 'terminal' para 'terminal_news'", () => {
    expect(findModuleForTable("terminal_news")).toBe("terminal");
  });

  it("encuentra 'treasury' para 'treasury_wallets'", () => {
    expect(findModuleForTable("treasury_wallets")).toBe("treasury");
  });

  it("encuentra 'business' para 'business_costs'", () => {
    expect(findModuleForTable("business_costs")).toBe("business");
  });

  it("retorna null cuando la tabla no pertenece a ningún módulo", () => {
    expect(findModuleForTable("nonexistent_table")).toBeNull();
  });
});
