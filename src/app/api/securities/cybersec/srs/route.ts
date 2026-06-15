import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";
import { newCard, review, type SrsCard } from "@/lib/securities/cybersec";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Spaced-repetition state lives in securities_user_state.srs (jsonb map keyed by
// item id, e.g. "fc:12" for flashcard 12).
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data } = await supabase
      .from("securities_user_state")
      .select("srs")
      .eq("user_id", user.id)
      .maybeSingle();

    return NextResponse.json({ srs: (data?.srs ?? {}) as Record<string, SrsCard> });
  } catch (err) {
    logError("Securities", { component: "GET srs", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

const postSchema = z.object({
  item_id: z.string().min(1).max(64),
  grade: z.enum(["again", "good", "easy"]),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const parsed = postSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

    const { data: row } = await supabase
      .from("securities_user_state")
      .select("srs")
      .eq("user_id", user.id)
      .maybeSingle();

    const map = ((row?.srs ?? {}) as Record<string, SrsCard>);
    const card = map[parsed.data.item_id] ?? newCard();
    const reviewed = review(card, parsed.data.grade);
    map[parsed.data.item_id] = reviewed;

    const { error } = await supabase
      .from("securities_user_state")
      .upsert({ user_id: user.id, srs: map, updated_at: new Date().toISOString() }, { onConflict: "user_id" });

    if (error) {
      logError("Securities", { component: "POST srs", message: error.message });
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }
    return NextResponse.json({ card: reviewed });
  } catch (err) {
    logError("Securities", { component: "POST srs", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
