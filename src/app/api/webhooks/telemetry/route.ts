import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { getPgClient } from "@/lib/pg/client";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Heartbeat payload from AlphaLogTelemetry EA. Pure account telemetry, no signal/symbol data.
const telemetrySchema = z.object({
  bot_instance_id: z.string().uuid(),
  balance: z.number(),
  equity: z.number(),
  positions_total: z.number().int().nonnegative().optional().default(0),
  positions_buy: z.number().int().nonnegative().optional().default(0),
  positions_sell: z.number().int().nonnegative().optional().default(0),
});

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    const webhookSecret = request.headers.get("x-webhook-secret");
    if (!webhookSecret) {
      return NextResponse.json({ error: "Missing webhook secret" }, { status: 401 });
    }

    let body: unknown;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const parsed = telemetrySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
    }
    const { bot_instance_id, balance, equity, positions_total, positions_buy, positions_sell } = parsed.data;

    const svc = createServiceClient();
    const pg = getPgClient();

    // Look up instance + bot_account. bot_instances/bot_accounts now live on our own
    // Postgres (no cross-table embed support in the pg shim), so this is split into
    // two sequential lookups instead of the original single embedded-select call.
    const { data: instanceRaw, error: findErr } = await pg
      .from("bot_instances")
      .select("id, instance_id, webhook_secret_hash, bot_account_id")
      .eq("id", bot_instance_id)
      .single();
    const instance = instanceRaw as {
      id: string;
      instance_id: string;
      webhook_secret_hash: string | null;
      bot_account_id: string;
    } | null;

    if (findErr || !instance || !instance.webhook_secret_hash) {
      return NextResponse.json({ error: "Instance not found or not paired" }, { status: 404 });
    }

    const expectedHash = Buffer.from(instance.webhook_secret_hash, "hex");
    const providedHash = Buffer.from(hashToken(webhookSecret), "hex");
    if (expectedHash.length !== providedHash.length || !crypto.timingSafeEqual(expectedHash, providedHash)) {
      return NextResponse.json({ error: "Invalid webhook secret" }, { status: 401 });
    }

    const { data: botAccountRaw, error: acctErr } = await pg
      .from("bot_accounts")
      .select("id, user_id, app_account_id")
      .eq("id", instance.bot_account_id)
      .single();
    const botAccount = botAccountRaw as { id: string; user_id: string; app_account_id: string | null } | null;
    if (acctErr || !botAccount) {
      return NextResponse.json({ error: "Bot account missing" }, { status: 500 });
    }

    const now = new Date().toISOString();

    // Upsert telemetry (one row per bot_account). bot_telemetry is NOT one of the
    // 16 in-scope tables for this migration batch — stays on Supabase.
    await svc
      .from("bot_telemetry")
      .upsert({
        bot_account_id: botAccount.id,
        instance_id: instance.instance_id,
        balance,
        equity,
        positions_total,
        positions_buy,
        positions_sell,
        last_heartbeat_ts: now,
        payload: { balance, equity, positions_total, positions_buy, positions_sell, ts: now },
      }, { onConflict: "bot_account_id" });

    // Update heartbeat on instance for staleness tracking
    await pg
      .from("bot_instances")
      .update({ last_heartbeat_at: now, status: "online" })
      .eq("id", instance.id);

    // Sync balance to the linked AlphaLog account (if user opted in to vinculation)
    if (botAccount.app_account_id) {
      await pg
        .from("accounts")
        .update({ current_balance: balance, updated_at: now })
        .eq("id", botAccount.app_account_id)
        .eq("user_id", botAccount.user_id);
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    logError("WebhookTelemetry", { component: "POST /api/webhooks/telemetry", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
