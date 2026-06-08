import { createClient } from "@supabase/supabase-js";
import { logError } from "@/lib/log";

export type ThreatType = "db_tampering" | "credential_compromise" | "data_breach";

/**
 * Automated incident response for critical security threats.
 * Designed to be called from API routes or monitoring scripts.
 * All steps are fire-and-forget — the function never throws.
 */
export async function triggerIncidentResponse(threat: ThreatType): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://alphalog.io";
  const internalSecret = process.env.INTERNAL_API_SECRET;
  const ownerUserId = process.env.SECURITY_ALERT_USER_ID;

  const steps: string[] = [];

  try {
    if (supabaseUrl && serviceKey) {
      const admin = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false },
      });

      // 1. Log the incident to app_logs immediately
      await admin.from("app_logs").insert({
        user_id: ownerUserId ?? null,
        level: "error",
        area: "incident_response",
        message: `[INCIDENT] ${threat} detected — automated response triggered`,
        meta: { threat, triggered_at: new Date().toISOString() },
        fingerprint: `incident:${threat}:${Date.now()}`,
      });
      steps.push("logged");

      // 2. Revoke all auth sessions (forces re-login on all devices)
      if (threat === "credential_compromise" || threat === "data_breach") {
        if (ownerUserId) {
          await admin.auth.admin.signOut(ownerUserId, "global");
          steps.push("sessions_revoked");
        }
      }

      // 3. Insert a lockdown flag into api_rate_limits so the ban check in proxy blocks all IPs
      // This is a nuclear option — only for db_tampering or data_breach
      if (threat === "data_breach" || threat === "db_tampering") {
        await admin.from("api_rate_limits").upsert({
          key: "incident:lockdown",
          hits: 1,
          window_start: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: "key" });
        steps.push("lockdown_flag_set");
      }
    }

    // 4. Send critical push notification to owner
    if (internalSecret && ownerUserId) {
      const label = threat.replace(/_/g, " ").toUpperCase();
      await fetch(`${appUrl}/api/push/notify-user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${internalSecret}`,
        },
        body: JSON.stringify({
          userId: ownerUserId,
          title: `[CRITICAL] Security Incident: ${label}`,
          body: `Automated response triggered. Steps: ${steps.join(", ")}. Check app_logs immediately.`,
          tag: `incident-${threat}`,
          data: { type: "incident", threat, steps, timestamp: new Date().toISOString() },
        }),
      }).catch(() => {});
    }

    logError("IncidentResponse", { component: "security.incidentResponse.completed", message: `${threat} response completed`, payload: { steps } });
  } catch (err) {
    logError("IncidentResponse", { component: "security.incidentResponse.exception", message: "Exception during response", error: err instanceof Error ? err.message : String(err) });
  }
}
