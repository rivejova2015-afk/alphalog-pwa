// POST /api/bot/arbitrage/latency/run
//
// Ejecuta una iteración del monitor de latency arbitrage.
//
// Modos de invocación:
//   1. Cron (Bearer CRON_SECRET): itera todos los users con pairs enabled.
//   2. Usuario autenticado (cookies): itera sólo el user.
//
// Devuelve el array de IterationOutcome agregado por usuario.

import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { validateBearerToken } from "@/lib/security/timing";
import { runIteration, type IterationOutcome } from "@/lib/bot/arbitrage/pair-monitor";
import { logError, logInfo } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase service role credentials");
  return createServiceClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

interface UserOutcomes {
  user_id:  string;
  outcomes: IterationOutcome[];
}

export async function POST(request: NextRequest) {
  const cronAuth = validateBearerToken(
    request.headers.get("authorization"),
    process.env.CRON_SECRET,
    "CRON_SECRET",
  );

  // Cron path: iterate every user with at least one enabled pair.
  if (cronAuth.ok) {
    const sb = getServiceClient();
    const { data: pairs, error } = await sb
      .from("arbitrage_latency_pairs")
      .select("user_id")
      .eq("enabled", true);
    if (error) {
      logError("api.bot.arbitrage.latency.run", { message: "Failed to load enabled pairs", error: error.message });
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    const userIds = Array.from(new Set((pairs ?? []).map((p) => p.user_id as string)));
    const results: UserOutcomes[] = [];
    for (const userId of userIds) {
      try {
        const outcomes = await runIteration(sb, userId);
        results.push({ user_id: userId, outcomes });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logError("api.bot.arbitrage.latency.run", { message: `runIteration failed for ${userId}`, error: msg });
      }
    }
    logInfo("api.bot.arbitrage.latency.run", "cron iteration done", { users: userIds.length });
    return NextResponse.json({ ok: true, mode: "cron", users: results });
  }

  // Authenticated user path.
  const sb = await createServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  try {
    const outcomes = await runIteration(sb, user.id);
    return NextResponse.json({ ok: true, mode: "user", user_id: user.id, outcomes });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logError("api.bot.arbitrage.latency.run", { message: "runIteration failed", error: msg });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
