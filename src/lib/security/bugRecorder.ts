import { createServerClient } from "@supabase/ssr";
import crypto from "crypto";
import { hashUserAgent } from "@/lib/security/auditLog";
import { classifyBug } from "@/lib/security/bugTriage";

export interface BugReportInput {
  userId?: string | null;
  requestId?: string | null;
  method?: string | null;
  path?: string | null;
  status?: number | null;
  error: unknown;
  errorMessage?: string | null;
  errorStack?: string | null;
  payload?: unknown;
  ipHint?: string | null;
  userAgent?: string | null;
}

const MAX_ERROR_MESSAGE = 1000;
const MAX_STACK = 4000;

const safeString = (value: unknown, max: number) => {
  if (!value) return null;
  const text = String(value);
  return text.length > max ? text.slice(0, max) : text;
};

const hashPayload = (payload: unknown): string | null => {
  if (payload === undefined) return null;
  try {
    const json = JSON.stringify(payload);
    return crypto.createHash("sha256").update(json).digest("hex");
  } catch {
    return null;
  }
};

const resolveError = (error: unknown) => {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack || null,
    };
  }

  return {
    message: typeof error === "string" ? error : "Unknown error",
    stack: null,
  };
};

export async function recordBugReport(input: BugReportInput): Promise<string | null> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      console.warn("[BugRecorder] Missing Supabase service credentials");
      return null;
    }

    const supabase = createServerClient(supabaseUrl, serviceKey, {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    });

    const resolved = resolveError(input.error);
    const payloadHash = hashPayload(input.payload);
    const userAgentHash = input.userAgent ? hashUserAgent(input.userAgent) : null;

    const { data, error } = await supabase.rpc("log_bug_report", {
      p_user_id: input.userId || null,
      p_request_id: input.requestId || null,
      p_method: input.method || null,
      p_path: input.path || null,
      p_status: input.status || null,
      p_error_message: safeString(input.errorMessage || resolved.message, MAX_ERROR_MESSAGE),
      p_error_stack: safeString(input.errorStack || resolved.stack, MAX_STACK),
      p_payload_hash: payloadHash,
      p_ip_hint: input.ipHint || null,
      p_user_agent_hash: userAgentHash,
    });

    if (error) {
      console.error("[BugRecorder] Failed to record bug:", error);
      return null;
    }

    const bugId = data as string;
    const triage = classifyBug({
      status: input.status || null,
      path: input.path || null,
      errorMessage: input.errorMessage || resolved.message,
      errorStack: input.errorStack || resolved.stack,
    });

    const { error: triageError } = await supabase.rpc("log_bug_triage", {
      p_bug_report_id: bugId,
      p_category: triage.category,
      p_severity: triage.severity,
      p_fingerprint: triage.fingerprint,
      p_suggestion: triage.suggestion,
    });

    if (triageError) {
      console.warn("[BugRecorder] Failed to log triage:", triageError);
    }

    return bugId;
  } catch (err) {
    console.error("[BugRecorder] Unexpected error:", err);
    return null;
  }
}

export async function recordBugFromRequest(
  request: Request,
  input: Omit<BugReportInput, "method" | "path" | "userAgent" | "ipHint"> & { userId?: string | null }
): Promise<string | null> {
  const ipHint = request.headers.get("x-forwarded-for") || "unknown";
  const userAgent = request.headers.get("user-agent") || "";
  const requestId = request.headers.get("x-request-id") || null;

  return recordBugReport({
    ...input,
    method: request.method,
    path: new URL(request.url).pathname,
    ipHint,
    userAgent,
    requestId,
  });
}
