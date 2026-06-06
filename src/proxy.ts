// src/proxy.ts
import { NextResponse, type NextRequest } from "next/server";
import { triggerSecurityAlert } from "@/lib/security/securityAlert";
import { logError, logInfo } from "@/lib/log";

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
  apiUnauthorized?: boolean;
};

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

const hashFingerprint = async (value: string) => {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
};

const getIpHint = (request: NextRequest) => {
  const raw = request.headers.get("x-forwarded-for") || "";
  const ip = raw.split(",")[0]?.trim() || "";

  if (!ip) return "";
  if (ip.includes(":")) {
    const parts = ip.split(":").filter(Boolean);
    return parts.slice(0, 4).join(":");
  }

  const segments = ip.split(".");
  if (segments.length >= 2) {
    return `${segments[0]}.${segments[1]}.0.0`;
  }

  return ip;
};

export async function proxy(request: NextRequest, options: ProxyOptions = {}) {
  const response = NextResponse.next();
  const pathname = request.nextUrl.pathname;
  const isApi = pathname.startsWith("/api");

  const rateLimitSkipPrefixes = [
    "/api/health",
    "/api/cron/",
    "/api/webhooks/mt5",
    "/api/inbound/email",
  ];

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
      // Track repeated auth failures per IP (Level 10.1)
      const failIp = getIpHint(request) || "unknown";
      const failKey = `auth-fail:${failIp}`;
      const supabaseUrl401 = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceKey401 = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (supabaseUrl401 && serviceKey401) {
        const svc401 = createServerClient(supabaseUrl401, serviceKey401, {
          cookies: { getAll: () => [], setAll: () => {} },
        });
        const fiveMinWindow = new Date(Math.floor(Date.now() / 300_000) * 300_000).toISOString();
        void Promise.resolve(svc401.rpc("increment_api_rate_limit", {
          p_key: failKey,
          p_window_start: fiveMinWindow,
        })).then(({ data: failHits }) => {
          if (typeof failHits === "number" && failHits > 5) {
            void triggerSecurityAlert("repeated_401", { ip: failIp, path: pathname });
          }
        }).catch(() => {});
      }

      if (options.apiUnauthorized) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const redirectPath = options.redirectTo ?? "/auth";
      const redirectUrl = new URL(redirectPath, request.url);
      redirectUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(redirectUrl);
    }

    if (options.requireAuth && data?.user) {
      const pathnameLower = pathname.toLowerCase();
      const skipStepUp =
        pathnameLower.startsWith("/auth") ||
        pathnameLower.startsWith("/api/auth/device/verify");

      if (!skipStepUp) {
        const userAgent = request.headers.get("user-agent") || "";
        const ipHint = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
        // Use only userAgent for fingerprint — IP excluded so mobile users
        // don't trigger step-up every time they switch WiFi↔cellular.
        const fingerprintHash = await hashFingerprint(userAgent);

        const { data: device, error: deviceError } = await supabase
          .from("auth_device_sessions")
          .select("id, trusted")
          .eq("user_id", data.user.id)
          .eq("fingerprint_hash", fingerprintHash)
          .maybeSingle();

        if (deviceError) {
          if (deviceError.code === "PGRST205") {
            return response;
          }
          logError("Proxy", { component: "proxy.deviceLookup", message: "Device lookup error", error: deviceError instanceof Error ? deviceError.message : String(deviceError) });
        } else if (!device) {
          await supabase.from("auth_device_sessions").insert({
            user_id: data.user.id,
            fingerprint_hash: fingerprintHash,
            user_agent: userAgent,
            ip_hint: ipHint,
            trusted: false,
            last_seen: new Date().toISOString(),
          });

          if (options.apiUnauthorized) {
            return NextResponse.json({ error: "step_up_required" }, { status: 401 });
          }

          const stepupUrl = new URL("/auth", request.url);
          stepupUrl.searchParams.set("stepup", "1");
          stepupUrl.searchParams.set("next", pathname);
          return NextResponse.redirect(stepupUrl);
        } else if (!device.trusted) {
          if (options.apiUnauthorized) {
            return NextResponse.json({ error: "step_up_required" }, { status: 401 });
          }

          const stepupUrl = new URL("/auth", request.url);
          stepupUrl.searchParams.set("stepup", "1");
          stepupUrl.searchParams.set("next", pathname);
          return NextResponse.redirect(stepupUrl);
        } else {
          await supabase
            .from("auth_device_sessions")
            .update({ last_seen: new Date().toISOString() })
            .eq("id", device.id);
        }
      }
    }

    if (isApi && !rateLimitSkipPrefixes.some((prefix) => pathname.startsWith(prefix))) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (supabaseUrl && serviceKey) {
        const serviceClient = createServerClient(supabaseUrl, serviceKey, {
          cookies: {
            getAll: () => [],
            setAll: () => {},
          },
        });

        const windowSeconds = Number(process.env.RATE_LIMIT_WINDOW_SECONDS || 60);
        const maxHits = Number(process.env.RATE_LIMIT_MAX || 120);
        const windowMs = Math.max(10, windowSeconds) * 1000;
        const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs).toISOString();
        const ipHint = getIpHint(request) || "unknown";
        const rateKey = data?.user?.id ? `user:${data.user.id}` : `ip:${ipHint}`;

        // Level 9.4 — IP ban check (set by honeypot or repeated 401 handler)
        const banKey = `banned-ip:${ipHint}`;
        const { data: banRow } = await serviceClient
          .from("api_rate_limits")
          .select("hits")
          .eq("key", banKey)
          .maybeSingle();
        if (banRow && banRow.hits > 0) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { data: hits, error: rateError } = await serviceClient
          .rpc("increment_api_rate_limit", {
            p_key: rateKey,
            p_window_start: windowStart,
          });

        if (!rateError && typeof hits === "number" && hits > maxHits) {
          return NextResponse.json(
            { error: "Rate limit exceeded" },
            { status: 429 }
          );
        }

        // Level 10.2 — Scraping detector: >50 GETs in 30s from unauthenticated IP
        if (!data?.user && request.method === "GET") {
          const scrapeWindow = new Date(Math.floor(Date.now() / 30_000) * 30_000).toISOString();
          const { data: scrapeHits } = await serviceClient.rpc("increment_api_rate_limit", {
            p_key: `scrape:${ipHint}`,
            p_window_start: scrapeWindow,
          });
          if (typeof scrapeHits === "number" && scrapeHits > 50) {
            void triggerSecurityAlert("scraping_detected", { ip: ipHint, path: pathname });
            return NextResponse.json({ error: "Too many requests" }, { status: 429 });
          }
        }
      }
    }

    // Additional rate limiting for export endpoints (stricter)
    if (isApi && pathname.includes("/export") && data?.user) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (supabaseUrl && serviceKey) {
        const serviceClient = createServerClient(supabaseUrl, serviceKey, {
          cookies: {
            getAll: () => [],
            setAll: () => {},
          },
        });

        // Stricter limits for exports: 3 per minute, 20 per hour
        const minuteWindow = new Date(Math.floor(Date.now() / 60000) * 60000).toISOString();
        const hourWindow = new Date(Math.floor(Date.now() / 3600000) * 3600000).toISOString();

        const exportMinKey = `export-min:${data.user.id}`;
        const exportHourKey = `export-hour:${data.user.id}`;

        const { data: minuteHits } = await serviceClient.rpc("increment_api_rate_limit", {
          p_key: exportMinKey,
          p_window_start: minuteWindow,
        });

        const { data: hourHits } = await serviceClient.rpc("increment_api_rate_limit", {
          p_key: exportHourKey,
          p_window_start: hourWindow,
        });

        if (typeof minuteHits === "number" && minuteHits > 3) {
          return NextResponse.json(
            { error: "Export rate limit exceeded (3 per minute)" },
            { status: 429 }
          );
        }

        if (typeof hourHits === "number" && hourHits > 20) {
          return NextResponse.json(
            { error: "Export rate limit exceeded (20 per hour)" },
            { status: 429 }
          );
        }
      }
    }
  } catch (error) {
    // Log but don't fail: auth is optional for public routes
    logInfo("Proxy", "Auth check failed (optional)", { component: "proxy.auth.optional", error: error instanceof Error ? error.message : String(error) });
  }

  return response;
}

