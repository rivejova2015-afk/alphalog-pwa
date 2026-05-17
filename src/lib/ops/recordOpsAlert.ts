import { createServiceClient } from "@/lib/supabase/server";

export type OpsAlertSeverity = "info" | "warning" | "error" | "critical";

export interface OpsAlertInput {
  jobName: string;
  severity: OpsAlertSeverity;
  message: string;
  metadata?: Record<string, unknown>;
}

// Idempotent best-effort writer for cron job alerts. Never throws — if Supabase
// is down or the table is missing, the caller (a cron job) shouldn't fail.
// Returns true on success, false on any error (already logged).
export async function recordOpsAlert(input: OpsAlertInput): Promise<boolean> {
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("ops_alert_history").insert({
      job_name: input.jobName,
      severity: input.severity,
      message: input.message,
      metadata: input.metadata ?? {},
    });
    if (error) {
      console.warn("[recordOpsAlert] insert failed:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[recordOpsAlert] unexpected:", err);
    return false;
  }
}
