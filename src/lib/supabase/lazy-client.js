/**
 * Lazy Supabase client loader for API routes
 * Uses CommonJS require to prevent static analysis during build
 * 
 * This file is .js (not .ts) intentionally to prevent TypeScript analysis
 * during Turbopack build phase
 */

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing Supabase configuration: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY not set"
    );
  }

  // Use require to prevent static bundler analysis
  const { createClient } = require("@supabase/supabase-js");
  return createClient(supabaseUrl, supabaseKey);
}

module.exports = { getSupabaseClient };
