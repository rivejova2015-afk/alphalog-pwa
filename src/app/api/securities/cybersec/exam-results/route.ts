import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  score: z.number().int().min(0),
  total: z.number().int().min(1),
  answers: z.array(z.number().int()).optional(),
});

// GET /api/securities/cybersec/exam-results
// Returns historical attempts (most recent first, max 20).
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("securities_exam_results")
      .select("id, attempt_no, score, total, passed, taken_at")
      .eq("user_id", user.id)
      .order("taken_at", { ascending: false })
      .limit(20);

    if (error) {
      logError("Securities", { component: "GET /api/securities/cybersec/exam-results", message: error.message });
      return NextResponse.json({ error: "Failed to fetch exam results" }, { status: 500 });
    }
    return NextResponse.json({ results: data ?? [] });
  } catch (err) {
    logError("Securities", { component: "GET /api/securities/cybersec/exam-results", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/securities/cybersec/exam-results
// Records a new attempt. attempt_no is computed server-side as max+1.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
    if (parsed.data.score > parsed.data.total) {
      return NextResponse.json({ error: "score exceeds total" }, { status: 400 });
    }

    const { data: priorAttempt } = await supabase
      .from("securities_exam_results")
      .select("attempt_no")
      .eq("user_id", user.id)
      .order("attempt_no", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextAttempt = (priorAttempt?.attempt_no ?? 0) + 1;

    const { data, error } = await supabase
      .from("securities_exam_results")
      .insert({
        user_id: user.id,
        attempt_no: nextAttempt,
        score: parsed.data.score,
        total: parsed.data.total,
        answers: parsed.data.answers ?? [],
      })
      .select()
      .single();

    if (error || !data) {
      logError("Securities", { component: "POST /api/securities/cybersec/exam-results", message: error?.message ?? "no data" });
      return NextResponse.json({ error: "Insert failed" }, { status: 500 });
    }
    return NextResponse.json({ result: data });
  } catch (err) {
    logError("Securities", { component: "POST /api/securities/cybersec/exam-results", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
