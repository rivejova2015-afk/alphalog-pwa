/**
 * GET /api/cron/securities/quiz-dedup
 * Higiene de datos (Fase H): colapsa el historial de intentos de quiz
 * (securities_quiz_results) conservando lo justo para que maestría/XP (mejor
 * intento por lección) Y racha (≥1 intento por día con actividad) queden
 * idénticas. Borra el resto de los intentos redundantes. Pensado para correr
 * semanal — el crecimiento es lento.
 * Auth: header x-cron-secret == CRON_SECRET.
 */
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { safeCompareTokens } from "@/lib/security/timing";
import { logError, logInfo } from "@/lib/log";
import { idsToDelete, type QuizRow } from "@/lib/securities/cybersec";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DELETE_BATCH = 200;

export async function GET(request: NextRequest) {
  try {
    if (!safeCompareTokens(request.headers.get("x-cron-secret"), process.env.CRON_SECRET ?? null)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return NextResponse.json({ error: "Service not configured" }, { status: 500 });
    const supabase = createClient(url, key, { auth: { persistSession: false } });

    // Trae el historial completo paginado (id + columnas necesarias para el dedup).
    const rows: QuizRow[] = [];
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from("securities_quiz_results")
        .select("id, user_id, lesson_id, score, total, taken_at, level")
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) {
        logError("Securities", { component: "cron quiz-dedup", message: error.message });
        return NextResponse.json({ error: "Query failed" }, { status: 500 });
      }
      const batch = (data ?? []) as QuizRow[];
      rows.push(...batch);
      if (batch.length < PAGE) break;
    }

    const toDelete = idsToDelete(rows);
    let deleted = 0;
    for (let i = 0; i < toDelete.length; i += DELETE_BATCH) {
      const chunk = toDelete.slice(i, i + DELETE_BATCH);
      const { error } = await supabase.from("securities_quiz_results").delete().in("id", chunk);
      if (error) {
        logError("Securities", { component: "cron quiz-dedup", message: `delete: ${error.message}` });
        return NextResponse.json({ error: "Delete failed", deleted }, { status: 500 });
      }
      deleted += chunk.length;
    }

    logInfo("Securities", `cron quiz-dedup: scanned ${rows.length}, deleted ${deleted}`);
    return NextResponse.json({ ok: true, scanned: rows.length, deleted });
  } catch (err) {
    logError("Securities", { component: "cron quiz-dedup", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
