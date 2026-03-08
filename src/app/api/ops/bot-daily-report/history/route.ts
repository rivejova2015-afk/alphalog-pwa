import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Profile = "forex" | "futuros";
type Status = "PASS" | "DEGRADED" | "FAIL" | "UNKNOWN";

type DailyEventRow = {
  id: string;
  payload: {
    profile?: Profile;
    generatedAt?: string;
    overallStatus?: Status;
  } | null;
  created_at: string;
};

type HistoryPoint = {
  date: string;
  generatedAt: string;
  forex: Status;
  futuros: Status;
  overall: Status;
};

function normalizeStatus(value: unknown): Status {
  const normalized = String(value || "").toUpperCase();
  if (normalized === "PASS" || normalized === "DEGRADED" || normalized === "FAIL") return normalized;
  return "UNKNOWN";
}

function statusWeight(status: Status) {
  if (status === "FAIL") return 3;
  if (status === "DEGRADED") return 2;
  if (status === "PASS") return 1;
  return 0;
}

function maxStatus(a: Status, b: Status): Status {
  return statusWeight(a) >= statusWeight(b) ? a : b;
}

function toDateKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function parseDaysParam(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("days");
  if (!raw) return 30;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 30;
  return Math.min(90, Math.max(7, Math.floor(parsed)));
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const days = parseDaysParam(request);
    const fromIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data: bots, error: botsError } = await supabase
      .from("bots")
      .select("id")
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
        {
          ok: true,
          days,
          points: [] as HistoryPoint[],
          totals: { PASS: 0, DEGRADED: 0, FAIL: 0, UNKNOWN: 0 },
        },
        { status: 200 }
      );
    }

    const { data: events, error: eventsError } = await supabase
      .from("bot_events")
      .select("id,payload,created_at")
      .in("bot_id", botIds)
      .eq("event_type", "DAILY_VERIFICATION")
      .gte("created_at", fromIso)
      .order("created_at", { ascending: false })
      .limit(600);

    if (eventsError) {
      return NextResponse.json(
        { ok: false, error: "Failed to load daily verification history", details: eventsError.message },
        { status: 500 }
      );
    }

    const rows = (events ?? []) as DailyEventRow[];
    const map = new Map<string, { generatedAt: string; forex: Status; futuros: Status }>();

    for (const row of rows) {
      const payload = row.payload ?? {};
      const generatedAt = payload.generatedAt || row.created_at;
      const dateKey = toDateKey(generatedAt);
      const profile = payload.profile;
      if (!dateKey || (profile !== "forex" && profile !== "futuros")) continue;

      const status = normalizeStatus(payload.overallStatus);
      const existing = map.get(dateKey) ?? {
        generatedAt,
        forex: "UNKNOWN" as Status,
        futuros: "UNKNOWN" as Status,
      };

      if (new Date(generatedAt).getTime() > new Date(existing.generatedAt).getTime()) {
        existing.generatedAt = generatedAt;
      }
      existing[profile] = status;
      map.set(dateKey, existing);
    }

    const points = Array.from(map.entries())
      .map(([date, value]) => {
        const overall = maxStatus(value.forex, value.futuros);
        return {
          date,
          generatedAt: value.generatedAt,
          forex: value.forex,
          futuros: value.futuros,
          overall,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));

    const totals = points.reduce(
      (acc, point) => {
        acc[point.overall] += 1;
        return acc;
      },
      { PASS: 0, DEGRADED: 0, FAIL: 0, UNKNOWN: 0 } as Record<Status, number>
    );

    return NextResponse.json(
      {
        ok: true,
        days,
        points,
        totals,
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
        error: "Unexpected error reading daily verification history",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
