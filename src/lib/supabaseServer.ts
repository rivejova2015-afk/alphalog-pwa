// Lazy-loading Supabase client to avoid environment variable evaluation at build time
// This file provides runtime-safe client creation for Node.js environments

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Create Supabase server client safely at runtime
 * Throws error if environment variables are not set (safe for build-time failure handling)
 */
export function createSupabaseClientBasic() {
  // Check env vars exist at runtime (not build time)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing Supabase configuration: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  // This function will be called at runtime, so cookies() is safe
  return createServerClientSync(supabaseUrl, supabaseKey);
}

/**
 * Synchronous version for use in try/catch blocks where async isn't available
 * (In practice, this still needs cookies() but returns immediately)
 */
function createServerClientSync(url: string, key: string) {
  // For API routes that don't use cookies, we create a minimal client
  const { createClient } = require("@supabase/supabase-js");
  
  return createClient(url, key);
}

/**
 * Alternative: Create server client with cookies (for Server Components, middleware)
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing Supabase configuration: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookies) {
        cookies.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });
}
