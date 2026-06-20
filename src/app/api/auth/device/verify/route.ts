import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { logError, logWarn } from "@/lib/log";
import { logAuditFromRequest } from "@/lib/security/auditLog";

const hashFingerprint = (value: string) =>
  crypto.createHash("sha256").update(value, "utf8").digest("hex");

const getIpHint = (request: Request) => {
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

export async function POST(request: Request) {
  try {
    // Rate limit by IP: 10 requests per minute
    const ipHint = getIpHint(request);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseServiceKey) {
      try {
        const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey, {
          auth: { persistSession: false },
        });

        const minuteWindow = new Date(Math.floor(Date.now() / 60000) * 60000).toISOString();
        const rateKey = `device-verify-ip:${ipHint}`;

        const { data: rateData } = await serviceClient.rpc("increment_api_rate_limit", {
          p_key: rateKey,
          p_window_start: minuteWindow,
        });

        const hits = typeof rateData === "number" ? rateData : 0;
        if (hits > 10) {
          return NextResponse.json(
            { error: "Rate limit exceeded" },
            { status: 429, headers: { "Retry-After": "60" } }
          );
        }
      } catch (rateLimitError) {
        // Fail open on rate limit error
        logWarn("DeviceVerify", "Rate limit check failed", { component: "auth.device.verify.rateLimit", error: rateLimitError instanceof Error ? rateLimitError.message : String(rateLimitError) });
      }
    }

    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // SECURITY (audit 2026-06, Área 13) + lockout-safety: if the user has a
    // verified second factor, never trust a device on the password session
    // alone — require a completed AAL2 this session (TOTP or Supabase WebAuthn/
    // Face ID both upgrade to aal2). If the user has NO factor enrolled yet,
    // allow device trust (no worse than before this change) so they are not
    // locked out; the app nudges them to enable 2FA instead.
    const { data: factorsData } = await supabase.auth.mfa.listFactors();
    const hasVerifiedMfa = (factorsData?.all ?? []).some((f) => f.status === "verified");
    if (hasVerifiedMfa) {
      const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalError || aal?.currentLevel !== "aal2") {
        return NextResponse.json({ error: "mfa_required" }, { status: 403 });
      }
    }

    const userAgent = request.headers.get("user-agent") || "";
    // Must match the fingerprint logic in proxy.ts (userAgent only, no IP)
    const fingerprintHash = hashFingerprint(userAgent);

    const { data, error } = await supabase
      .from("auth_device_sessions")
      .upsert({
        user_id: userData.user.id,
        fingerprint_hash: fingerprintHash,
        user_agent: userAgent,
        ip_hint: ipHint,
        trusted: true,
        last_seen: new Date().toISOString(),
      }, { onConflict: "user_id,fingerprint_hash" })
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST205") {
        return NextResponse.json(
          { error: "Device sessions table missing" },
          { status: 503 }
        );
      }
      logError("Device Verify", { component: "auth.device.verify", message: "Upsert error:", error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json({ error: "Failed to verify device" }, { status: 500 });
    }

    await logAuditFromRequest(
      {
        userId: userData.user.id,
        action: "device_trust",
        resourceType: "device_session",
        resourceId: data?.id,
        status: "success",
      },
      request
    );

    return NextResponse.json({ ok: true, device: data });
  } catch (error) {
    logError("Device Verify", { component: "auth.device.verify", message: "Error:", error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
