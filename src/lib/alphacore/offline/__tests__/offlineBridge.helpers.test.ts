// @vitest-environment jsdom
//
// Unit tests for pure helpers en src/lib/alphacore/offline/offlineBridge.ts:
//   - isOnline()  — lee navigator.onLine.
//   - isOffline() — negación de isOnline.
//   - hasSession() — busca token en localStorage o cookies.
//
// Validates:
//   1. isOnline: navigator.onLine=true → true.
//   2. isOnline: navigator.onLine=false → false.
//   3. isOffline: complemento de isOnline.
//   4. hasSession: localStorage.sb-auth-token presente → true.
//   5. hasSession: localStorage.auth-token presente → true.
//   6. hasSession: cookie supabase-auth presente → true.
//   7. hasSession: cookie auth-token presente → true.
//   8. hasSession: nada → false.
//   9. hasSession: localStorage + cookie ambos vacíos → false.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { isOnline, isOffline, hasSession } from "../offlineBridge";

function setNavigatorOnline(online: boolean) {
  Object.defineProperty(navigator, "onLine", {
    value: online,
    writable: true, configurable: true,
  });
}

function setCookie(value: string) {
  Object.defineProperty(document, "cookie", {
    value, writable: true, configurable: true,
  });
}

describe("isOnline / isOffline", () => {
  beforeEach(() => {
    setNavigatorOnline(true);
  });

  it("navigator.onLine=true → isOnline=true", () => {
    setNavigatorOnline(true);
    expect(isOnline()).toBe(true);
    expect(isOffline()).toBe(false);
  });

  it("navigator.onLine=false → isOnline=false", () => {
    setNavigatorOnline(false);
    expect(isOnline()).toBe(false);
    expect(isOffline()).toBe(true);
  });

  it("isOffline siempre es complemento estricto de isOnline", () => {
    setNavigatorOnline(true);
    expect(isOnline() && !isOffline()).toBe(true);
    setNavigatorOnline(false);
    expect(!isOnline() && isOffline()).toBe(true);
  });
});

describe("hasSession", () => {
  beforeEach(() => {
    setCookie("");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // localStorage in jsdom is read via Storage.prototype.getItem; assigning
  // localStorage.getItem on the instance doesn't override the prototype
  // lookup. Spy on the prototype instead.
  function mockLocalStorage(values: Record<string, string | null>) {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(
      (key: string) => values[key] ?? null
    );
  }

  it("localStorage.sb-auth-token presente → true", async () => {
    mockLocalStorage({ "sb-auth-token": "eyJxxx" });
    const result = await hasSession();
    expect(result).toBe(true);
  });

  it("localStorage.auth-token presente (fallback) → true", async () => {
    mockLocalStorage({ "auth-token": "legacy-token-here" });
    const result = await hasSession();
    expect(result).toBe(true);
  });

  it("cookie 'supabase-auth' presente → true", async () => {
    mockLocalStorage({});
    setCookie("supabase-auth-token=abc; other=x");
    const result = await hasSession();
    expect(result).toBe(true);
  });

  it("cookie 'auth-token' presente → true", async () => {
    mockLocalStorage({});
    setCookie("session=foo; auth-token=bar");
    const result = await hasSession();
    expect(result).toBe(true);
  });

  it("ningún token ni cookie → false", async () => {
    mockLocalStorage({});
    setCookie("");
    const result = await hasSession();
    expect(result).toBe(false);
  });

  it("localStorage vacío y cookie con keys irrelevantes → false", async () => {
    mockLocalStorage({});
    setCookie("user_pref=darkmode; other=value");
    const result = await hasSession();
    expect(result).toBe(false);
  });

  it("hasSession: token en localStorage tiene prioridad sobre cookie", async () => {
    // Both set: should still return true (short-circuits on first match).
    mockLocalStorage({ "sb-auth-token": "ls-token" });
    setCookie("supabase-auth=cookie-token");
    const result = await hasSession();
    expect(result).toBe(true);
  });
});
