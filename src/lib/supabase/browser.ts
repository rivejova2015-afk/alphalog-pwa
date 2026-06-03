import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: "pkce", // IMPORTANTE: Fuerza PKCE en lugar de implicit flow
      },
    }
  );
}

// Singleton variant that returns null if env vars are unset (used by PWA
// update manager which may run before client hydration completes).
let singletonClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  if (!singletonClient) singletonClient = createBrowserClient(url, anonKey);
  return singletonClient;
}
