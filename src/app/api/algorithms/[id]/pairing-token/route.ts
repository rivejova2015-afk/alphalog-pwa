import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";
import { logAuditFromRequest } from "@/lib/security/auditLog";
import { storeInstanceSecret } from "@/lib/mt5/vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const TOKEN_TTL_MINUTES = 10;

const bodySchema = z.object({
  platform: z.enum(["MT5", "MT4"]).default("MT5"),
}).optional();

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generatePairingToken(): string {
  const raw = crypto.randomBytes(6).toString("hex").toUpperCase();
  return `GOLD-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

export async function POST(request: NextRequest, { params }: Ctx) {
  let createdBotAccountId: string | null = null;
  let createdInstanceRowId: string | null = null;

  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let parsedBody: { platform: "MT5" | "MT4" } = { platform: "MT5" };
    try {
      const raw = await request.json().catch(() => ({}));
      const parsed = bodySchema.safeParse(raw);
      if (parsed.success && parsed.data) parsedBody = parsed.data;
    } catch {
      // body is optional
    }

    const { data: algo, error: algoErr } = await supabase
      .from("algorithms")
      .select("id, name, market_type")
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();

    if (algoErr || !algo) {
      return NextResponse.json({ error: "Algorithm not found" }, { status: 404 });
    }

    const marketType = (algo.market_type ?? "forex") as string;
    if (marketType !== "forex") {
      return NextResponse.json(
        { error: "El token de pairing solo aplica a estrategias forex (MT5/MT4)." },
        { status: 400 }
      );
    }

    const svc = createServiceClient();

    const { data: existingBot } = await svc
      .from("bots")
      .select("id")
      .eq("user_id", user.id)
      .eq("name", "AlphaLog Strategies")
      .maybeSingle();

    let botId = existingBot?.id;
    if (!botId) {
      const { data: newBot, error: botErr } = await svc
        .from("bots")
        .insert({ user_id: user.id, name: "AlphaLog Strategies" })
        .select("id")
        .single();
      if (botErr || !newBot) {
        throw new Error(`bot create failed: ${botErr?.message ?? "unknown"}`);
      }
      botId = newBot.id;
    }

    const placeholderAccountId = `pending-${crypto.randomUUID()}`;
    const { data: botAccount, error: baErr } = await svc
      .from("bot_accounts")
      .insert({
        user_id: user.id,
        bot_id: botId,
        account_id: placeholderAccountId,
        label: `${algo.name} (pending)`,
      })
      .select("id")
      .single();
    if (baErr || !botAccount) {
      throw new Error(`bot_account create failed: ${baErr?.message ?? "unknown"}`);
    }
    createdBotAccountId = botAccount.id;

    const token = generatePairingToken();
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60_000).toISOString();
    const instanceId = crypto.randomUUID();
    const instanceSecret = crypto.randomBytes(32).toString("hex");

    const { data: instance, error: instErr } = await svc
      .from("bot_instances")
      .insert({
        bot_account_id: botAccount.id,
        instance_id: instanceId,
        platform: parsedBody.platform,
        is_paper_mode: false,
        status: "pending",
        pairing_token_hash: hashToken(token),
        pairing_token_used_at: null,
        pairing_token_expires_at: expiresAt,
      })
      .select("id")
      .single();
    if (instErr || !instance) {
      throw new Error(`bot_instance create failed: ${instErr?.message ?? "unknown"}`);
    }
    createdInstanceRowId = instance.id;

    // instance_secret no longer stored in plaintext on the row — encrypted in
    // the lattice vault instead (project='alphalog-mt5', name=<bot_instances.id>).
    await storeInstanceSecret(instance.id, instanceSecret);

    const { error: linkErr } = await supabase
      .from("algorithms")
      .update({ linked_bot_account_id: botAccount.id })
      .eq("id", algo.id)
      .eq("user_id", user.id);
    if (linkErr) {
      throw new Error(`algorithm link failed: ${linkErr.message}`);
    }

    await logAuditFromRequest(
      {
        userId: user.id,
        action: "create",
        resourceType: "pairing_token",
        resourceId: instance.id,
        status: "success",
        changes: { algorithm_id: algo.id, platform: parsedBody.platform, expires_at: expiresAt },
      },
      request
    );

    return NextResponse.json({
      token,
      instance_id: instance.id,
      bot_account_id: botAccount.id,
      expires_at: expiresAt,
      expires_in_minutes: TOKEN_TTL_MINUTES,
      platform: parsedBody.platform,
    }, { status: 201 });

  } catch (err) {
    logError("AlgorithmPairingToken", {
      component: "POST /api/algorithms/[id]/pairing-token",
      message: String(err),
    });
    const svc = createServiceClient();
    if (createdInstanceRowId) {
      await svc.from("bot_instances").delete().eq("id", createdInstanceRowId);
    }
    if (createdBotAccountId) {
      await svc.from("bot_accounts").delete().eq("id", createdBotAccountId);
    }
    return NextResponse.json({ error: "Failed to generate pairing token" }, { status: 500 });
  }
}
