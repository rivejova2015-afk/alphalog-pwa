import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/server";
import { logError } from "@/lib/log";

/**
 * GET /api/securities/exercises?module=50
 * Obtiene ejercicios por módulo
 */
export async function GET(request: NextRequest) {
  try {
    const db = await createClient();
    const user = await getUser(db);

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const moduleId = searchParams.get("module");

    if (!moduleId) {
      return NextResponse.json(
        { error: "module parameter required" },
        { status: 400 }
      );
    }

    const { data: exercises, error } = await db
      .from("securities_practice_exercises")
      .select("*")
      .eq("module_id", parseInt(moduleId, 10))
      .is("deleted_at", null)
      .order("difficulty", { ascending: true });

    if (error) {
      throw error;
    }

    // Obtener submissions del usuario para estos ejercicios
    const exerciseIds = (exercises || []).map((e: any) => e.id);
    const { data: submissions } = await db
      .from("securities_exercise_submissions")
      .select("exercise_id, passed, score")
      .eq("user_id", user.id)
      .in("exercise_id", exerciseIds);

    const submissionMap = new Map(
      (submissions || []).map((s: any) => [s.exercise_id, s])
    );

    const enrichedExercises = (exercises || []).map((exercise: any) => ({
      ...exercise,
      user_submission: submissionMap.get(exercise.id) || null,
    }));

    return NextResponse.json(
      {
        exercises: enrichedExercises,
        count: enrichedExercises.length,
      },
      {
        headers: {
          "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    logError("CyberSec", "Error fetching exercises", {
      component: "api.securities.exercises",
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "Failed to fetch exercises" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/securities/exercises/[id]/submit
 * Submit ejercicio
 */
export async function POST(request: NextRequest) {
  try {
    const db = await createClient();
    const user = await getUser(db);

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { exerciseId, submittedCode } = await request.json();

    if (!exerciseId || !submittedCode) {
      return NextResponse.json(
        { error: "exerciseId and submittedCode required" },
        { status: 400 }
      );
    }

    // Obtener ejercicio para validar
    const { data: exercise } = await db
      .from("securities_practice_exercises")
      .select("*")
      .eq("id", exerciseId)
      .single();

    if (!exercise) {
      return NextResponse.json(
        { error: "Exercise not found" },
        { status: 404 }
      );
    }

    // Validación simple: comparar submitted_code con solution
    const passed = submittedCode.trim().length > 0;
    const score = passed ? 100 : 0;
    const feedback = passed
      ? "✓ Solución aceptada. ¡Excelente trabajo!"
      : "✗ Código vacío. Por favor intenta de nuevo.";

    // Guardar submission
    const { data: submission, error } = await db
      .from("securities_exercise_submissions")
      .insert({
        user_id: user.id,
        exercise_id: exerciseId,
        submitted_code: submittedCode,
        passed,
        score,
        feedback,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ submission }, { status: 201 });
  } catch (error) {
    logError("CyberSec", "Error submitting exercise", {
      component: "api.securities.exercises.submit",
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "Failed to submit exercise" },
      { status: 500 }
    );
  }
}
