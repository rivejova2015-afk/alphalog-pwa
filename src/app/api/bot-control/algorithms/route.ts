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
  const {
    name,
    instrument,
    marketType,
    direction,
    platform,
    linkedBotAccountId,
    lotSize,
    maxTrades,
    riskPercent,
    parameters,
    engineConfig,
    scanConfig,
  } = body as {
    name: string;
    instrument: string[];
    marketType: string;
    direction: string;
    platform: string;
    linkedBotAccountId: string | null;
    lotSize: number;
    maxTrades: number;
    riskPercent: number;
    parameters: Record<string, unknown>;
    engineConfig: Record<string, unknown>;
    scanConfig: Record<string, unknown>;
  };

  if (!name || !name.trim()) {
    return NextResponse.json({ error: "Missing required field: name" }, { status: 400 });
  }

  const pg = getPgClient();

  const { data: created, error } = await pg
    .from("algorithms")
    .insert({
      user_id: user.id,
      name: name.trim(),
      instrument,
      market_type: marketType,
      direction,
      platform,
      linked_bot_account_id: marketType === "forex" ? linkedBotAccountId ?? null : null,
      lot_size: lotSize,
      max_trades: maxTrades,
      risk_percent: riskPercent,
      parameters,
      engine_config: engineConfig,
      scan_config: scanConfig ?? {},
      status: "paused",
    })
    .select("id")
    .single();

  if (error || !created) {
    return NextResponse.json({ error: error?.message ?? "Failed to create algorithm" }, { status: 500 });
  }

  return NextResponse.json({ id: (created as unknown as { id: string }).id });
}
