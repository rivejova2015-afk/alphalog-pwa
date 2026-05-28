import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";
import { logAuditFromRequest } from "@/lib/security/auditLog";
import { recordBugFromRequest } from "@/lib/security/bugRecorder";
import { treasuryWalletCreateSchema, validatePayloadSafe, validationErrorResponse } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/treasury/wallets — list user's active wallets (Sprint 2)
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("treasury_wallets")
      .select("id, user_id, name, currency, starting_balance, created_at, updated_at, deleted_at")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (error) {
      logError("Treasury", { component: "GET /api/treasury/wallets", message: error.message });
      return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
    }

    return NextResponse.json(
      { wallets: data ?? [] },
      { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } }
    );
  } catch (err) {
    logError("Treasury", { component: "GET /api/treasury/wallets", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/treasury/wallets — create a wallet for the user
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const result = validatePayloadSafe(treasuryWalletCreateSchema, body);
    if (!result.success) return NextResponse.json(validationErrorResponse(result.errors), { status: 400 });

    const { data, error } = await supabase
      .from("treasury_wallets")
      .insert({
        user_id: user.id,
        name: result.data.name,
        currency: result.data.currency,
        starting_balance: result.data.starting_balance,
      })
      .select()
      .single();

    if (error || !data) {
      const message = error?.message ?? "no data returned";
      logError("Treasury", { component: "POST /api/treasury/wallets", message });
      await recordBugFromRequest(request, {
        userId: user.id,
        status: 500,
        error: message,
        payload: { route: "/api/treasury/wallets POST" },
      });
      return NextResponse.json({ error: "Create failed" }, { status: 500 });
    }

    await logAuditFromRequest(
      {
        userId: user.id,
        action: "create",
        resourceType: "treasury_wallet",
        resourceId: data.id,
        status: "success",
        changes: { name: data.name, currency: data.currency },
      },
      request
    );

    return NextResponse.json({ wallet: data }, { status: 201 });
  } catch (err) {
    logError("Treasury", { component: "POST /api/treasury/wallets", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
