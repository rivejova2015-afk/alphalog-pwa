import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface InstrumentRow {
  id: string;
  symbol: string;
  display_name: string;
  category: string;
  market_type: string;
  sort_index: number;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("instruments")
      .select("id, symbol, display_name, category, market_type, sort_index")
      .order("sort_index", { ascending: true });

    if (error) {
      logError("Instruments", { component: "GET /api/instruments", message: error.message });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const flat = (data ?? []) as InstrumentRow[];
    const grouped: Record<string, InstrumentRow[]> = {};
    for (const row of flat) {
      const key = row.category || "Otros";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(row);
    }

    return NextResponse.json({ grouped, flat }, {
      headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=600" },
    });
  } catch (err) {
    logError("Instruments", { component: "GET /api/instruments", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
