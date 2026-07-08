import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import { getPgClient } from "@/lib/pg/client";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pairRequestSchema = z.object({
  pairing_token: z.string().min(8),
  account_number: z.number().int().positive(),
  broker_name: z.string().min(1),
  platform: z.enum(["MT4", "MT5"]),
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/bot/pair
// Called by EA on startup with just one pairing token.
// Returns signal_secret + webhook_secret + instance_id so EA needs zero manual config.
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const parsed = pairRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
    }

    const { pairing_token, account_number, broker_name, platform } = parsed.data;

    // POST from EA has no user session — token hash IS the auth
    const pg = getPgClient();

    // 1. Find the pairing token in bot_instances
    const { data: instanceRaw, error: findErr } = await pg
      .from("bot_instances")
      .select("id, bot_account_id, instance_secret, is_paper_mode, status, pairing_token_hash, pairing_token_used_at, pairing_token_expires_at")
      .eq("pairing_token_hash", hashToken(pairing_token))
      .single();
    const instance = instanceRaw as {
      id: string;
      bot_account_id: string;
      instance_secret: string;
      is_paper_mode: boolean | null;
      status: string;
      pairing_token_hash: string | null;
      pairing_token_used_at: string | null;
      pairing_token_expires_at: string | null;
    } | null;

    if (findErr || !instance) {
      return NextResponse.json({ error: "Token de emparejamiento inválido o no encontrado" }, { status: 401 });
    }

    // 2. One-time use: reject if token was already used at all
    if (instance.pairing_token_used_at) {
      return NextResponse.json({
        error: "Token ya usado. Genera uno nuevo en AlphaLog → Bot Control → Configuración"
      }, { status: 401 });
    }

    // 2b. Reject expired tokens (only enforced when expires_at is set; legacy tokens have NULL)
    if (instance.pairing_token_expires_at && new Date(instance.pairing_token_expires_at) < new Date()) {
      return NextResponse.json({
        error: "Token expirado. Genera uno nuevo desde AlphaLog."
      }, { status: 401 });
    }

    // 3. Generate session secrets for this EA session
    const signalSecret  = crypto.randomBytes(32).toString("hex");
    const webhookSecret = crypto.randomBytes(32).toString("hex");

    // 4. Mark token as used + update instance with broker info + store secrets
    const { error: updateErr } = await pg
      .from("bot_instances")
      .update({
        platform,
        status: "online",
        pairing_token_used_at: new Date().toISOString(),
        last_heartbeat_at: new Date().toISOString(),
        signal_secret_hash: hashToken(signalSecret),
        webhook_secret_hash: hashToken(webhookSecret),
      })
      .eq("id", instance.id);

    if (updateErr) {
      logError("BotPair", { component: "api/bot/pair", message: updateErr.message });
      return NextResponse.json({ error: "Error interno al emparejar" }, { status: 500 });
    }

    // 5. Update bot_accounts with real broker account number
    await pg
      .from("bot_accounts")
      .update({ account_id: String(account_number), label: `${broker_name} #${account_number}` })
      .eq("id", instance.bot_account_id);

    return NextResponse.json({
      ok: true,
      instance_id: instance.id,
      signal_secret: signalSecret,
      webhook_secret: webhookSecret,
      is_paper_mode: instance.is_paper_mode ?? false,
      message: `Emparejado con ${broker_name} #${account_number} (${platform})`,
    }, { status: 200 });

  } catch (error) {
    logError("BotPair", { component: "api/bot/pair", message: error instanceof Error ? error.message : "Unknown" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/bot/pair/generate
// Called from AlphaLog UI to generate a new pairing token for a bot_instance
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const instanceId = request.nextUrl.searchParams.get("instance_id");
    if (!instanceId) {
      return NextResponse.json({ error: "instance_id requerido" }, { status: 400 });
    }

    const pg = getPgClient();

    // bot_instances now lives on our own Postgres, which has no RLS. Ownership was
    // previously enforced by a Supabase RLS policy on this table (joining through
    // bot_accounts.user_id) when queried with the anon/user-session client — that
    // enforcement is gone now, so it's replicated explicitly below via two lookups.
    const { data: instanceRaw, error: findErr } = await pg
      .from("bot_instances")
      .select("id, bot_account_id")
      .eq("id", instanceId)
      .is("deleted_at", null)
      .single();
    const instance = instanceRaw as { id: string; bot_account_id: string } | null;

    if (findErr || !instance) {
      return NextResponse.json({ error: "Instancia no encontrada" }, { status: 404 });
    }

    const { data: botAccountRaw, error: acctErr } = await pg
      .from("bot_accounts")
      .select("id, user_id")
      .eq("id", instance.bot_account_id)
      .single();
    const botAccount = botAccountRaw as { id: string; user_id: string } | null;

    if (acctErr || !botAccount || botAccount.user_id !== user.id) {
      return NextResponse.json({ error: "Instancia no encontrada" }, { status: 404 });
    }

    // Generate short, memorable token: GOLD-XXXX-XXXX
    const raw = crypto.randomBytes(6).toString("hex").toUpperCase();
    const token = `GOLD-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;

    // Store hash (never store raw token server-side)
    const { error: updateErr } = await pg
      .from("bot_instances")
      .update({
        pairing_token_hash: hashToken(token),
        pairing_token_used_at: null,  // reset usage
      })
      .eq("id", instanceId);

    if (updateErr) {
      logError("BotPair", { component: "api/bot/pair/generate", message: updateErr.message });
      return NextResponse.json({ error: "Error al generar token" }, { status: 500 });
    }

    return NextResponse.json({
      token,
      instance_id: instanceId,
      expires_in: "24 horas desde el primer uso",
      instructions: "Ingresa este token en el EA como InpPairingToken. El EA se configurará solo.",
    }, { status: 200 });

  } catch (error) {
    logError("BotPair", { component: "api/bot/pair/generate", message: error instanceof Error ? error.message : "Unknown" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
