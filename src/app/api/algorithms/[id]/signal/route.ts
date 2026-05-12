// Engine signal endpoint — POLL surface for MT4/MT5 EAs.
//
// The EA hits this every few seconds asking "should I trade right now?".
// Phase-A stub: validates ownership + active deployment + status, returns
// {action: 'HOLD'} so the polling pipeline can be wired end-to-end before the
// real Base Engine v1 runtime (Multi-TF + OB/FVG + cascade) is implemented.
//
// Auth: same Supabase session as the rest of the algorithms surface. The EA
// will switch to a service token once the live execution loop ships (Phase B).

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";
import type { EngineConfig } from "@/lib/validations/engine-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const signalRequestSchema = z.object({
  bot_account_id: z.string().uuid().optional(),
  symbol:         z.string().min(1).max(20).optional(),
  current_bar:    z.object({
    ts:    z.string().min(1),
    open:  z.number(),
    high:  z.number(),
    low:   z.number(),
    close: z.number(),
  }).optional(),
});

type SignalAction = "BUY" | "SELL" | "HOLD";

interface SignalResponse {
  action:    SignalAction;
  reason:    string;
  algorithm: { id: string; name: string; status: string };
  engine:    { version: string; available_modules: string[]; available_overlays: string[] } | null;
}

function enabledList<T extends Record<string, { enabled: boolean }>>(group: T): string[] {
  return (Object.entries(group) as [string, { enabled: boolean }][])
    .filter(([, v]) => v.enabled)
    .map(([k]) => k);
}

// POST /api/algorithms/[id]/signal
export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: unknown = {};
    try { body = await request.json(); } catch { /* empty body allowed for stub */ }

    const parsed = signalRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
    }

    const { data: algo, error: algoErr } = await supabase
      .from("algorithms")
      .select("id, name, status, engine_config, instrument")
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (algoErr || !algo) {
      return NextResponse.json({ error: "Algorithm not found" }, { status: 404 });
    }

    const isLive = algo.status === "live" || algo.status === "running";
    if (!isLive) {
      const payload: SignalResponse = {
        action: "HOLD",
        reason: `algorithm_status:${algo.status}`,
        algorithm: { id: algo.id, name: algo.name, status: algo.status },
        engine: null,
      };
      return NextResponse.json(payload, { status: 200 });
    }

    const cfg = (algo.engine_config as EngineConfig | null);
    const engineInfo = cfg
      ? {
          version: cfg.base_engine?.engine_version ?? "1.0.0",
          available_modules:  enabledList(cfg.modules  ?? {}),
          available_overlays: enabledList(cfg.overlays ?? {}),
        }
      : null;

    const payload: SignalResponse = {
      action: "HOLD",
      reason: "engine_runtime_not_implemented_phase_a_stub",
      algorithm: { id: algo.id, name: algo.name, status: algo.status },
      engine: engineInfo,
    };

    return NextResponse.json(payload, {
      status: 200,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    logError("AlgorithmSignal", { component: "POST /api/algorithms/[id]/signal", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
