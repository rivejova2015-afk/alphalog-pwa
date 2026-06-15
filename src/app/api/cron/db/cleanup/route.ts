// Daily DB cleanup cron — keeps Supabase tables from growing unbounded and
// hitting the project size quota. Triggered by Sprint L after discovering
// api_rate_limits had 165k+ rows and was the main quota consumer.
//
// Retention policy per table:
//   api_rate_limits      → 2 hours  (only the rolling window matters)
//   app_logs             → 30 days  (observability dredge)
//   app_update_events    → 30 days  (SW update analytics)
//   cme_signals          → 90 days  (executed/skipped/rejected only — keep
//                                    pending for the dispatcher to retry)
//
// Each table is purged in its own try/catch so one failure doesn't halt the
// rest. Auth: same x-cron-secret pattern as the other crons.

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { logError, logInfo } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface CleanupTarget {
  table:       string;
  cutoffISO:   string;
  /** Column whose timestamp is compared against cutoff. */
  column:      string;
  /** Optional extra filter (eq pairs) — only delete rows matching ALL. */
  extraEq?:    Array<[string, string]>;
  /** Optional .in() filter (col, values). */
  extraIn?:    [string, string[]];
}

function authorize(req: NextRequest): boolean {
  const sent = req.headers.get("x-cron-secret");
  const expected = process.env.CRON_SECRET;
  if (!sent || !expected) return false;
  try {
    const a = Buffer.from(sent);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

async function purge(
  svc: ReturnType<typeof createServiceClient>,
  target: CleanupTarget,
): Promise<{ table: string; deleted: number; error?: string }> {
  try {
    // Count first so we can report.
    let countQ = svc.from(target.table).select("*", { count: "exact", head: true }).lt(target.column, target.cutoffISO);
    if (target.extraEq) for (const [c, v] of target.extraEq) countQ = countQ.eq(c, v);
    if (target.extraIn) countQ = countQ.in(target.extraIn[0], target.extraIn[1]);
    const { count, error: countErr } = await countQ;
    if (countErr) return { table: target.table, deleted: 0, error: `count: ${countErr.message}` };

    if ((count ?? 0) === 0) return { table: target.table, deleted: 0 };

    let delQ = svc.from(target.table).delete().lt(target.column, target.cutoffISO);
    if (target.extraEq) for (const [c, v] of target.extraEq) delQ = delQ.eq(c, v);
    if (target.extraIn) delQ = delQ.in(target.extraIn[0], target.extraIn[1]);
    const { error: delErr } = await delQ;
    if (delErr) return { table: target.table, deleted: 0, error: `delete: ${delErr.message}` };

    return { table: target.table, deleted: count ?? 0 };
  } catch (err) {
    return { table: target.table, deleted: 0, error: err instanceof Error ? err.message : String(err) };
  }
}

async function handler(request: NextRequest) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const svc = createServiceClient();

  const targets: CleanupTarget[] = [
    // Rolling rate-limit window — anything older than 2h is dead weight.
    { table: "api_rate_limits", column: "window_start", cutoffISO: hoursAgo(2) },

    // Observability tables — 30/30 day rolling buffers.
    { table: "app_logs",          column: "created_at", cutoffISO: daysAgo(30) },
    { table: "app_update_events", column: "created_at", cutoffISO: daysAgo(30) },

    // CME signals: only purge terminal states. Keep 'pending' indefinitely so
    // the dispatcher can retry them if needed.
    {
      table: "cme_signals",
      column: "created_at",
      cutoffISO: daysAgo(90),
      extraIn: ["status", ["executed", "skipped", "rejected"]],
    },
  ];

  const results: Array<{ table: string; deleted: number; error?: string }> = [];
  for (const t of targets) {
    results.push(await purge(svc, t));
  }

  const totalDeleted = results.reduce((s, r) => s + r.deleted, 0);
  const totalErrors  = results.filter((r) => r.error).length;
  const durationMs   = Date.now() - startedAt;

  logInfo("DbCleanup", `deleted=${totalDeleted} errors=${totalErrors} in ${durationMs}ms`, {
    component: "db/cleanup",
    meta: { results },
  });

  if (totalErrors > 0) {
    logError("DbCleanup", { component: "summary", message: "partial failure", meta: { results } });
  }

  return NextResponse.json({
    ok:           totalErrors === 0,
    total_deleted: totalDeleted,
    duration_ms:  durationMs,
    results,
  }, { status: 200, headers: { "Cache-Control": "private, no-store" } });
}

export const GET = handler;
export const POST = handler;
