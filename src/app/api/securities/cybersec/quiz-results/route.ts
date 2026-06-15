import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  lesson_id: z.number().int().min(1).max(1000),
  score: z.number().int().min(0),
  total: z.number().int().min(1),
  answers: z.array(z.number().int()).optional(),
  level: z.enum(["b", "i", "a"]).optional(),
});

// GET /api/securities/cybersec/quiz-results?lesson_id=X
// If lesson_id provided → last attempts for that lesson. Else → last 50 across all lessons.
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const lessonIdRaw = request.nextUrl.searchParams.get("lesson_id");
    const levelRaw = request.nextUrl.searchParams.get("level");
    let q = supabase
      .from("securities_quiz_results")
      .select("id, lesson_id, score, total, taken_at, level")
      .eq("user_id", user.id)
      .order("taken_at", { ascending: false })
      .limit(50);

    if (lessonIdRaw) {
      const lessonId = Number.parseInt(lessonIdRaw, 10);
      if (!Number.isFinite(lessonId)) return NextResponse.json({ error: "Invalid lesson_id" }, { status: 400 });
      q = q.eq("lesson_id", lessonId);
    }
    if (levelRaw && ["b", "i", "a"].includes(levelRaw)) q = q.eq("level", levelRaw);

    const { data, error } = await q;
    if (error) {
      logError("Securities", { component: "GET /api/securities/cybersec/quiz-results", message: error.message });
      return NextResponse.json({ error: "Failed to fetch quiz results" }, { status: 500 });
    }
    return NextResponse.json({ results: data ?? [] });
  } catch (err) {
    logError("Securities", { component: "GET /api/securities/cybersec/quiz-results", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/securities/cybersec/quiz-results
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

    const { data, error } = await supabase
      .from("securities_quiz_results")
      .insert({
        user_id: user.id,
        lesson_id: parsed.data.lesson_id,
        score: parsed.data.score,
        total: parsed.data.total,
        answers: parsed.data.answers ?? [],
        level: parsed.data.level ?? "b",
      })
      .select()
      .single();

    if (error || !data) {
      logError("Securities", { component: "POST /api/securities/cybersec/quiz-results", message: error?.message ?? "no data" });
      return NextResponse.json({ error: "Insert failed" }, { status: 500 });
    }
    return NextResponse.json({ result: data });
  } catch (err) {
    logError("Securities", { component: "POST /api/securities/cybersec/quiz-results", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
