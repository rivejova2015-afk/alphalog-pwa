import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // IMPORTANT: In Server Components, we CANNOT set cookies during render.
          // This function is called by Supabase when handling auth responses.
          // Setting cookies here would cause: "Cookies can only be modified in a Server Action or Route Handler"
          // 
          // Solutions:
          // 1. In Route Handlers (API routes): Safe to call cookieStore.set()
          // 2. In Middleware: Safe to use response.cookies.set()
          // 3. In Server Components: NOT safe during render - cookies are read-only
          //
          // For auth session updates, use:
          // - POST /api/auth/refresh to update auth cookies
          // - Or rely on middleware.ts which has safe cookie modification
          
          try {
            // Try to set cookies, but fail gracefully if we're in a Server Component render
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch (error: unknown) {
            // If we get "Cookies can only be modified in a Server Action or Route Handler",
            // it means we're in a Server Component render - this is expected and safe to ignore
            // because middleware will handle cookie updates on the next request
            const errorMessage = error instanceof Error ? error.message : undefined;
            const errorDigest = (error as { digest?: string } | null)?.digest;
            if (
              errorMessage?.includes('Cookies can only be modified') ||
              errorDigest?.includes('NEXT_DYNAMIC_ASYNC_CLIENT_COMPONENT')
            ) {
              console.debug('[Supabase] Cookie set deferred to middleware/route handler');
              // Silently continue - middleware or a Route Handler will update cookies
            } else {
              // For other errors, log but don't fail
              console.error('[Supabase] Cookie set error:', errorMessage || error);
            }
          }
        },
      },
    }
  );
}

/**
 * Lazy-loaded Supabase client for API routes (no cookies needed)
 * SAFE for build-time: Only reads env vars when called at runtime
 * Use in API route handlers with dynamic imports to prevent build-time evaluation
 *
 * Usage:
 *   const { createClientForAPIRoute } = await import('@/lib/supabase/server');
 *   const supabase = createClientForAPIRoute();
 */
export function createClientForAPIRoute() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing Supabase configuration. Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set."
    );
  }

  // Import createClient dynamically to prevent static analysis during build
  const { createClient: createSupabaseClient } = require("@supabase/supabase-js");
  return createSupabaseClient(supabaseUrl, supabaseKey);
}

/**
 * Supabase service-role client (server-side only)
 * Use for trusted server operations (replication, snapshots, admin tasks)
 */
export function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      "Missing Supabase service role configuration. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set."
    );
  }

  const { createClient: createSupabaseClient } = require("@supabase/supabase-js");
  return createSupabaseClient(supabaseUrl, serviceKey);
}
