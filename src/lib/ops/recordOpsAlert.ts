import { createServiceClient } from "@/lib/supabase/server";
import { logWarn } from "@/lib/log";

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
      logWarn("OpsAlert", "insert failed", { component: "ops.recordOpsAlert.insert", error: error.message });
      return false;
    }
    return true;
  } catch (err) {
    logWarn("OpsAlert", "unexpected", { component: "ops.recordOpsAlert.unexpected", error: err instanceof Error ? err.message : String(err) });
    return false;
  }
}
