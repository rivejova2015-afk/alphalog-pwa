import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";
import { logAuditFromRequest } from "@/lib/security/auditLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const controlSchema = z.object({
  action: z.enum(["pause", "resume"]),
});

// POST /api/algorithms/[id]/control
// Inserts a bot_commands row of type pause|resume against the deployed bot.
// The Fly bot's CommandPoller picks it up in ≤30s and flips its TRADING_PAUSED
// flag, which surfaces in `algorithms.status` via the bot's own status sync.
export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const parsed = controlSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
    }

    // Confirm ownership + grab the deployment so we know which bot to address.
    const svc = createServiceClient();
    const { data: deployment, error: depErr } = await svc
      .from("algorithm_deployments")
      .select("bot_account_id, bot_accounts(bot_id), algorithms!inner(user_id, market_type, name)")
      .eq("algorithm_id", id)
      .eq("status", "active")
      .maybeSingle();

    if (depErr || !deployment) {
      return NextResponse.json({ error: "No active deployment for this algorithm" }, { status: 404 });
    }
    const algo = deployment.algorithms as { user_id: string; market_type: string; name: string } | null;
    if (!algo || algo.user_id !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const botAcc = deployment.bot_accounts as { bot_id: string } | null;
    if (!botAcc?.bot_id) {
      return NextResponse.json({ error: "Deployment is missing bot_id" }, { status: 500 });
    }

    const { error: insErr, data: cmd } = await svc
      .from("bot_commands")
      .insert({
        bot_id: botAcc.bot_id,
        command_type: parsed.data.action,  // 'pause' | 'resume'
        payload: { algorithm_id: id, source: "ui" },
        target_scope: "account",
        created_by: user.id,
        status: "pending",
      })
      .select("id, command_type, status, created_at")
      .single();

    if (insErr || !cmd) {
      logError("Algorithms", { component: "POST /api/algorithms/[id]/control", message: insErr?.message ?? "insert failed" });
      return NextResponse.json({ error: "Failed to dispatch command" }, { status: 500 });
    }

    await logAuditFromRequest(
      {
        userId: user.id,
        action: "update",
        resourceType: "algorithm",
        resourceId: id,
        status: "success",
        changes: { control: parsed.data.action, command_id: cmd.id },
      },
      request
    );

    return NextResponse.json({
      ok: true,
      command: cmd,
      message: `Command '${parsed.data.action}' dispatched — bot will apply in ≤30s`,
    });
  } catch (err) {
    logError("Algorithms", { component: "POST /api/algorithms/[id]/control", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
