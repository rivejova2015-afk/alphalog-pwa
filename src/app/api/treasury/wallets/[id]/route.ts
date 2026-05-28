import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";
import { logAuditFromRequest } from "@/lib/security/auditLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DELETE /api/treasury/wallets/[id] — soft-delete a wallet
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    // Verify ownership before soft-delete
    const { data: wallet, error: ownErr } = await supabase
      .from("treasury_wallets")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (ownErr || !wallet) return NextResponse.json({ error: "Wallet not found" }, { status: 404 });

    // Block deletion if any active config still references this wallet
    const { count: linkedConfigs } = await supabase
      .from("treasury_configs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("wallet_id", id)
      .is("deleted_at", null);

    if ((linkedConfigs ?? 0) > 0) {
      return NextResponse.json(
        { error: "Wallet in use", details: `${linkedConfigs} treasury_configs row(s) reference this wallet` },
        { status: 409 }
      );
    }

    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from("treasury_wallets")
      .update({ deleted_at: nowIso, updated_at: nowIso })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      logError("Treasury", { component: "DELETE /api/treasury/wallets/[id]", message: error.message });
      return NextResponse.json({ error: "Delete failed" }, { status: 500 });
    }

    await logAuditFromRequest(
      {
        userId: user.id,
        action: "delete",
        resourceType: "treasury_wallet",
        resourceId: id,
        status: "success",
      },
      request
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    logError("Treasury", { component: "DELETE /api/treasury/wallets/[id]", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
