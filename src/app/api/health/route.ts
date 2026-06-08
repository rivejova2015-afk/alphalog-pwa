import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

type HealthCheckStatus = "ok" | "degraded" | "error";

type HealthCheck = {
  status: HealthCheckStatus;
  message: string;
  latencyMs?: number;
  details?: string;
};

type BotInstanceHealthRow = {
  instance_id: string | null;
  status: string | null;
  last_heartbeat_at: string | null;
  updated_at: string | null;
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
    // IMPORTANT: report this as `degraded` (HTTP 200 from caller), NOT `error`
    // (HTTP 503). Fly's health check polls /api/health every 30s and considers
    // the machine unhealthy on 503 — after the 5-minute grace window it aborts
    // the deploy. If a build happened without these secrets in the CI runner
    // environment, the bundle ships with `undefined` literals; we'd rather
    // surface that as a degraded badge than block the deploy entirely. The
    // body still names the missing variable(s) so the operator can fix it.
    return {
      status: "degraded",
      message: "Missing required environment variables",
      details: process.env.NODE_ENV === "production"
        ? `${missing.length} required variable(s) missing`
        : missing.join(", "),
    };
  }

  const optionalWarnings: string[] = [];
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    optionalWarnings.push("SUPABASE_SERVICE_ROLE_KEY");
  }
  if (!process.env.SUPABASE_FUNCTIONS_URL) {
    optionalWarnings.push("SUPABASE_FUNCTIONS_URL");
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
      details: process.env.NODE_ENV === "production"
        ? `${optionalWarnings.length} optional variable(s) missing`
        : optionalWarnings.join(", "),
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
  const hasFunctionsBaseUrl = Boolean(process.env.SUPABASE_FUNCTIONS_URL);
  if (!hasFunctionsBaseUrl) {
    return {
      status: "degraded",
      message: "Bot remote base URL is not configured",
      details: "SUPABASE_FUNCTIONS_URL missing",
    };
  }

  return {
    status: "ok",
    message: "Bot remote base URL configured",
  };
}

function parseHeartbeatThresholdSeconds() {
  const raw = process.env.BOT_HEARTBEAT_STALE_SECONDS;
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return 120;
  return Math.floor(parsed);
}

async function checkBotRuntime(): Promise<HealthCheck> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      status: "degraded",
      message: "Bot runtime check skipped",
      details: "SUPABASE_SERVICE_ROLE_KEY is not configured",
    };
  }

  const startedAt = Date.now();
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("bot_instances")
      .select("instance_id,status,last_heartbeat_at,updated_at")
      .order("updated_at", { ascending: false })
      .limit(200);

    if (error) {
      return {
        status: "error",
        message: "Bot runtime query failed",
        latencyMs: Date.now() - startedAt,
        details: `${error.code ?? "unknown"}: ${error.message}`,
      };
    }

    const instances = (data ?? []) as BotInstanceHealthRow[];
    const activeInstances = instances.filter((instance) => {
      const status = String(instance.status || "").toLowerCase();
      return status !== "offline";
    });

    if (activeInstances.length === 0) {
      return {
        status: "degraded",
        message: "No active bot instances found",
        latencyMs: Date.now() - startedAt,
      };
    }

    const thresholdSeconds = parseHeartbeatThresholdSeconds();
    const nowMs = Date.now();
    const withHeartbeat = activeInstances.filter((instance) => Boolean(instance.last_heartbeat_at));
    const stale = withHeartbeat.filter((instance) => {
      const hbMs = new Date(instance.last_heartbeat_at || "").getTime();
      if (!Number.isFinite(hbMs)) return true;
      return nowMs - hbMs > thresholdSeconds * 1000;
    });
    const missingHeartbeat = activeInstances.length - withHeartbeat.length;

    if (withHeartbeat.length === 0) {
      return {
        status: "degraded",
        message: "Active bot instances without heartbeat",
        latencyMs: Date.now() - startedAt,
        details: `active=${activeInstances.length}, threshold=${thresholdSeconds}s`,
      };
    }

    if (stale.length > 0 || missingHeartbeat > 0) {
      return {
        status: "degraded",
        message: "Bot heartbeat stale",
        latencyMs: Date.now() - startedAt,
        details: `active=${activeInstances.length}, stale=${stale.length}, missing=${missingHeartbeat}, threshold=${thresholdSeconds}s`,
      };
    }

    return {
      status: "ok",
      message: "Bot runtime heartbeat is fresh",
      latencyMs: Date.now() - startedAt,
      details: `active=${activeInstances.length}, threshold=${thresholdSeconds}s`,
    };
  } catch (error) {
    return {
      status: "error",
      message: "Bot runtime check crashed",
      latencyMs: Date.now() - startedAt,
      details: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function checkBotFunctionsReachability(): Promise<HealthCheck> {
  const base = process.env.SUPABASE_FUNCTIONS_URL;
  if (!base) {
    return {
      status: "degraded",
      message: "Bot functions reachability skipped",
      details: "SUPABASE_FUNCTIONS_URL missing",
    };
  }

  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${base.replace(/\/$/, "")}/bot-maintenance`, {
      method: "OPTIONS",
      signal: controller.signal,
    });

    if (response.status >= 500 || response.status === 404) {
      return {
        status: "error",
        message: "Bot functions endpoint unreachable",
        latencyMs: Date.now() - startedAt,
        details: `status=${response.status}`,
      };
    }

    return {
      status: "ok",
      message: "Bot functions endpoint reachable",
      latencyMs: Date.now() - startedAt,
      details: `status=${response.status}`,
    };
  } catch (error) {
    return {
      status: "error",
      message: "Bot functions reachability failed",
      latencyMs: Date.now() - startedAt,
      details: error instanceof Error ? error.message : "Unknown error",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function checkAppLogsWritable(): Promise<HealthCheck> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { status: "degraded", message: "app_logs check skipped (no service key)" };
  }
  const startedAt = Date.now();
  try {
    const supabase = createServiceClient();
    const { error } = await supabase
      .from("app_logs")
      .select("id", { head: true, count: "exact" })
      .limit(1);
    if (error) {
      return { status: "degraded", message: "app_logs table not reachable", latencyMs: Date.now() - startedAt, details: error.message };
    }
    return { status: "ok", message: "app_logs reachable", latencyMs: Date.now() - startedAt };
  } catch (error) {
    return { status: "degraded", message: "app_logs check failed", latencyMs: Date.now() - startedAt, details: error instanceof Error ? error.message : "Unknown" };
  }
}

async function checkCmeConnections(): Promise<HealthCheck> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { status: "ok", message: "CME check skipped (no service key)" };
  }
  const startedAt = Date.now();
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("cme_connections")
      .select("id, status")
      .limit(50);

    if (error) {
      return { status: "degraded", message: "CME connections query failed", latencyMs: Date.now() - startedAt, details: error.message };
    }

    const connections = data ?? [];
    if (connections.length === 0) {
      return { status: "ok", message: "No CME accounts connected", latencyMs: Date.now() - startedAt };
    }

    const errored = connections.filter((c: { id: string; status: string }) => c.status === "error");
    if (errored.length === connections.length) {
      return { status: "error", message: "All CME connections in error state", latencyMs: Date.now() - startedAt };
    }
    if (errored.length > 0) {
      return { status: "degraded", message: "Some CME connections in error state", latencyMs: Date.now() - startedAt, details: `${errored.length}/${connections.length} errored` };
    }

    return { status: "ok", message: `${connections.length} CME connection(s) healthy`, latencyMs: Date.now() - startedAt };
  } catch (error) {
    return { status: "degraded", message: "CME check failed", latencyMs: Date.now() - startedAt, details: error instanceof Error ? error.message : "Unknown" };
  }
}

export async function GET() {
  const isProduction = process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";

  const runtime = checkRuntimeEnv();
  const [supabase, botRuntime, botFunctions, appLogs, cme] = await Promise.all([
    checkSupabaseReadiness(),
    checkBotRuntime(),
    checkBotFunctionsReachability(),
    checkAppLogsWritable(),
    checkCmeConnections(),
  ]);
  const botRemote = checkBotRemoteConfig();

  const checks = [runtime, supabase, botRemote, botRuntime, botFunctions, appLogs, cme];
  const status = summarizeStatus(checks);
  const ok = status !== "error";

  if (isProduction) {
    return NextResponse.json(
      { ok, status },
      { status: ok ? 200 : 503, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(
    {
      ok,
      status,
      ts: Date.now(),
      checks: {
        runtime,
        supabase,
        botRemote,
        botRuntime,
        botFunctions,
        appLogs,
        cme,
      },
    },
    {
      status: ok ? 200 : 503,
      headers: NO_STORE_HEADERS,
    }
  );
}
