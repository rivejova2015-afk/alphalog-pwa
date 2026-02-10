import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import crypto from "crypto";

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
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userAgent = request.headers.get("user-agent") || "";
    const ipHint = getIpHint(request);
    const fingerprintSource = `${userAgent}|${ipHint}`;
    const fingerprintHash = hashFingerprint(fingerprintSource);

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
      console.error("[Device Verify] Upsert error:", error);
      return NextResponse.json({ error: "Failed to verify device" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, device: data });
  } catch (error) {
    console.error("[Device Verify] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
