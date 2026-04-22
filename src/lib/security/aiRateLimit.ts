/**
 * AI endpoint rate limiting helper.
 *
 * Enforces 3 requests per hour per user per endpoint to prevent cost abuse
 * (AI API calls can cost $0.01–$1.00+ each).
 */

import { createClient } from "@supabase/supabase-js";

/**
 * Check if an AI endpoint call is allowed under the rate limit.
 *
 * @param userId - Authenticated user's UUID
 * @param endpointKey - Unique identifier for the endpoint (e.g., 'ai-reports', 'ai-evidence')
 * @returns { allowed, retryAfterSeconds }
 */
export async function checkAiRateLimit(
  userId: string,
  endpointKey: string
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  try {
    // Initialize service-role Supabase client for rate limit increment
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      // Fail open: if service client unavailable, allow the request
      console.warn("[aiRateLimit] Supabase service key missing, allowing request");
      return { allowed: true };
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Compute 1-hour window (rounded to the hour)
    const now = new Date();
    const windowStart = new Date(Math.floor(now.getTime() / 3_600_000) * 3_600_000);
    const windowStartStr = windowStart.toISOString();

    // Build rate limit key: separate limit per endpoint
    const rateLimitKey = `ai-limit:${endpointKey}:${userId}`;

    // Call the increment_api_rate_limit RPC
    const { data, error } = await supabase.rpc("increment_api_rate_limit", {
      p_key: rateLimitKey,
      p_window_start: windowStartStr,
      p_limit: 3, // 3 requests per hour
    });

    if (error) {
      console.warn(`[aiRateLimit] RPC error for ${endpointKey}:`, error.message);
      // Fail open on RPC error
      return { allowed: true };
    }

    const hits = (data as { hits: number })?.hits ?? 0;

    if (hits > 3) {
      // Rate limit exceeded, calculate retry-after
      const nextHourMs = Math.ceil(now.getTime() / 3_600_000) * 3_600_000;
      const retryAfterSeconds = Math.ceil((nextHourMs - now.getTime()) / 1000);

      return {
        allowed: false,
        retryAfterSeconds: Math.min(retryAfterSeconds, 3600), // Cap at 1 hour
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error("[aiRateLimit] Unexpected error:", error);
    // Fail open on any exception
    return { allowed: true };
  }
}
