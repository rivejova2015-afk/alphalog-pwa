import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/bot/iv-surface/latest?botInstanceId=<uuid>
// Returns the latest IV surface snapshot for the given bot instance
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

    const { searchParams } = new URL(request.url);
    const botInstanceId = searchParams.get("botInstanceId");

    if (!botInstanceId) {
      return NextResponse.json(
        { error: "botInstanceId query param is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("iv_surface_snapshots")
      .select(
        "id, instrument, snapshot_at, spot_price, surface_grid, heston_kappa, heston_theta, heston_sigma, heston_rho, heston_v0, strikes, expiries, created_at"
      )
      .eq("bot_instance_id", botInstanceId)
      .order("snapshot_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logError("IVSurface", {
        component: "api/bot/iv-surface/latest",
        message: error.message,
      });
      throw error;
    }

    if (!data) {
      return NextResponse.json({ data: null }, { status: 200 });
    }

    return NextResponse.json(
      { data },
      {
        status: 200,
        headers: { "Cache-Control": "private, max-age=3600, stale-while-revalidate=300" },
      }
    );
  } catch (error) {
    logError("IVSurface", {
      component: "api/bot/iv-surface/latest",
      action: "GET",
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
