import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("algorithm_templates")
      .select("id, template_key, name, description, market_type, algo_type, default_instrument, default_direction, default_lot_size, default_max_trades, default_risk_percent, parameters, magic_number, sort_index")
      .eq("is_active", true)
      .order("sort_index", { ascending: true });

    if (error) {
      logError("AlgorithmTemplates", { component: "GET /api/algorithm-templates", message: error.message });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ templates: data ?? [] }, {
      headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=600" },
    });
  } catch (err) {
    logError("AlgorithmTemplates", { component: "GET /api/algorithm-templates", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
