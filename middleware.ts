import { type NextRequest, NextResponse } from "next/server";
import { proxy } from "./src/proxy";

export async function middleware(request: NextRequest) {
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

  const isProtected = request.nextUrl.pathname.startsWith("/dashboard");
  return proxy(request, { requireAuth: isProtected, redirectTo: "/auth" });
}

// Aplica middleware a todas las rutas excepto assets estáticos
export const config = {
  matcher: ["/((?!_next/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
