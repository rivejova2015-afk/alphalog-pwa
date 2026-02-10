import crypto from "crypto";

export type BugSeverity = "low" | "medium" | "high" | "critical";

export interface BugTriageInput {
  status?: number | null;
  path?: string | null;
  errorMessage?: string | null;
  errorStack?: string | null;
}

export interface BugTriageResult {
  category: string;
  severity: BugSeverity;
  fingerprint: string;
  suggestion: string;
}

const toLower = (value?: string | null) => (value || "").toLowerCase();

const severityFromStatus = (status?: number | null): BugSeverity => {
  if (!status) return "medium";
  if (status >= 500) return status >= 503 ? "critical" : "high";
  if (status === 429) return "medium";
  if (status === 401 || status === 403) return "medium";
  if (status >= 400) return "low";
  return "low";
};

const categoryFromSignals = (input: BugTriageInput): string => {
  const message = toLower(input.errorMessage);
  const stack = toLower(input.errorStack);
  const path = toLower(input.path);

  if (message.includes("validation") || message.includes("invalid")) return "validation";
  if (message.includes("unauthorized") || message.includes("forbidden") || input.status === 401 || input.status === 403) return "auth";
  if (input.status === 429 || message.includes("rate limit")) return "rate_limit";
  if (message.includes("encryption") || message.includes("decrypt") || message.includes("cipher")) return "encryption";
  if (message.includes("postmark") || message.includes("edge function") || message.includes("fetch") || message.includes("network")) return "external_service";
  if (message.includes("supabase") || message.includes("pgrst") || message.includes("database") || stack.includes("supabase")) return "database";
  if (path.includes("/api/treasury")) return "treasury";
  if (path.includes("/api/tradehub")) return "tradehub";
  if (path.includes("/api/journal")) return "journal";
  return "unknown";
};

const suggestionFromCategory = (category: string): string => {
  switch (category) {
    case "validation":
      return "Review payload schema and client-side validation.";
    case "auth":
      return "Verify session handling and auth headers.";
    case "rate_limit":
      return "Adjust rate limits or add backoff in client.";
    case "encryption":
      return "Ensure DATA_ENCRYPTION_KEY is configured.";
    case "external_service":
      return "Check upstream service availability and retries.";
    case "database":
      return "Inspect database errors and RLS policies.";
    case "treasury":
      return "Verify treasury queries and date ranges.";
    case "tradehub":
      return "Review trade queries and related account data.";
    case "journal":
      return "Inspect journal payload and encryption settings.";
    default:
      return "Inspect server logs for root cause.";
  }
};

const computeFingerprint = (input: BugTriageInput, category: string, severity: BugSeverity) => {
  const message = toLower(input.errorMessage || "unknown");
  const path = toLower(input.path || "unknown");
  const status = input.status ? String(input.status) : "unknown";

  const raw = `${category}|${severity}|${status}|${path}|${message}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
};

export const classifyBug = (input: BugTriageInput): BugTriageResult => {
  const category = categoryFromSignals(input);
  const severity = severityFromStatus(input.status);
  const fingerprint = computeFingerprint(input, category, severity);
  const suggestion = suggestionFromCategory(category);

  return { category, severity, fingerprint, suggestion };
};
