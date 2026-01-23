// src/proxy.ts
import { NextResponse, type NextRequest } from "next/server";

/**
 * Lightweight proxy for middleware
 * Defers Supabase client creation to runtime (lazy eval)
 * Prevents build-time environment variable evaluation
 */
export async function proxy(request: NextRequest) {
  const response = NextResponse.next();

  try {
    // Lazy import to prevent build-time env evaluation
    const { createClientForAPIRoute } = await import("@/lib/supabase/server");
    const supabase = createClientForAPIRoute();

    // Refresh/validate session (if exists) and update cookies
    await supabase.auth.getUser();
  } catch (error) {
    // Log but don't fail: auth is optional for public routes
    console.debug("Proxy auth check failed (optional):", error);
  }

  return response;
}

// Avoid running proxy on static assets
export const config = {
  matcher: ["/((?!_next/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};

