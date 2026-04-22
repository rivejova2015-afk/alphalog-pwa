import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/bot/skills/list
// Returns all skills and recent audit log entries for the current user
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch skills
    const { data: skills, error: skillsErr } = await supabase
      .from("bot_skills")
      .select("*")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (skillsErr) {
      throw new Error(`Failed to fetch skills: ${skillsErr.message}`);
    }

    // Fetch audit log
    const { data: auditLog, error: auditErr } = await supabase
      .from("bot_skill_audit_log")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (auditErr) {
      logError("SkillsList", {
        component: "api/bot/skills/list",
        message: `Audit log fetch warning: ${auditErr.message}`,
      });
    }

    return NextResponse.json(
      {
        skills: skills ?? [],
        auditLog: auditLog ?? [],
      },
      {
        status: 200,
        headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=10" },
      }
    );
  } catch (error) {
    logError("SkillsList", {
      component: "api/bot/skills/list",
      action: "GET",
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
