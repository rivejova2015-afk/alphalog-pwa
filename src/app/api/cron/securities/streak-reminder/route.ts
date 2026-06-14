/**
 * GET /api/cron/securities/streak-reminder
 * Recordatorio de hábito de CyberSec Academy. Para cada usuario con
 * notify_streak=true que no haya sido notificado hoy, computa su racha + XP del
 * día (motores puros) y, si la racha está en riesgo o falta la meta, envía push.
 * Auth: header x-cron-secret == CRON_SECRET. Programar a la tarde (UTC).
 */
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { sendPushToSubscriptions } from "@/lib/push/webpush.server";
import { safeCompareTokens } from "@/lib/security/timing";
import { logError, logInfo } from "@/lib/log";
import {
  streakWithFreeze, activityDays, xpEarnedToday, streakReminder,
  type XpData,
} from "@/lib/securities/cybersec";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    if (!safeCompareTokens(request.headers.get("x-cron-secret"), process.env.CRON_SECRET ?? null)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return NextResponse.json({ error: "Service not configured" }, { status: 500 });
    const supabase = createClient(url, key, { auth: { persistSession: false } });

    const today = new Date().toISOString().slice(0, 10);
    const { data: states, error } = await supabase
      .from("securities_user_state")
      .select("user_id, daily_goal, last_notified_on")
      .eq("notify_streak", true);
    if (error) {
      logError("Securities", { component: "cron streak-reminder", message: error.message });
      return NextResponse.json({ error: "Query failed" }, { status: 500 });
    }

    let notified = 0;
    for (const st of states ?? []) {
      if (st.last_notified_on === today) continue; // dedup diario

      const uid = st.user_id as string;
      const [quizQ, examQ, hwQ] = await Promise.all([
        supabase.from("securities_quiz_results").select("lesson_id, score, total, taken_at").eq("user_id", uid),
        supabase.from("securities_exam_results").select("score, total, passed, taken_at").eq("user_id", uid),
        supabase.from("securities_homework_submissions").select("homework_id, status, points, submitted_at, graded_at").eq("user_id", uid),
      ]);
      const homework: XpData["homework"] = {};
      for (const h of hwQ.data ?? []) homework[h.homework_id] = { status: h.status, points: h.points, submitted_at: h.submitted_at, graded_at: h.graded_at };
      const dataU: XpData = { quizResults: quizQ.data ?? [], examResults: examQ.data ?? [], homework };

      const streak = streakWithFreeze(activityDays(dataU)).streak;
      const xpToday = xpEarnedToday(dataU);
      const reminder = streakReminder(streak, xpToday, st.daily_goal ?? 50);
      if (!reminder) continue;

      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .eq("user_id", uid);
      if (!subs || subs.length === 0) continue;

      const payloadSubs = subs.map((s) => ({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }));
      await sendPushToSubscriptions(payloadSubs, {
        title: reminder.title,
        body: reminder.body,
        tag: "cybersec-streak",
        data: { url: "/securities/cybersec" },
      });
      await supabase.from("securities_user_state").update({ last_notified_on: today }).eq("user_id", uid);
      notified += 1;
    }

    logInfo("Securities", `cron streak-reminder: notified ${notified}`);
    return NextResponse.json({ ok: true, notified });
  } catch (err) {
    logError("Securities", { component: "cron streak-reminder", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
