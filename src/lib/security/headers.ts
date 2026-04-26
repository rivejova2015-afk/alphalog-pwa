// src/lib/security/headers.ts
import { NextResponse } from "next/server";

/**
 * Security headers for HTTP responses
 * Protects against XSS, clickjacking, MIME type sniffing, etc.
 */

export const SECURITY_HEADERS: Record<string, string> = {
  // Enforce HTTPS for all future requests (2 years for HSTS preload list)
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",

  // Prevent MIME type sniffing
  "X-Content-Type-Options": "nosniff",

  // Prevent clickjacking attacks
  "X-Frame-Options": "DENY",

  // Enable XSS protection (legacy, but still good for older browsers)
  "X-XSS-Protection": "1; mode=block",

  // Control referrer information
  "Referrer-Policy": "strict-origin-when-cross-origin",

  // Limit browser features and permissions
  "Permissions-Policy": [
    "accelerometer=()",
    "ambient-light-sensor=()",
    "autoplay=()",
    "battery=()",
    "camera=()",
    "display-capture=()",
    "document-domain=()",
    "encrypted-media=()",
    "execution-while-not-rendered=()",
    "execution-while-out-of-viewport=()",
    "fullscreen=(self)",
    "geolocation=()",
    "gyroscope=()",
    "magnetometer=()",
    "microphone=()",
    "midi=()",
    "navigation-override=()",
    "payment=()",
    "picture-in-picture=()",
    "publickey-credentials-get=()",
    "sync-script=()",
    "usb=()",
    "wake-lock=()",
    "xr-spatial-tracking=()",
  ].join(", "),

  // Disable DNS prefetch (privacy)
  "X-DNS-Prefetch-Control": "off",

  // Prevent Google Translate
  "X-Google-No-Translate": "true",
};

/**
 * Content Security Policy header
 * Strict policy to prevent XSS and data injection
 * @param nonce Optional nonce for script-src; if provided, uses nonce-based CSP instead of unsafe-inline
 */
export function getCSPHeader(nonce?: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://alphalog.io";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

  // Build script-src directive
  // In nonce mode: use nonce + strict-dynamic. Explicit host allowlist is kept as fallback
  // for browsers that don't support strict-dynamic (they ignore the nonce and use the host list).
  const scriptSrc = nonce
    ? [
        "'self'",
        `'nonce-${nonce}'`, // Allow scripts with matching nonce
        "'strict-dynamic'", // Allow scripts dynamically loaded by nonced scripts
        // 'unsafe-eval' only in development (React DevTools, HMR)
        ...(process.env.NODE_ENV !== "production" ? ["'unsafe-eval'"] : []),
        // Fallback allowlist for browsers without strict-dynamic support
        "https://cdn.jsdelivr.net",
        "https://js.hcaptcha.com",
        "https://newassets.hcaptcha.com",
      ]
    : [
        "'self'",
        "'unsafe-inline'", // Fallback for static assets without nonce
        // 'unsafe-eval' only in development (React DevTools, HMR)
        ...(process.env.NODE_ENV !== "production" ? ["'unsafe-eval'"] : []),
        "https://cdn.jsdelivr.net",
        "https://js.hcaptcha.com",
        "https://newassets.hcaptcha.com",
      ];

  // Directives
  const directives = {
    "default-src": ["'self'"],
    "script-src": scriptSrc,
    "style-src": [
      "'self'",
      "'unsafe-inline'", // Required for Tailwind
    ],
    "img-src": ["'self'", "data:", "https:", "blob:"],
    "font-src": ["'self'", "data:", "https:"],
    "connect-src": [
      "'self'",
      baseUrl,
      supabaseUrl,
      "*.supabase.co",
      "https://api.openai.com", // OpenAI API (knowledge-factory)
      "https://api.anthropic.com", // Claude API (terminal reports)
      "https://api.postmarkapp.com", // Postmark
      "https://qstash.upstash.io", // QStash
      "https://hcaptcha.com", // hCaptcha
      "https://newassets.hcaptcha.com", // hCaptcha assets
    ],
    "media-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "frame-ancestors": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-src": [
      "https://newassets.hcaptcha.com", // hCaptcha widget iframe
    ],
    "worker-src": ["'self'", "blob:"],
    "child-src": ["'self'", "blob:"],
  };

  return Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(" ")}`)
    .join("; ");
}

/**
 * Apply security headers to a NextResponse
 * @param response The NextResponse to update
 * @param nonce Optional nonce for CSP; if provided, enables nonce-based CSP
 */
export function applySecurityHeaders(response: NextResponse, nonce?: string): NextResponse {
  // Apply standard security headers
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // Apply CSP header (with optional nonce)
  response.headers.set("Content-Security-Policy", getCSPHeader(nonce));

  // Remove powered-by header
  response.headers.delete("X-Powered-By");
  response.headers.delete("Server");

  return response;
}

/**
 * Apply security headers with custom overrides
 */
export function applySecurityHeadersWithOverrides(
  response: NextResponse,
  overrides?: Record<string, string>
): NextResponse {
  const result = applySecurityHeaders(response);

  if (overrides) {
    Object.entries(overrides).forEach(([key, value]) => {
      if (value === null || value === undefined || value === "") {
        result.headers.delete(key);
      } else {
        result.headers.set(key, value);
      }
    });
  }

  return result;
}
