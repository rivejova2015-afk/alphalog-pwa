import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";
import {
  LESSONS, SYLLABUS, HW,
  computeXp, computeProgress, computeAchievements,
  streakWithFreeze, activityDays, xpEarnedToday,
  snapshotFromData, detectMilestones,
  type XpData, type MilestoneSnapshot,
} from "@/lib/securities/cybersec";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One aggregated read for the whole gamification layer: instead of each page
// fetching 4 endpoints and recomputing client-side, the server fetches the
// user's result tables, runs the (pure, isomorphic) engines once, detects +
// persists milestones, and returns everything ready to render.
const CONTENT = {
  lessons: LESSONS.map((l) => ({ id: l.id, sub: l.sub })),
  modules: SYLLABUS.map((m) => ({ m: m.m, cat: m.cat })),
  homework: HW.map((h) => ({ id: h.id, l: h.l, pts: h.pts })),
};

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [quizQ, examQ, hwQ, progQ, stateQ] = await Promise.all([
      supabase.from("securities_quiz_results").select("lesson_id, score, total, taken_at").eq("user_id", user.id),
      supabase.from("securities_exam_results").select("score, total, passed, taken_at, section").eq("user_id", user.id),
      supabase.from("securities_homework_submissions").select("homework_id, status, points, submitted_at, graded_at").eq("user_id", user.id),
      supabase.from("securities_progress").select("module_id, completed_levels, research_done").eq("user_id", user.id),
      supabase.from("securities_user_state").select("daily_goal, milestone_snapshot, notify_streak").eq("user_id", user.id).maybeSingle(),
    ]);

    const homework: XpData["homework"] = {};
    for (const h of hwQ.data ?? []) {
      homework[h.homework_id] = { status: h.status, points: h.points, submitted_at: h.submitted_at, graded_at: h.graded_at };
    }
    const progress: NonNullable<XpData["progress"]> = {};
    for (const p of progQ.data ?? []) {
      progress[p.module_id] = { completed_levels: p.completed_levels ?? [], research_done: p.research_done };
    }

    // El examen FINAL es el global (section IS NULL); los de sección se agregan aparte.
    const allExams = examQ.data ?? [];
    const globalExams = allExams.filter((e) => e.section == null);
    const sectionExams: Record<string, { bestPct: number; passed: boolean }> = {};
    for (const e of allExams) {
      if (!e.section) continue;
      const pct = e.total > 0 ? Math.round((e.score / e.total) * 100) : 0;
      const prev = sectionExams[e.section];
      sectionExams[e.section] = { bestPct: Math.max(prev?.bestPct ?? 0, pct), passed: (prev?.passed ?? false) || e.passed };
    }

    const data: XpData = {
      quizResults: quizQ.data ?? [],
      examResults: globalExams,
      homework,
      progress,
    };

    const xp = computeXp(CONTENT, data);
    const stats = computeProgress(CONTENT, data);
    const streak = streakWithFreeze(activityDays(data));
    const achievements = computeAchievements(CONTENT, data, xp, stats, streak.streak);
    const xpToday = xpEarnedToday(data);
    const dailyGoal = stateQ.data?.daily_goal ?? 50;
    const notifyStreak = stateQ.data?.notify_streak ?? false;

    // Milestone detection server-side, persisting the snapshot so each milestone
    // celebrates exactly once and across devices.
    const { snapshot, names } = snapshotFromData(CONTENT, data);
    const prevSnap = (stateQ.data?.milestone_snapshot ?? null) as MilestoneSnapshot | null;
    const milestones = detectMilestones(prevSnap, snapshot, names);
    const { error: upsertErr } = await supabase
      .from("securities_user_state")
      .upsert({ user_id: user.id, milestone_snapshot: snapshot, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (upsertErr) logError("Securities", { component: "GET summary", message: `snapshot upsert: ${upsertErr.message}` });

    return NextResponse.json(
      { xp, stats, achievements, streak, xpToday, dailyGoal, notifyStreak, sectionExams, milestones, mastery: xp.mastery },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (err) {
    logError("Securities", { component: "GET summary", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
