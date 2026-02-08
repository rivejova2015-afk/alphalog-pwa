import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { recomputeProgress } from "@/lib/tradermap/progressEngine";

const normalizeIds = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(String).filter(Boolean) : [];

/**
 * GET /api/tradermap/progress-map/config
 * Returns current config + versions
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: config } = await supabase
      .from("progress_ecosystem_config")
      .select("*")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (!config) {
      return NextResponse.json({ config: null, versions: [] });
    }

    const { data: versions } = await supabase
      .from("progress_ecosystem_versions")
      .select("*")
      .eq("config_id", config.id)
      .order("version_int", { ascending: false });

    return NextResponse.json({
      config: {
        ...config,
        satellite_account_ids: normalizeIds(config.satellite_account_ids),
      },
      versions: versions || [],
    });
  } catch (err: unknown) {
    console.error("Error in GET /api/tradermap/progress-map/config:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/tradermap/progress-map/config
 * Apply ecosystem changes and recompute
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const coreAccountId = body?.core_account_id ? String(body.core_account_id) : "";
    const satelliteAccountIds = normalizeIds(body?.satellite_account_ids);

    if (!coreAccountId) {
      return NextResponse.json({ error: "Core account is required" }, { status: 400 });
    }

    const uniqueSatellites = Array.from(new Set(satelliteAccountIds.filter(Boolean)));

    if (uniqueSatellites.length > 39) {
      return NextResponse.json(
        { error: "limite alcanzado (39) desmarca uno para continuar" },
        { status: 400 }
      );
    }

    if (uniqueSatellites.includes(coreAccountId)) {
      return NextResponse.json(
        { error: "Core no puede ser satelite" },
        { status: 400 }
      );
    }

    const accountIds = [coreAccountId, ...uniqueSatellites];
    const { data: accounts } = await supabase
      .from("accounts")
      .select("id")
      .eq("user_id", userData.user.id)
      .in("id", accountIds);

    const foundIds = new Set((accounts || []).map((row: { id: string }) => row.id));
    if (!foundIds.has(coreAccountId)) {
      return NextResponse.json({ error: "Core account not found" }, { status: 404 });
    }

    if (uniqueSatellites.some((id) => !foundIds.has(id))) {
      return NextResponse.json({ error: "Satellite account not found" }, { status: 404 });
    }

    const { data: existing } = await supabase
      .from("progress_ecosystem_config")
      .select("*")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    const nextVersion = existing ? Number(existing.version_int || 0) + 1 : 1;
    const appliedAt = new Date().toISOString();

    const { data: config, error } = await supabase
      .from("progress_ecosystem_config")
      .upsert(
        {
          id: existing?.id,
          user_id: userData.user.id,
          core_account_id: coreAccountId,
          satellite_account_ids: uniqueSatellites,
          applied_at: appliedAt,
          version_int: nextVersion,
        },
        { onConflict: "user_id" }
      )
      .select()
      .single();

    if (error || !config) {
      console.error("Error updating progress ecosystem config:", error);
      return NextResponse.json({ error: "Failed to apply config" }, { status: 500 });
    }

    await supabase.from("progress_ecosystem_versions").insert({
      config_id: config.id,
      version_int: nextVersion,
      snapshot_json: {
        core_account_id: coreAccountId,
        satellite_account_ids: uniqueSatellites,
        applied_at: appliedAt,
        version_int: nextVersion,
      },
    });

    const result = await recomputeProgress(supabase, userData.user.id);

    return NextResponse.json({ config: result.config, state: result });
  } catch (err: unknown) {
    console.error("Error in POST /api/tradermap/progress-map/config:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
