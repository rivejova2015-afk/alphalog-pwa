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
