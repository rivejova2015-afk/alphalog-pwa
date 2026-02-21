// src/lib/security/auditLog.ts
import { createServerClient } from "@supabase/ssr";
import crypto from "crypto";

export type AuditAction =
  | "create"
  | "read"
  | "update"
  | "delete"
  | "export"
  | "import"
  | "download"
  | "upload"
  | "login"
  | "logout"
  | "stepup"
  | "device_trust"
  | "api_call"
  | "webhook"
  | "report_generate";

export type AuditResourceType =
  | "trade"
  | "account"
  | "journal"
  | "secure_mail"
  | "evidence"
  | "report"
  | "auth_session"
  | "device_session"
  | "goal"
  | "progress"
  | "export"
  | "webhook";

export type AuditStatus = "success" | "failure" | "partial";

export interface AuditLogEntry {
  userId: string;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId?: string;
  changes?: Record<string, unknown>;
  status?: AuditStatus;
  errorMessage?: string;
  ipHint?: string;
  userAgentHash?: string;
}

type SupabaseLikeError = {
  code?: string | null;
  message?: string | null;
};

const isMissingAuditRpc = (error: SupabaseLikeError | null | undefined): boolean => {
  if (!error) return false;
  if (error.code === "PGRST202" || error.code === "42883") return true;
  const message = (error.message || "").toLowerCase();
  return message.includes("log_audit_event") && message.includes("could not find");
};

/**
 * Hash user agent (SHA-256) to avoid storing full UA strings
 */
export const hashUserAgent = (userAgent: string): string => {
  return crypto.createHash("sha256").update(userAgent).digest("hex");
};

/**
 * Log an audit event to the database
 * Uses service role to bypass RLS
 */
export async function logAuditEvent(
  entry: AuditLogEntry
): Promise<string | null> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      console.warn("[Audit] Missing Supabase credentials for audit logging");
      return null;
    }

    const supabase = createServerClient(supabaseUrl, serviceKey, {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    });

    const { data, error } = await supabase.rpc("log_audit_event", {
      p_user_id: entry.userId,
      p_action: entry.action,
      p_resource_type: entry.resourceType,
      p_resource_id: entry.resourceId || null,
      p_changes: entry.changes || null,
      p_ip_hint: entry.ipHint || null,
      p_user_agent_hash: entry.userAgentHash || null,
      p_status: entry.status || "success",
      p_error_message: entry.errorMessage || null,
    });

    if (error) {
      if (isMissingAuditRpc(error)) {
        const fallbackPayload = {
          user_id: entry.userId,
          action: entry.action,
          resource_type: entry.resourceType,
          resource_id: entry.resourceId || null,
          changes: entry.changes || null,
          ip_hint: entry.ipHint || null,
          user_agent_hash: entry.userAgentHash || null,
          status: entry.status || "success",
          error_message: entry.errorMessage || null,
        };

        const { data: fallbackData, error: fallbackError } = await supabase
          .from("audit_logs")
          .insert(fallbackPayload)
          .select("id")
          .single();

        if (fallbackError) {
          // Final fallback for environments without audit_logs migrations.
          const fingerprint = crypto
            .createHash("sha256")
            .update(
              `${entry.userId}|${entry.action}|${entry.resourceType}|${
                entry.resourceId || ""
              }|${entry.status || "success"}`
            )
            .digest("hex");

          const { data: appLogData, error: appLogError } = await supabase
            .from("app_logs")
            .insert({
              user_id: entry.userId,
              level: entry.status === "failure" ? "error" : "info",
              area: "security_audit",
              message: `Audit event (${entry.action}) persisted via fallback`,
              meta: fallbackPayload,
              fingerprint,
            })
            .select("id")
            .single();

          if (appLogError) {
            console.error(
              "[Audit] RPC missing and all fallback inserts failed:",
              appLogError
            );
            return null;
          }

          return (appLogData?.id as string | undefined) ?? null;
        }

        return (fallbackData?.id as string | undefined) ?? null;
      }

      console.error("[Audit] Failed to log event:", error);
      return null;
    }

    return data as string;
  } catch (err) {
    console.error("[Audit] Exception logging event:", err);
    return null;
  }
}

/**
 * Log audit event from API request context
 * Extracts user, IP, user agent from request/auth
 */
export async function logAuditFromRequest(
  entry: Omit<AuditLogEntry, "ipHint" | "userAgentHash"> & {
    ipHint?: string;
    userAgentHash?: string;
  },
  request?: Request
): Promise<string | null> {
  let ipHint = entry.ipHint;
  let userAgentHash = entry.userAgentHash;

  if (request) {
    if (!ipHint) {
      const raw = request.headers.get("x-forwarded-for") || "";
      ipHint = raw.split(",")[0]?.trim() || "unknown";
    }

    if (!userAgentHash) {
      const userAgent = request.headers.get("user-agent") || "";
      if (userAgent) {
        userAgentHash = hashUserAgent(userAgent);
      }
    }
  }

  return logAuditEvent({
    ...entry,
    ipHint: ipHint || undefined,
    userAgentHash: userAgentHash || undefined,
  });
}
