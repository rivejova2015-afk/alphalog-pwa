import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";
import { logAuditFromRequest } from "@/lib/security/auditLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  name:        z.string().min(1).max(80).optional(),
  description: z.string().max(500).optional(),
  status:      z.enum(["draft", "paper", "approved", "live", "paused", "archived"]).optional(),
  parameters:  z.record(z.string(), z.unknown()).optional(),
});

// GET /api/algorithms/[id]
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("trading_algorithms")
      .select(`
        *,
        deployments:algorithm_deployments(
          id, status, bot_account_id,
          bot_accounts(label, account_id)
        )
      `)
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ algorithm: data });
  } catch (err) {
    logError("Algorithms", { component: "GET /api/algorithms/[id]", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/algorithms/[id]
export async function PUT(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

    const payload: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) payload.name = parsed.data.name;
    if (parsed.data.description !== undefined) payload.description = parsed.data.description;
    if (parsed.data.status !== undefined) payload.status = parsed.data.status;
    if (parsed.data.parameters !== undefined) payload.parameters = parsed.data.parameters;

    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("trading_algorithms")
      .update(payload)
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .select()
      .maybeSingle();

    if (error || !data) return NextResponse.json({ error: "Not found or update failed" }, { status: 404 });

    // When parameters are updated, send a bot_command so the EA picks them up
    if (parsed.data.parameters !== undefined) {
      try {
        const svc = createServiceClient();
        const { data: deployment } = await svc
          .from("algorithm_deployments")
          .select("bot_account_id, bot_accounts(bot_id)")
          .eq("algorithm_id", id)
          .eq("status", "active")
          .maybeSingle();

        if (deployment?.bot_accounts) {
          const botAccounts = deployment.bot_accounts as { bot_id: string } | null;
          if (botAccounts?.bot_id) {
            await svc.from("bot_commands").insert({
              bot_id: botAccounts.bot_id,
              command_type: "update_parameters",
              payload: { algorithm_id: id, parameters: parsed.data.parameters },
              target_scope: "account",
              created_by: user.id,
              status: "pending",
            });
          }
        }
      } catch { /* non-critical — bot may not be connected */ }
    }

    return NextResponse.json({ algorithm: data });
  } catch (err) {
    logError("Algorithms", { component: "PUT /api/algorithms/[id]", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/algorithms/[id]  (soft-delete)
export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { error } = await supabase
      .from("trading_algorithms")
      .update({ deleted_at: new Date().toISOString(), status: "archived" })
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await logAuditFromRequest(
      { userId: user.id, action: "delete", resourceType: "trade", resourceId: id, status: "success" },
      req
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    logError("Algorithms", { component: "DELETE /api/algorithms/[id]", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
