import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/server";
import { logError } from "@/lib/log";

/**
 * GET /api/securities/tracks
 * Lista career tracks
 */
export async function GET(request: NextRequest) {
  try {
    const db = await createClient();
    const user = await getUser(db);

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: tracks, error } = await db
      .from("securities_career_tracks")
      .select("*")
      .order("id", { ascending: true });

    if (error) {
      throw error;
    }

    // Obtener progreso del usuario en cada track
    const { data: userTracks } = await db
      .from("securities_track_progress")
      .select("track_id, progress_percent, status")
      .eq("user_id", user.id);

    const userTrackMap = new Map(
      (userTracks || []).map((ut: any) => [ut.track_id, ut])
    );

    const enrichedTracks = (tracks || []).map((track: any) => ({
      ...track,
      user_progress: userTrackMap.get(track.id) || null,
    }));

    return NextResponse.json(
      { tracks: enrichedTracks },
      {
        headers: {
          "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (error) {
    logError("CyberSec", "Error fetching tracks", {
      component: "api.securities.tracks",
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "Failed to fetch tracks" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/securities/tracks/[id]/enroll
 * Enroll usuario a un track
 */
export async function POST(request: NextRequest) {
  try {
    const db = await createClient();
    const user = await getUser(db);

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { trackId } = await request.json();

    if (!trackId) {
      return NextResponse.json(
        { error: "trackId required" },
        { status: 400 }
      );
    }

    // Insertar o actualizar progreso del track
    const { data, error } = await db
      .from("securities_track_progress")
      .upsert({
        user_id: user.id,
        track_id: trackId,
        modules_completed: [],
        progress_percent: 0,
        status: "started",
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ track_progress: data }, { status: 201 });
  } catch (error) {
    logError("CyberSec", "Error enrolling to track", {
      component: "api.securities.tracks.enroll",
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "Failed to enroll to track" },
      { status: 500 }
    );
  }
}
