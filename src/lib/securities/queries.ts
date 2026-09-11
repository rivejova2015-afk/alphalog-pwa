import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import type {
  CareerTrack,
  PracticeExercise,
  Resource,
  Badge,
  Lab,
  TrackProgress,
  ModulePrerequisite,
} from "./schemas";

// ═══════════════════════════════════════════════════════════════════════════
// CAREER TRACKS
// ═══════════════════════════════════════════════════════════════════════════

export async function getCareerTracks(): Promise<CareerTrack[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("securities_career_tracks")
    .select("*")
    .order("id", { ascending: true });

  if (error) {
    console.error("Error fetching career tracks:", error);
    return [];
  }

  return data || [];
}

export async function getCareerTrackById(id: number): Promise<CareerTrack | null> {
  const db = await createClient();
  const { data, error } = await db
    .from("securities_career_tracks")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching career track:", error);
    return null;
  }

  return data;
}

// ═══════════════════════════════════════════════════════════════════════════
// PRACTICE EXERCISES
// ═══════════════════════════════════════════════════════════════════════════

export async function getExercisesByModule(moduleId: number): Promise<PracticeExercise[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("securities_practice_exercises")
    .select("*")
    .eq("module_id", moduleId)
    .is("deleted_at", null)
    .order("difficulty", { ascending: true });

  if (error) {
    console.error("Error fetching exercises:", error);
    return [];
  }

  return data || [];
}

export async function getExerciseById(id: string): Promise<PracticeExercise | null> {
  const db = await createClient();
  const { data, error } = await db
    .from("securities_practice_exercises")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error) {
    console.error("Error fetching exercise:", error);
    return null;
  }

  return data;
}

export async function getUserExerciseProgress(
  userId: string,
  moduleId: number
): Promise<{ total: number; completed: number; percentage: number }> {
  const db = await createClient();

  // Total ejercicios del módulo
  const { data: allExercises, error: err1 } = await db
    .from("securities_practice_exercises")
    .select("id", { count: "exact" })
    .eq("module_id", moduleId)
    .is("deleted_at", null);

  // Ejercicios completados (passed = true)
  const { data: completedExercises, error: err2 } = await db
    .from("securities_exercise_submissions")
    .select("exercise_id", { count: "exact" })
    .eq("user_id", userId)
    .eq("passed", true);

  if (err1 || err2) {
    console.error("Error fetching exercise progress:", err1 || err2);
    return { total: 0, completed: 0, percentage: 0 };
  }

  const total = allExercises?.length || 0;
  const completed = completedExercises?.length || 0;

  return {
    total,
    completed,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// RESOURCES
// ═══════════════════════════════════════════════════════════════════════════

export async function getResourcesByModule(moduleId: number): Promise<Resource[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("securities_resources")
    .select("*")
    .eq("module_id", moduleId)
    .order("type", { ascending: true })
    .order("rating", { ascending: false });

  if (error) {
    console.error("Error fetching resources:", error);
    return [];
  }

  return data || [];
}

export async function getResourcesByConcept(conceptId: number): Promise<Resource[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("securities_resources")
    .select("*")
    .eq("concept_id", conceptId)
    .order("rating", { ascending: false });

  if (error) {
    console.error("Error fetching resources:", error);
    return [];
  }

  return data || [];
}

export async function getResourcesByType(
  type: "paper" | "video" | "tool" | "ctf" | "book" | "course",
  limit = 10
): Promise<Resource[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("securities_resources")
    .select("*")
    .eq("type", type)
    .order("rating", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching resources by type:", error);
    return [];
  }

  return data || [];
}

// ═══════════════════════════════════════════════════════════════════════════
// BADGES
// ═══════════════════════════════════════════════════════════════════════════

export async function getBadges(): Promise<Badge[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("securities_badges")
    .select("*")
    .order("id", { ascending: true });

  if (error) {
    console.error("Error fetching badges:", error);
    return [];
  }

  return data || [];
}

export async function getUserBadges(userId: string): Promise<Badge[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("securities_user_badges")
    .select("badge_id, earned_at")
    .eq("user_id", userId)
    .then(({ data, error }) => {
      if (error) throw error;
      if (!data) return { data: [] };

      // Obtener detalles de badges
      const badgeIds = (data as any[]).map((ub) => ub.badge_id);
      return db
        .from("securities_badges")
        .select("*")
        .in("id", badgeIds);
    });

  if (error) {
    console.error("Error fetching user badges:", error);
    return [];
  }

  return data || [];
}

// ═══════════════════════════════════════════════════════════════════════════
// TRACK PROGRESS
// ═══════════════════════════════════════════════════════════════════════════

export async function getUserTrackProgress(
  userId: string,
  trackId: number
): Promise<TrackProgress | null> {
  const db = await createClient();
  const { data, error } = await db
    .from("securities_track_progress")
    .select("*")
    .eq("user_id", userId)
    .eq("track_id", trackId)
    .single();

  if (error) {
    console.error("Error fetching track progress:", error);
    return null;
  }

  return data;
}

export async function getUserAllTracks(userId: string): Promise<TrackProgress[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("securities_track_progress")
    .select("*")
    .eq("user_id", userId)
    .order("started_at", { ascending: false });

  if (error) {
    console.error("Error fetching user tracks:", error);
    return [];
  }

  return data || [];
}

// ═══════════════════════════════════════════════════════════════════════════
// MODULE PREREQUISITES
// ═══════════════════════════════════════════════════════════════════════════

export async function getModulePrerequisites(moduleId: number): Promise<ModulePrerequisite[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("securities_module_prerequisites")
    .select("*")
    .eq("module_id", moduleId);

  if (error) {
    console.error("Error fetching prerequisites:", error);
    return [];
  }

  return data || [];
}

export async function checkPrerequisitesMet(
  userId: string,
  moduleId: number
): Promise<{ met: boolean; missing: number[] }> {
  const db = await createClient();

  // Obtener prerequisitos
  const { data: prereqs, error: err1 } = await db
    .from("securities_module_prerequisites")
    .select("prerequisite_module_id")
    .eq("module_id", moduleId);

  if (err1) {
    console.error("Error fetching prerequisites:", err1);
    return { met: true, missing: [] };
  }

  if (!prereqs || prereqs.length === 0) {
    return { met: true, missing: [] };
  }

  const prerequisiteModuleIds = (prereqs as any[]).map((p) => p.prerequisite_module_id);

  // Obtener módulos completados por el usuario
  const { data: completed, error: err2 } = await db
    .from("securities_progress")
    .select("modules_completed")
    .eq("user_id", userId)
    .single();

  if (err2) {
    console.error("Error fetching user progress:", err2);
    return { met: false, missing: prerequisiteModuleIds };
  }

  const completedModules = (completed as any)?.modules_completed || [];
  const missing = prerequisiteModuleIds.filter((id) => !completedModules.includes(id));

  return {
    met: missing.length === 0,
    missing,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// LABS
// ═══════════════════════════════════════════════════════════════════════════

export async function getLabsByModule(moduleId: number): Promise<Lab[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("securities_labs")
    .select("*")
    .eq("module_id", moduleId)
    .order("difficulty", { ascending: true });

  if (error) {
    console.error("Error fetching labs:", error);
    return [];
  }

  return data || [];
}

export async function getLabById(id: string): Promise<Lab | null> {
  const db = await createClient();
  const { data, error } = await db
    .from("securities_labs")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching lab:", error);
    return null;
  }

  return data;
}

// ═══════════════════════════════════════════════════════════════════════════
// LEADERBOARD
// ═══════════════════════════════════════════════════════════════════════════

export async function getLeaderboard(limit = 10): Promise<
  Array<{
    user_id: string;
    xp_total: number;
    modules_completed: number;
    rank: number;
  }>
> {
  const db = await createClient();
  const { data, error } = await db
    .from("securities_progress")
    .select("user_id, xp_total, modules_completed")
    .order("xp_total", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching leaderboard:", error);
    return [];
  }

  return (
    data?.map((item, index) => ({
      user_id: item.user_id,
      xp_total: item.xp_total || 0,
      modules_completed: (item.modules_completed as number[] | null)?.length || 0,
      rank: index + 1,
    })) || []
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ANALYTICS & DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

export async function getUserSecurityProgress(userId: string) {
  const db = await createClient();

  const { data: progress } = await db
    .from("securities_progress")
    .select(
      "modules_completed, quiz_scores, exercises_completed, xp_total, streak_days, specialties, badge_ids"
    )
    .eq("user_id", userId)
    .single();

  const badges = await getUserBadges(userId);
  const tracks = await getUserAllTracks(userId);

  return {
    progress,
    badges,
    tracks,
  };
}
