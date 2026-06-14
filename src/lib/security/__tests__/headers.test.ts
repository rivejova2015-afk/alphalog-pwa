// Unit tests for src/lib/security/headers.ts.
//
// Pure helpers para security headers + CSP. Validates:
//   - SECURITY_HEADERS contains the canonical hardening set.
//   - getCSPHeader: nonce vs unsafe-inline modes; dev includes unsafe-eval.
//   - applySecurityHeaders: applies + removes X-Powered-By/Server.
//   - applySecurityHeadersWithOverrides: overrides individual keys and
//     supports removal via empty/null value.

import { describe, it, expect, vi } from "vitest";
import { NextResponse } from "next/server";
import { SECURITY_HEADERS, getCSPHeader, applySecurityHeaders, applySecurityHeadersWithOverrides } from "../headers";

describe("SECURITY_HEADERS constant", () => {
  it("includes HSTS + nosniff + DENY + xss-protection + referrer policies", () => {
    expect(SECURITY_HEADERS["Strict-Transport-Security"]).toMatch(/max-age=63072000.*includeSubDomains.*preload/);
    expect(SECURITY_HEADERS["X-Content-Type-Options"]).toBe("nosniff");
    expect(SECURITY_HEADERS["X-Frame-Options"]).toBe("DENY");
    expect(SECURITY_HEADERS["X-XSS-Protection"]).toBe("1; mode=block");
    expect(SECURITY_HEADERS["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  });

  it("Permissions-Policy deshabilita cameras, mic, geolocation, etc.", () => {
    const pp = SECURITY_HEADERS["Permissions-Policy"];
    for (const feature of ["camera", "microphone", "geolocation", "payment", "usb"]) {
      expect(pp).toContain(`${feature}=()`);
    }
  });

  it("X-DNS-Prefetch-Control disabled (privacy)", () => {
    expect(SECURITY_HEADERS["X-DNS-Prefetch-Control"]).toBe("off");
  });
});

describe("getCSPHeader", () => {
  it("default (sin nonce) usa 'unsafe-inline' en script-src", () => {
    const csp = getCSPHeader();
    expect(csp).toContain("'unsafe-inline'");
    expect(csp).not.toContain("'nonce-");
    expect(csp).not.toContain("'strict-dynamic'");
  });

  it("con nonce usa 'nonce-XYZ' + 'strict-dynamic' en lugar de unsafe-inline", () => {
    const csp = getCSPHeader("ABC123");
    expect(csp).toContain("'nonce-ABC123'");
    expect(csp).toContain("'strict-dynamic'");
  });

  it("script-src incluye cdn.jsdelivr.net + hcaptcha hosts", () => {
    const csp = getCSPHeader();
    expect(csp).toContain("https://cdn.jsdelivr.net");
    expect(csp).toContain("https://js.hcaptcha.com");
  });

  it("connect-src incluye Supabase + OpenAI + Anthropic + Postmark + QStash", () => {
    const csp = getCSPHeader();
    for (const host of [
      "*.supabase.co",
      "https://api.openai.com",
      "https://api.anthropic.com",
      "https://api.postmarkapp.com",
      "https://qstash.upstash.io",
    ]) {
      expect(csp).toContain(host);
    }
  });

  it("frame-ancestors='none' (no clickjacking)", () => {
    expect(getCSPHeader()).toMatch(/frame-ancestors\s+'none'/);
  });

  it("object-src='none' (no plugins)", () => {
    expect(getCSPHeader()).toMatch(/object-src\s+'none'/);
  });

  it("style-src incluye 'unsafe-inline' (requerido por Tailwind)", () => {
    expect(getCSPHeader()).toMatch(/style-src.*'unsafe-inline'/);
  });

  it("development mode incluye 'unsafe-eval' para React DevTools/HMR", () => {
    vi.stubEnv("NODE_ENV", "development");
    try {
      expect(getCSPHeader()).toContain("'unsafe-eval'");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("production mode NO incluye 'unsafe-eval'", () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      expect(getCSPHeader()).not.toContain("'unsafe-eval'");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("applySecurityHeaders", () => {
  it("aplica todos los SECURITY_HEADERS al response", () => {
    const res = applySecurityHeaders(NextResponse.json({ ok: true }));
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      expect(res.headers.get(key)).toBe(value);
    }
  });

  it("añade Content-Security-Policy header", () => {
    const res = applySecurityHeaders(NextResponse.json({}));
    const csp = res.headers.get("Content-Security-Policy");
    expect(csp).toBeTruthy();
    expect(csp).toContain("default-src 'self'");
  });

  it("respeta el nonce param al setear CSP", () => {
    const res = applySecurityHeaders(NextResponse.json({}), "XYZ-NONCE");
    expect(res.headers.get("Content-Security-Policy")).toContain("'nonce-XYZ-NONCE'");
  });

  it("elimina X-Powered-By y Server headers (defensive)", () => {
    const init = NextResponse.json({});
    init.headers.set("X-Powered-By", "Next.js");
    init.headers.set("Server", "vercel");
    const res = applySecurityHeaders(init);
    expect(res.headers.get("X-Powered-By")).toBeNull();
    expect(res.headers.get("Server")).toBeNull();
  });

  it("retorna el mismo NextResponse instance (mutación in-place)", () => {
    const original = NextResponse.json({});
    const result = applySecurityHeaders(original);
    expect(result).toBe(original);
  });
});

describe("applySecurityHeadersWithOverrides", () => {
  it("aplica base headers + overrides sobre keys específicas", () => {
    const res = applySecurityHeadersWithOverrides(
      NextResponse.json({}),
      { "X-Frame-Options": "SAMEORIGIN" },
    );
    expect(res.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");  // base preserved
  });

  it("override con string vacío → elimina el header", () => {
    const res = applySecurityHeadersWithOverrides(
      NextResponse.json({}),
      { "X-Frame-Options": "" },
    );
    expect(res.headers.get("X-Frame-Options")).toBeNull();
  });

  it("sin overrides → equivalente a applySecurityHeaders", () => {
    const res = applySecurityHeadersWithOverrides(NextResponse.json({}));
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});
