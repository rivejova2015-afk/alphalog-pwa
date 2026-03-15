import { type NextRequest, NextResponse } from "next/server";
import { proxy } from "./src/proxy";
import { applySecurityHeaders } from "./src/lib/security/headers";

export async function middleware(request: NextRequest) {
  const startMs = Date.now();
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

  const pathname = request.nextUrl.pathname;
  const isDashboard = pathname.startsWith("/dashboard");
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
    "/api/treasury/calendar-events",
  ];

  const isPublicApi = isApi && publicApiPrefixes.some((prefix) => pathname.startsWith(prefix));
  const requireAuth = (isDashboard || (isApi && !isPublicApi));

  const csrfCookie = request.cookies.get("al_csrf")?.value;
  const isMutating = ["POST", "PUT", "PATCH", "DELETE"].includes(request.method);
  const hasAuthHeader = Boolean(request.headers.get("authorization"));

  if (csrfCookie && isApi && isMutating && !isPublicApi && !hasAuthHeader) {
    const csrfHeader = request.headers.get("x-csrf-token");
    if (csrfHeader !== csrfCookie) {
      return NextResponse.json(
        { error: "CSRF token missing or invalid" },
        { status: 403 }
      );
    }
  }

  const response = await proxy(request, {
    requireAuth,
    redirectTo: "/auth",
    apiUnauthorized: isApi,
  });

  if (isApi) {
    const requestId = request.headers.get("x-request-id") || crypto.randomUUID();
    response.headers.set("x-request-id", requestId);
  }

  if (!csrfCookie) {
    response.cookies.set("al_csrf", crypto.randomUUID(), {
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

  // Apply security headers to all responses
  return applySecurityHeaders(response);
}

// Aplica middleware a todas las rutas excepto assets estáticos
export const config = {
  matcher: ["/((?!_next/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
