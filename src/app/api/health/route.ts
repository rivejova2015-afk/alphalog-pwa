import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

type HealthCheckStatus = "ok" | "degraded" | "error";

type HealthCheck = {
  status: HealthCheckStatus;
  message: string;
  latencyMs?: number;
  details?: string;
};

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
};

function summarizeStatus(checks: HealthCheck[]): HealthCheckStatus {
  if (checks.some((check) => check.status === "error")) return "error";
  if (checks.some((check) => check.status === "degraded")) return "degraded";
  return "ok";
}

function checkRuntimeEnv(): HealthCheck {
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ] as const;

  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    return {
      status: "error",
      message: "Missing required environment variables",
      details: missing.join(", "),
    };
  }

  const optionalWarnings: string[] = [];
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    optionalWarnings.push("SUPABASE_SERVICE_ROLE_KEY");
  }
  if (!process.env.SUPABASE_FUNCTIONS_BASE_URL) {
    optionalWarnings.push("SUPABASE_FUNCTIONS_BASE_URL");
  }
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    optionalWarnings.push("NEXT_PUBLIC_VAPID_PUBLIC_KEY");
  }
  if (!process.env.DATA_ENCRYPTION_KEY) {
    optionalWarnings.push("DATA_ENCRYPTION_KEY");
  }

  if (optionalWarnings.length > 0) {
    return {
      status: "degraded",
      message: "Optional integrations not fully configured",
      details: optionalWarnings.join(", "),
    };
  }

  return {
    status: "ok",
    message: "Runtime environment variables are configured",
  };
}

async function checkSupabaseReadiness(): Promise<HealthCheck> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      status: "degraded",
      message: "Supabase service-role readiness check skipped",
      details: "SUPABASE_SERVICE_ROLE_KEY is not configured",
    };
  }

  const startedAt = Date.now();
  try {
    const supabase = createServiceClient();
    const { error } = await supabase
      .from("bots")
      .select("id", { head: true, count: "exact" })
      .limit(1);

    if (error) {
      return {
        status: "error",
        message: "Supabase connectivity check failed",
        latencyMs: Date.now() - startedAt,
        details: `${error.code ?? "unknown"}: ${error.message}`,
      };
    }

    return {
      status: "ok",
      message: "Supabase connectivity check passed",
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      status: "error",
      message: "Supabase health check crashed",
      latencyMs: Date.now() - startedAt,
      details: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

function checkBotRemoteConfig(): HealthCheck {
  const hasFunctionsBaseUrl = Boolean(process.env.SUPABASE_FUNCTIONS_BASE_URL);
  if (!hasFunctionsBaseUrl) {
    return {
      status: "degraded",
      message: "Bot remote base URL is not configured",
      details: "SUPABASE_FUNCTIONS_BASE_URL missing",
    };
  }

  return {
    status: "ok",
    message: "Bot remote base URL configured",
  };
}

export async function GET() {
  const runtime = checkRuntimeEnv();
  const supabase = await checkSupabaseReadiness();
  const botRemote = checkBotRemoteConfig();

  const checks = [runtime, supabase, botRemote];
  const status = summarizeStatus(checks);
  const ok = status !== "error";

  return NextResponse.json(
    {
      ok,
      status,
      ts: Date.now(),
      checks: {
        runtime,
        supabase,
        botRemote,
      },
    },
    {
      status: ok ? 200 : 503,
      headers: NO_STORE_HEADERS,
    }
  );
}
