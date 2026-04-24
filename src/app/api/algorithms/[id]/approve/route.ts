import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/algorithms/[id]/approve  — paper → approved
export async function POST(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: algo } = await supabase
      .from("trading_algorithms")
      .select("id, status")
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();

    if (!algo) return NextResponse.json({ error: "Algoritmo no encontrado" }, { status: 404 });
    if (algo.status !== "paper") {
      return NextResponse.json({ error: "Solo se pueden aprobar algoritmos en estado Paper Test" }, { status: 409 });
    }

    const { data, error } = await supabase
      .from("trading_algorithms")
      .update({ status: "approved" })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ algorithm: data });
  } catch (err) {
    logError("Algorithms", { component: "POST /api/algorithms/[id]/approve", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
