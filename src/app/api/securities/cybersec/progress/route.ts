import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";
import { mergeCompletedLevels } from "@/lib/securities/cybersec";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const upsertSchema = z.object({
  module_id: z.number().int().min(1).max(1000),
  status: z.enum(["locked", "active", "completed"]).optional(),
  completed_levels: z.array(z.enum(["b", "i", "a"])).optional(),
  research_done: z.boolean().optional(),
  // Merge aditivo: agrega un nivel a completed_levels sin pisar los existentes.
  // Lo usa el quiz al aprobar para marcar el progreso del módulo.
  add_completed_level: z.enum(["b", "i", "a"]).optional(),
});

// GET /api/securities/cybersec/progress
// Returns: { [module_id]: { status, completed_levels, research_done } }
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("securities_progress")
      .select("module_id, status, completed_levels, research_done")
      .eq("user_id", user.id);

    if (error) {
      logError("Securities", { component: "GET /api/securities/cybersec/progress", message: error.message });
      return NextResponse.json({ error: "Failed to fetch progress" }, { status: 500 });
    }

    const map: Record<number, { module_id: number; status: string; completed_levels: string[]; research_done: boolean }> = {};
    for (const row of data ?? []) {
      map[row.module_id] = {
        module_id: row.module_id,
        status: row.status,
        completed_levels: row.completed_levels ?? [],
        research_done: row.research_done ?? false,
      };
    }
    return NextResponse.json(map, {
      headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=60" },
    });
  } catch (err) {
    logError("Securities", { component: "GET /api/securities/cybersec/progress", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/securities/cybersec/progress
// Upserts a single module's state.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const parsed = upsertSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

    const payload: Record<string, unknown> = {
      user_id: user.id,
      module_id: parsed.data.module_id,
      updated_at: new Date().toISOString(),
    };
    if (parsed.data.status !== undefined) payload.status = parsed.data.status;
    if (parsed.data.completed_levels !== undefined) payload.completed_levels = parsed.data.completed_levels;
    if (parsed.data.research_done !== undefined) payload.research_done = parsed.data.research_done;

    // Merge aditivo de un nivel (quiz aprobado): leer la fila actual, unir el nivel
    // y asegurar que el módulo quede al menos 'active'. No pisa lo ya marcado a mano.
    if (parsed.data.add_completed_level !== undefined) {
      const { data: current } = await supabase
        .from("securities_progress")
        .select("completed_levels, status")
        .eq("user_id", user.id)
        .eq("module_id", parsed.data.module_id)
        .maybeSingle();

      const base = (parsed.data.completed_levels ?? current?.completed_levels ?? []) as string[];
      payload.completed_levels = mergeCompletedLevels(base, parsed.data.add_completed_level);
      if (payload.status === undefined && (current?.status ?? "locked") === "locked") {
        payload.status = "active";
      }
    }

    const { data, error } = await supabase
      .from("securities_progress")
      .upsert(payload, { onConflict: "user_id,module_id" })
      .select()
      .single();

    if (error || !data) {
      logError("Securities", { component: "POST /api/securities/cybersec/progress", message: error?.message ?? "no data" });
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }
    return NextResponse.json({ progress: data });
  } catch (err) {
    logError("Securities", { component: "POST /api/securities/cybersec/progress", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
