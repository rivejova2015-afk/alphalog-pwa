import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { recordBugFromRequest } from "@/lib/security/bugRecorder";

/**
 * GET /api/tradermap/progress-map/thresholds
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("progress_map_thresholds")
      .select("id, key, value_numeric, value_json, updated_at")
      .eq("user_id", userData.user.id)
      .order("key", { ascending: true });

    if (error) {
      console.error("Error fetching thresholds:", error);
      return NextResponse.json({ error: "Failed to fetch thresholds" }, { status: 500 });
    }

    return NextResponse.json(data || [], {
      headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' },
    });
  } catch (err: unknown) {
    console.error("Error in GET /api/tradermap/progress-map/thresholds:", err);
    await recordBugFromRequest(request, {
      userId: null,
      status: 500,
      error: err,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/tradermap/progress-map/thresholds
 * Body: { items: [{ key, value_numeric, value_json }] }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const items = Array.isArray(body?.items) ? body.items : [];

    if (items.length === 0) {
      return NextResponse.json({ error: "items required" }, { status: 400 });
    }

    const payload: Array<{
      user_id: string;
      key: string;
      value_numeric: number | null;
      value_json: Record<string, unknown> | null;
    }> = items.map((item: Record<string, unknown>) => ({
      user_id: userData.user.id,
      key: String(item.key || "").trim(),
      value_numeric: item.value_numeric !== undefined ? Number(item.value_numeric) : null,
      value_json: (item.value_json as Record<string, unknown> | null) || null,
    }));

    if (payload.some((row) => !row.key)) {
      return NextResponse.json({ error: "key is required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("progress_map_thresholds")
      .upsert(payload, { onConflict: "user_id,key" });

    if (error) {
      console.error("Error upserting thresholds:", error);
      return NextResponse.json({ error: "Failed to save thresholds" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("Error in POST /api/tradermap/progress-map/thresholds:", err);
    await recordBugFromRequest(request, {
      userId: null,
      status: 500,
      error: err,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
