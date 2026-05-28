import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";
import { logAuditFromRequest } from "@/lib/security/auditLog";
import { recordBugFromRequest } from "@/lib/security/bugRecorder";
import { treasuryTransactionCreateSchema, validatePayloadSafe, validationErrorResponse } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

// GET /api/treasury/transactions — list active transactions for the user
// Optional filters: ?walletId, ?accountId, ?from=YYYY-MM-DD, ?to=YYYY-MM-DD, ?limit
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(request.url);
    const walletId = url.searchParams.get("walletId");
    const accountId = url.searchParams.get("accountId");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const limitRaw = Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), MAX_LIMIT) : DEFAULT_LIMIT;

    let query = supabase
      .from("treasury_transactions")
      .select("id, user_id, wallet_id, account_id, type, amount, occurred_on, description, notes, created_at, updated_at, deleted_at")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("occurred_on", { ascending: false })
      .limit(limit);

    if (walletId) query = query.eq("wallet_id", walletId);
    if (accountId) query = query.eq("account_id", accountId);
    if (from) query = query.gte("occurred_on", from);
    if (to) query = query.lte("occurred_on", to);

    const { data, error } = await query;
    if (error) {
      logError("Treasury", { component: "GET /api/treasury/transactions", message: error.message });
      return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
    }

    return NextResponse.json(
      { transactions: data ?? [] },
      { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } }
    );
  } catch (err) {
    logError("Treasury", { component: "GET /api/treasury/transactions", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/treasury/transactions — log a transaction against a wallet
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const result = validatePayloadSafe(treasuryTransactionCreateSchema, body);
    if (!result.success) return NextResponse.json(validationErrorResponse(result.errors), { status: 400 });

    // Verify wallet ownership before insert
    const { data: wallet, error: walletErr } = await supabase
      .from("treasury_wallets")
      .select("id")
      .eq("id", result.data.wallet_id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (walletErr || !wallet) return NextResponse.json({ error: "Wallet not found" }, { status: 404 });

    // If account_id provided, verify ownership too
    if (result.data.account_id) {
      const { data: account, error: acctErr } = await supabase
        .from("accounts")
        .select("id")
        .eq("id", result.data.account_id)
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .maybeSingle();

      if (acctErr || !account) return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("treasury_transactions")
      .insert({
        user_id: user.id,
        wallet_id: result.data.wallet_id,
        account_id: result.data.account_id ?? null,
        type: result.data.type,
        amount: result.data.amount,
        occurred_on: result.data.occurred_on,
        description: result.data.description ?? null,
        notes: result.data.notes ?? null,
      })
      .select()
      .single();

    if (error || !data) {
      const message = error?.message ?? "no data returned";
      logError("Treasury", { component: "POST /api/treasury/transactions", message });
      await recordBugFromRequest(request, {
        userId: user.id,
        status: 500,
        error: message,
        payload: { route: "/api/treasury/transactions POST" },
      });
      return NextResponse.json({ error: "Create failed" }, { status: 500 });
    }

    await logAuditFromRequest(
      {
        userId: user.id,
        action: "create",
        resourceType: "treasury_transaction",
        resourceId: data.id,
        status: "success",
        changes: { type: data.type, amount: data.amount, wallet_id: data.wallet_id },
      },
      request
    );

    return NextResponse.json({ transaction: data }, { status: 201 });
  } catch (err) {
    logError("Treasury", { component: "POST /api/treasury/transactions", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
