import { type NextRequest, NextResponse } from "next/server";
import { proxy } from "./src/proxy";
import { applySecurityHeaders } from "./src/lib/security/headers";
import { triggerSecurityAlert } from "./src/lib/security/securityAlert";

// Module-level constant to avoid re-allocation on every request
const HONEYPOT_PATHS = [
  "/api/v1/admin",
  "/api/debug",
  "/wp-admin",
  "/wp-login.php",
  "/admin/config",
];

export async function middleware(request: NextRequest) {
  const startMs = Date.now();
  const pathname = request.nextUrl.pathname;
  const isHoneypot = HONEYPOT_PATHS.some((hp) => pathname === hp || pathname.startsWith(hp + "/"));
  if (isHoneypot) {
    const ipHint = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    // Trigger security alert (fire-and-forget)
    triggerSecurityAlert("honeypot_hit", { ip: ipHint, path: pathname }).catch(() => {});
    // Return 404 to avoid revealing the honeypot
    return new NextResponse("Not Found", { status: 404 });
  }

  // Canonical domain redirect (production only)
  try {
    const host = request.headers.get("host") || "";
    const canonical = process.env.NEXT_PUBLIC_CANONICAL_HOST || 'alphalog.io';
    const isProd = process.env.VERCEL_ENV === "production";
    const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1") || /^10\./.test(host);

    if (isProd && canonical && !isLocal) {
      // Redirect www.* to apex canonical host
      if (host !== canonical && host.startsWith("www.")) {
        const url = new URL(request.url);
        url.hostname = canonical;
        url.protocol = "https:";
        return NextResponse.redirect(url, 308);
      }
    }
  } catch {
    // Fail open: do not block requests if redirect logic errors
  }

  const isDashboard = pathname.startsWith("/dashboard") || pathname.startsWith("/map");
  const isApi = pathname.startsWith("/api");

  const publicApiPrefixes = [
    "/api/health",
    "/api/webhooks/mt5",
    "/api/inbound/email",
    "/api/cron/",
    "/api/auth/refresh",
    "/api/auth/logout",
    "/api/auth/device/verify",
    "/api/push/notify-user",
    "/api/outbound/email/send",
    "/api/treasury/export",
  ];

  const isPublicApi = isApi && publicApiPrefixes.some((prefix) => pathname.startsWith(prefix));
  const requireAuth = (isDashboard || (isApi && !isPublicApi));

  const csrfCookie = request.cookies.get("al_csrf")?.value;
  const isMutating = ["POST", "PUT", "PATCH", "DELETE"].includes(request.method);
  const hasAuthHeader = Boolean(request.headers.get("authorization"));

  // Always resolve CSRF token: use existing cookie or generate new UUID
  const csrfToken = csrfCookie || crypto.randomUUID();

  // Always enforce CSRF on API mutations (unless machine-to-machine with auth header)
  if (isApi && isMutating && !isPublicApi && !hasAuthHeader) {
    const csrfHeader = request.headers.get("x-csrf-token");
    const csrfA = Buffer.from(csrfHeader || "");
    const csrfB = Buffer.from(csrfToken);
    const csrfValid = csrfA.length === csrfB.length && crypto.timingSafeEqual(csrfA, csrfB);
    if (!csrfValid) {
      const ipHint = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
      // Trigger security alert (fire-and-forget)
      triggerSecurityAlert("csrf_failure", { ip: ipHint, path: pathname });
      return NextResponse.json(
        { error: "CSRF token missing or invalid" },
        { status: 403 }
      );
    }
  }

  // Content-Type validation for API mutations (Level 9.1)
  if (isApi && isMutating && !isPublicApi) {
    const ct = request.headers.get("content-type") || "";
    const isJson = ct.includes("application/json");
    const isFormData = ct.includes("multipart/form-data") || ct.includes("application/x-www-form-urlencoded");
    if (!isJson && !isFormData) {
      return NextResponse.json({ error: "Invalid Content-Type" }, { status: 415 });
    }
  }

  const response = await proxy(request, {
    requireAuth,
    redirectTo: "/auth",
    apiUnauthorized: isApi,
  });

  // Generate nonce for CSP (one per request for XSS protection)
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  response.headers.set("x-nonce", nonce);

  if (isApi) {
    const requestId = request.headers.get("x-request-id") || crypto.randomUUID();
    response.headers.set("x-request-id", requestId);
  }

  if (!csrfCookie) {
    response.cookies.set("al_csrf", csrfToken, {
      path: "/",
      sameSite: "lax",
      secure: process.env.VERCEL_ENV === "production",
      httpOnly: false,
      maxAge: 60 * 60 * 24 * 7,
    });
  }

  // Track response time; log slow API requests (>2000ms)
  const latencyMs = Date.now() - startMs;
  response.headers.set('x-response-time', `${latencyMs}ms`);
  if (isApi && latencyMs > 2000) {
    console.warn(`[perf] slow request ${request.method} ${request.nextUrl.pathname} took ${latencyMs}ms`);
  }

  // Apply security headers to all responses (with nonce for CSP)
  return applySecurityHeaders(response, nonce);
}

// Aplica middleware a todas las rutas excepto assets estáticos
export const config = {
  matcher: ["/((?!_next/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
