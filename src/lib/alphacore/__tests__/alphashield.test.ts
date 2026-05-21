import { describe, it, expect, beforeEach } from "vitest";
import {
  safeModeManager,
  getSafeModeBadge,
  clearSafeModeErrors,
  getTopBugs,
  getFormattedErrorLog,
  isSafeModeActive,
  getSafeModeTimeRemaining,
  getErrorExplanation,
  getSuggestedAction,
} from "../alphashield";

describe("SafeModeManager", () => {
  beforeEach(() => {
    safeModeManager.clearErrors();
  });

  it("estado inicial: enabled=false, errorCount=0", () => {
    const s = safeModeManager.getState();
    expect(s.enabled).toBe(false);
    expect(s.errorCount).toBe(0);
    expect(s.errors).toEqual([]);
  });

  it("addError incrementa contador y guarda el error", () => {
    safeModeManager.addError({
      code: "23505", message: "duplicate", table: "trades",
      timestamp: Date.now(), mutationId: "m1",
    });
    const s = safeModeManager.getState();
    expect(s.errorCount).toBe(1);
    expect(s.errors).toHaveLength(1);
  });

  it("3+ errores en 60s → Safe Mode enabled", () => {
    const now = Date.now();
    for (let i = 0; i < 3; i++) {
      safeModeManager.addError({
        code: "23505", message: "duplicate", table: "trades",
        timestamp: now, mutationId: `m${i}`,
      });
    }
    expect(safeModeManager.getState().enabled).toBe(true);
  });

  it("clearErrors resetea estado completamente", () => {
    for (let i = 0; i < 5; i++) {
      safeModeManager.addError({
        code: "x", message: "y", table: "z",
        timestamp: Date.now(), mutationId: String(i),
      });
    }
    safeModeManager.clearErrors();
    const s = safeModeManager.getState();
    expect(s.enabled).toBe(false);
    expect(s.errorCount).toBe(0);
  });
});

describe("getSafeModeBadge", () => {
  beforeEach(() => safeModeManager.clearErrors());

  it("retorna message 'Nominal' cuando estado sano", () => {
    const b = getSafeModeBadge();
    expect(b.enabled).toBe(false);
    expect(b.message).toContain("Nominal");
  });

  it("retorna message 'Safe Mode ACTIVE' tras 3+ errores", () => {
    const now = Date.now();
    for (let i = 0; i < 3; i++) {
      safeModeManager.addError({ code: "x", message: "y", table: "z", timestamp: now, mutationId: String(i) });
    }
    const b = getSafeModeBadge();
    expect(b.enabled).toBe(true);
    expect(b.message).toContain("Safe Mode ACTIVE");
  });
});

describe("clearSafeModeErrors", () => {
  it("limpia los errores acumulados", () => {
    safeModeManager.addError({ code: "x", message: "y", table: "z", timestamp: Date.now(), mutationId: "m1" });
    clearSafeModeErrors();
    expect(safeModeManager.getState().errorCount).toBe(0);
  });
});

describe("getTopBugs", () => {
  beforeEach(() => safeModeManager.clearErrors());

  it("retorna [] cuando no hay errores", () => {
    expect(getTopBugs()).toEqual([]);
  });

  it("agrupa por code y ordena por count desc", () => {
    const now = Date.now();
    // 3 del code A, 1 del code B
    for (let i = 0; i < 3; i++) {
      safeModeManager.addError({ code: "A", message: "errA", table: "t", timestamp: now, mutationId: `a${i}` });
    }
    safeModeManager.addError({ code: "B", message: "errB", table: "t", timestamp: now, mutationId: "b1" });
    const top = getTopBugs(5);
    expect(top[0].code).toBe("A");
    expect(top[0].count).toBe(3);
    expect(top[1].code).toBe("B");
    expect(top[1].count).toBe(1);
  });

  it("respeta el limit parameter", () => {
    const now = Date.now();
    for (let i = 0; i < 10; i++) {
      safeModeManager.addError({ code: `C${i}`, message: "", table: "t", timestamp: now, mutationId: String(i) });
    }
    expect(getTopBugs(3)).toHaveLength(3);
  });

  it("lastOccurred es Date instance", () => {
    safeModeManager.addError({ code: "X", message: "", table: "t", timestamp: Date.now(), mutationId: "1" });
    const top = getTopBugs();
    expect(top[0].lastOccurred).toBeInstanceOf(Date);
  });
});

describe("getFormattedErrorLog", () => {
  beforeEach(() => safeModeManager.clearErrors());

  it("[] cuando no hay errores", () => {
    expect(getFormattedErrorLog()).toEqual([]);
  });

  it("retorna formato {timestamp, code, message, table, id}", () => {
    safeModeManager.addError({
      code: "23505", message: "dup", table: "accounts",
      timestamp: Date.now(), mutationId: "abc",
    });
    const log = getFormattedErrorLog();
    expect(log[0]).toMatchObject({
      code: "23505",
      message: "dup",
      table: "accounts",
      id: "abc",
    });
    expect(log[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("isSafeModeActive / getSafeModeTimeRemaining", () => {
  beforeEach(() => safeModeManager.clearErrors());

  it("isSafeModeActive=false cuando no hay errores", () => {
    expect(isSafeModeActive()).toBe(false);
  });

  it("getSafeModeTimeRemaining=0 cuando no activo", () => {
    expect(getSafeModeTimeRemaining()).toBe(0);
  });

  it("isSafeModeActive=true tras safe mode trigger", () => {
    const now = Date.now();
    for (let i = 0; i < 3; i++) {
      safeModeManager.addError({ code: "x", message: "y", table: "z", timestamp: now, mutationId: String(i) });
    }
    expect(isSafeModeActive()).toBe(true);
    expect(getSafeModeTimeRemaining()).toBeGreaterThan(0);
    expect(getSafeModeTimeRemaining()).toBeLessThanOrEqual(60);
  });
});

describe("getErrorExplanation", () => {
  it("retorna mensaje para códigos Postgres conocidos", () => {
    expect(getErrorExplanation("23505")).toContain("already exists");
    expect(getErrorExplanation("23503")).toContain("not found");
    expect(getErrorExplanation("23514")).toContain("format");
    expect(getErrorExplanation("23502")).toContain("required");
  });

  it("códigos de network/auth", () => {
    expect(getErrorExplanation("NETWORK_ERROR")).toContain("connect");
    expect(getErrorExplanation("TIMEOUT")).toContain("too long");
    expect(getErrorExplanation("AUTH_ERROR")).toContain("Authentication");
  });

  it("código desconocido → mensaje genérico", () => {
    expect(getErrorExplanation("ZZZ_UNKNOWN")).toContain("unexpected");
  });
});

describe("getSuggestedAction", () => {
  it("23505 incluye table en el contexto si se provee", () => {
    expect(getSuggestedAction("23505", { table: "accounts" })).toContain("accounts");
  });

  it("23505 sin context usa 'the system'", () => {
    expect(getSuggestedAction("23505")).toContain("the system");
  });

  it("23514 incluye field si se provee", () => {
    expect(getSuggestedAction("23514", { field: "email" })).toContain("email");
  });

  it("códigos de red/timeout/auth tienen acciones fijas", () => {
    expect(getSuggestedAction("NETWORK_ERROR")).toContain("internet");
    expect(getSuggestedAction("TIMEOUT")).toContain("again");
    expect(getSuggestedAction("AUTH_ERROR")).toContain("log out");
  });
});
