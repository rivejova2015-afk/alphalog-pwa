import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/algorithms/[id]/commands/recent?limit=10
//
// Returns the most recent bot_commands for the algorithm's active deployment,
// joined with bot_command_status so the UI can show ack state (DONE/FAILED/
// PENDING) per command. Used by ControlButton.client.tsx to verify that a
// pause/resume command was actually applied by the bot poller, rather than
// silently dropped if the bot is down or the poller crashed.
//
// Returns 404 if the algorithm has no active deployment (no bot to address).
export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? "10")));

    // Resolve bot_id through the active deployment + verify ownership.
    const svc = createServiceClient();
    const { data: deployment } = await svc
      .from("algorithm_deployments")
      .select("bot_account_id, bot_accounts(bot_id), algorithms!inner(user_id)")
      .eq("algorithm_id", id)
      .eq("status", "active")
      .maybeSingle();

    if (!deployment) return NextResponse.json({ commands: [] });

    const algo = deployment.algorithms as { user_id: string } | null;
    if (!algo || algo.user_id !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const botAcc = deployment.bot_accounts as { bot_id: string } | null;
    if (!botAcc?.bot_id) return NextResponse.json({ commands: [] });

    // Pull last N commands for this bot. The bot may serve other algorithms in
    // the future, but for now coinarb is one-bot-one-algo so this is exact.
    interface CommandRow {
      id: string;
      command_type: string;
      payload: unknown;
      status: string;
      created_at: string;
      updated_at: string;
    }
    interface AckRow {
      command_id: string;
      status: string;
      message: string | null;
      acked_at: string | null;
    }

    const { data: cmdRaw, error: cmdErr } = await svc
      .from("bot_commands")
      .select("id, command_type, payload, status, created_at, updated_at")
      .eq("bot_id", botAcc.bot_id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (cmdErr) {
      logError("Algorithms", { component: "GET commands/recent", message: cmdErr.message });
      return NextResponse.json({ error: cmdErr.message }, { status: 500 });
    }
    const commands = (cmdRaw ?? []) as unknown as CommandRow[];

    const ids = commands.map((c) => c.id);
    let acks: Record<string, Omit<AckRow, 'command_id'>> = {};
    if (ids.length > 0) {
      const { data: ackRaw } = await svc
        .from("bot_command_status")
        .select("command_id, status, message, acked_at")
        .in("command_id", ids);
      const ackRows = (ackRaw ?? []) as unknown as AckRow[];
      acks = Object.fromEntries(
        ackRows.map((r) => [
          r.command_id,
          { status: r.status, message: r.message, acked_at: r.acked_at },
        ]),
      );
    }

    return NextResponse.json({
      commands: commands.map((c) => ({
        id: c.id,
        command_type: c.command_type,
        payload: c.payload,
        status: c.status,  // canonical lifecycle status (PENDING/DONE/FAILED)
        created_at: c.created_at,
        updated_at: c.updated_at,
        ack: acks[c.id] ?? null,
      })),
    }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    logError("Algorithms", { component: "GET commands/recent", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
