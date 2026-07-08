import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPgClient } from "@/lib/pg/client";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { botId, commandType, targetAccountIds, payload } = body as {
    botId: string;
    commandType: string;
    targetAccountIds?: string[];
    payload?: Record<string, unknown>;
  };

  if (!botId || !commandType) {
    return NextResponse.json(
      { error: "Missing required fields: botId, commandType" },
      { status: 400 },
    );
  }

  const pg = getPgClient();

  const { data: command, error: commandError } = await pg
    .from("bot_commands")
    .insert({
      bot_id: botId,
      command_type: commandType,
      payload: payload ?? {},
      target_scope: targetAccountIds ? "accounts" : "all",
      created_by: user.id,
      status: "PENDING",
    })
    .select("id")
    .single();

  if (commandError || !command) {
    return NextResponse.json(
      { error: commandError?.message ?? "Failed to create command" },
      { status: 500 },
    );
  }

  const commandRow = command as unknown as { id: string };

  const targetIds = targetAccountIds ?? [];
  if (targetIds.length > 0) {
    const statusRows = targetIds.map((accountId) => ({
      command_id: commandRow.id,
      bot_account_id: accountId,
      status: "PENDING",
    }));
    const { error: statusError } = await pg.from("bot_command_status").insert(statusRows);
    if (statusError) {
      return NextResponse.json({ error: statusError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ id: commandRow.id });
}
