import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";
import { logAuditFromRequest } from "@/lib/security/auditLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updateSchema = z.object({
  account_id: z.string().uuid(),
  balance_threshold: z.number().min(0).max(1_000_000).optional(),
  anti_drawdown_active: z.boolean().optional(),
  anti_drawdown_threshold: z.number().min(0).max(100).optional(),
  split_mode: z.enum(["growth", "safe", "cash"]).optional(),
  withdrawal_day: z.number().int().min(1).max(31).optional(),
  wallet_id: z.string().uuid().nullable().optional(),
  tax_buffer_percentage: z.number().min(0).max(100).optional(),
  milestone_target: z.number().nonnegative().optional(),
});

// PUT /api/treasury/configs
// Upserts a treasury_configs row keyed by (user_id, account_id). Used by the
// Umbral and AntiDD panels to edit thresholds inline without leaving the UI.
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

    // Verify the account belongs to the user before touching its config.
    const { data: acct, error: acctErr } = await supabase
      .from("accounts")
      .select("id")
      .eq("id", parsed.data.account_id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (acctErr || !acct) return NextResponse.json({ error: "Account not found" }, { status: 404 });

    const payload: Record<string, unknown> = {
      user_id: user.id,
      account_id: parsed.data.account_id,
      updated_at: new Date().toISOString(),
    };
    if (parsed.data.balance_threshold !== undefined) payload.balance_threshold = parsed.data.balance_threshold;
    if (parsed.data.anti_drawdown_active !== undefined) payload.anti_drawdown_active = parsed.data.anti_drawdown_active;
    if (parsed.data.anti_drawdown_threshold !== undefined) payload.anti_drawdown_threshold = parsed.data.anti_drawdown_threshold;
    if (parsed.data.split_mode !== undefined) payload.split_mode = parsed.data.split_mode;
    if (parsed.data.withdrawal_day !== undefined) payload.withdrawal_day = parsed.data.withdrawal_day;
    if (parsed.data.wallet_id !== undefined) payload.wallet_id = parsed.data.wallet_id;
    if (parsed.data.tax_buffer_percentage !== undefined) payload.tax_buffer_percentage = parsed.data.tax_buffer_percentage;
    if (parsed.data.milestone_target !== undefined) payload.milestone_target = parsed.data.milestone_target;

    const { data, error } = await supabase
      .from("treasury_configs")
      .upsert(payload, { onConflict: "user_id,account_id" })
      .select()
      .single();

    if (error || !data) {
      logError("Treasury", { component: "PUT /api/treasury/configs", message: error?.message ?? "no data" });
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    await logAuditFromRequest(
      {
        userId: user.id,
        action: "update",
        resourceType: "treasury_config",
        resourceId: parsed.data.account_id,
        status: "success",
        changes: {
          balance_threshold: parsed.data.balance_threshold,
          anti_drawdown_active: parsed.data.anti_drawdown_active,
          anti_drawdown_threshold: parsed.data.anti_drawdown_threshold,
          split_mode: parsed.data.split_mode,
          withdrawal_day: parsed.data.withdrawal_day,
          wallet_id: parsed.data.wallet_id,
          tax_buffer_percentage: parsed.data.tax_buffer_percentage,
          milestone_target: parsed.data.milestone_target,
        },
      },
      request
    );

    return NextResponse.json({ config: data });
  } catch (err) {
    logError("Treasury", { component: "PUT /api/treasury/configs", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
