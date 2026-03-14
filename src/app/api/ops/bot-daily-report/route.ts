import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DailyEventRow = {
  id: string;
  bot_id: string;
  payload: {
    profile?: "forex" | "futuros";
    generatedAt?: string;
    overallStatus?: string;
    marketPolicy?: string;
    recommendations?: string[];
    health?: unknown;
    sloSummary?: unknown;
  };
  created_at: string;
};

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { data: bots, error: botsError } = await supabase
      .from("bots")
      .select("id,name")
      .eq("user_id", user.id);

    if (botsError) {
      return NextResponse.json(
        { ok: false, error: "Failed to load bot profiles", details: botsError.message },
        { status: 500 }
      );
    }

    const botIds = (bots ?? []).map((bot) => bot.id);
    if (botIds.length === 0) {
      return NextResponse.json(
        { ok: true, latest: null, byProfile: { forex: null, futuros: null }, recommendations: [] },
        { status: 200 }
      );
    }

    const { data: events, error: eventsError } = await supabase
      .from("bot_events")
      .select("id,bot_id,payload,created_at")
      .in("bot_id", botIds)
      .eq("event_type", "DAILY_VERIFICATION")
      .order("created_at", { ascending: false })
      .limit(100);

    if (eventsError) {
      return NextResponse.json(
        { ok: false, error: "Failed to load daily verification events", details: eventsError.message },
        { status: 500 }
      );
    }

    const rows = (events ?? []) as DailyEventRow[];
    if (rows.length === 0) {
      return NextResponse.json(
        { ok: true, latest: null, byProfile: { forex: null, futuros: null }, recommendations: [] },
        { status: 200 }
      );
    }

    const byProfile = {
      forex: rows.find((row) => row.payload?.profile === "forex") ?? null,
      futuros: rows.find((row) => row.payload?.profile === "futuros") ?? null,
    };
    const latest = rows[0];

    return NextResponse.json(
      {
        ok: true,
        latest: {
          id: latest.id,
          createdAt: latest.created_at,
          generatedAt: latest.payload?.generatedAt ?? latest.created_at,
          overallStatus: latest.payload?.overallStatus ?? "UNKNOWN",
          marketPolicy: latest.payload?.marketPolicy ?? null,
        },
        byProfile: {
          forex: byProfile.forex
            ? {
                id: byProfile.forex.id,
                createdAt: byProfile.forex.created_at,
                generatedAt: byProfile.forex.payload?.generatedAt ?? byProfile.forex.created_at,
                overallStatus: byProfile.forex.payload?.overallStatus ?? "UNKNOWN",
                sloSummary: byProfile.forex.payload?.sloSummary ?? null,
                health: byProfile.forex.payload?.health ?? null,
              }
            : null,
          futuros: byProfile.futuros
            ? {
                id: byProfile.futuros.id,
                createdAt: byProfile.futuros.created_at,
                generatedAt: byProfile.futuros.payload?.generatedAt ?? byProfile.futuros.created_at,
                overallStatus: byProfile.futuros.payload?.overallStatus ?? "UNKNOWN",
                sloSummary: byProfile.futuros.payload?.sloSummary ?? null,
                health: byProfile.futuros.payload?.health ?? null,
              }
            : null,
        },
        recommendations: Array.isArray(latest.payload?.recommendations)
          ? latest.payload.recommendations
          : [],
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unexpected error reading daily verification report",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
