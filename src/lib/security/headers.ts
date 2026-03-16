// src/lib/security/headers.ts
import { NextResponse } from "next/server";

/**
 * Security headers for HTTP responses
 * Protects against XSS, clickjacking, MIME type sniffing, etc.
 */

export const SECURITY_HEADERS: Record<string, string> = {
  // Enforce HTTPS for all future requests (1 year, includeSubdomains)
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",

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
 */
export function getCSPHeader(): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://alphalog.io";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

  // Directives
  const directives = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      "'unsafe-inline'", // Required for Next.js
      "'unsafe-eval'", // Required for Next.js dev
      "https://cdn.jsdelivr.net", // Allow CDN scripts
      "https://js.hcaptcha.com", // hCaptcha
      "https://newassets.hcaptcha.com", // hCaptcha assets
    ],
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
      "https://api.openai.com", // OpenAI API
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
 */
export function applySecurityHeaders(response: NextResponse): NextResponse {
  // Apply standard security headers
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // Apply CSP header
  response.headers.set("Content-Security-Policy", getCSPHeader());

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
