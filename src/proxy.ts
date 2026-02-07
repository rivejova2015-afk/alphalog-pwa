// src/proxy.ts
import { NextResponse, type NextRequest } from "next/server";

/**
 * Lightweight proxy for middleware
 * Defers Supabase client creation to runtime (lazy eval)
 * Prevents build-time environment variable evaluation
 * 
 * IMPORTANT: Middleware IS allowed to modify cookies via NextResponse.
 * This is where we safely handle auth session updates.
 */
type ProxyOptions = {
  requireAuth?: boolean;
  redirectTo?: string;
};

export async function proxy(request: NextRequest, options: ProxyOptions = {}) {
  const response = NextResponse.next();
  const pathname = request.nextUrl.pathname;

  try {
    // Lazy import to prevent build-time env evaluation
    const { createServerClient } = await import("@supabase/ssr");
    const { cookies: getCookies } = await import("next/headers");
    
    const cookieStore = await getCookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            // SAFE: Middleware CAN modify cookies via response object
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    // Validate/refresh session (this may update cookies)
    const { data, error } = await supabase.auth.getUser();

    if (options.requireAuth && (error || !data?.user)) {
      const redirectPath = options.redirectTo ?? "/auth";
      const redirectUrl = new URL(redirectPath, request.url);
      redirectUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(redirectUrl);
    }
  } catch (error) {
    // Log but don't fail: auth is optional for public routes
    console.debug("[Proxy] Auth check failed (optional):", error instanceof Error ? error.message : error);
  }

  return response;
}

