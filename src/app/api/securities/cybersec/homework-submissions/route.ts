import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const submitSchema = z.object({
  homework_id: z.number().int().min(1).max(1000),
  content: z.string().max(50000).optional(),
});

const updateSchema = z.object({
  homework_id: z.number().int().min(1).max(1000),
  status: z.enum(["pending", "submitted", "graded"]).optional(),
  points: z.number().int().min(0).max(1000).optional(),
  content: z.string().max(50000).optional(),
});

// GET /api/securities/cybersec/homework-submissions
// Returns: { [homework_id]: submission }
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("securities_homework_submissions")
      .select("homework_id, content, status, points, submitted_at, graded_at")
      .eq("user_id", user.id)
      .is("deleted_at", null);

    if (error) {
      logError("Securities", { component: "GET /api/securities/cybersec/homework-submissions", message: error.message });
      return NextResponse.json({ error: "Failed to fetch submissions" }, { status: 500 });
    }

    const map: Record<number, unknown> = {};
    for (const row of data ?? []) map[row.homework_id] = row;
    return NextResponse.json(map, {
      headers: { "Cache-Control": "private, max-age=20, stale-while-revalidate=60" },
    });
  } catch (err) {
    logError("Securities", { component: "GET /api/securities/cybersec/homework-submissions", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/securities/cybersec/homework-submissions
// Submit (or resubmit) a homework. Sets status='submitted', submitted_at=now().
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const parsed = submitSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("securities_homework_submissions")
      .upsert({
        user_id: user.id,
        homework_id: parsed.data.homework_id,
        content: parsed.data.content ?? "",
        status: "submitted",
        submitted_at: now,
        updated_at: now,
        deleted_at: null,
      }, { onConflict: "user_id,homework_id" })
      .select()
      .single();

    if (error || !data) {
      logError("Securities", { component: "POST /api/securities/cybersec/homework-submissions", message: error?.message ?? "no data" });
      return NextResponse.json({ error: "Submit failed" }, { status: 500 });
    }
    return NextResponse.json({ submission: data });
  } catch (err) {
    logError("Securities", { component: "POST /api/securities/cybersec/homework-submissions", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/securities/cybersec/homework-submissions
// Generic update: change status, content, or points (e.g., self-grading).
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (parsed.data.status !== undefined) payload.status = parsed.data.status;
    if (parsed.data.points !== undefined) payload.points = parsed.data.points;
    if (parsed.data.content !== undefined) payload.content = parsed.data.content;
    if (parsed.data.status === "graded") payload.graded_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("securities_homework_submissions")
      .update(payload)
      .eq("user_id", user.id)
      .eq("homework_id", parsed.data.homework_id)
      .is("deleted_at", null)
      .select()
      .single();

    if (error || !data) {
      logError("Securities", { component: "PUT /api/securities/cybersec/homework-submissions", message: error?.message ?? "no data" });
      return NextResponse.json({ error: "Update failed" }, { status: 404 });
    }
    return NextResponse.json({ submission: data });
  } catch (err) {
    logError("Securities", { component: "PUT /api/securities/cybersec/homework-submissions", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
