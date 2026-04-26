import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { createClient, createServiceClient } from "@/lib/supabase/server";
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

    // POST from EA has no user session — use service client; token hash IS the auth
    const svc = createServiceClient();

    // 1. Find the pairing token in bot_instances
    const { data: instance, error: findErr } = await svc
      .from("bot_instances")
      .select("id, bot_account_id, instance_secret, is_paper_mode, status, pairing_token_hash, pairing_token_used_at")
      .eq("pairing_token_hash", hashToken(pairing_token))
      .maybeSingle();

    if (findErr || !instance) {
      return NextResponse.json({ error: "Token de emparejamiento inválido o no encontrado" }, { status: 401 });
    }

    // 2. One-time use: reject if token was already used at all
    if (instance.pairing_token_used_at) {
      return NextResponse.json({
        error: "Token ya usado. Genera uno nuevo en AlphaLog → Bot Control → Configuración"
      }, { status: 401 });
    }

    // 3. Generate session secrets for this EA session
    const signalSecret  = crypto.randomBytes(32).toString("hex");
    const webhookSecret = crypto.randomBytes(32).toString("hex");

    // 4. Mark token as used + update instance with broker info + store secrets
    const { error: updateErr } = await svc
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
    await svc
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

    // Verify ownership via RLS (anon client with user session) + exclude deleted
    const { data: instance, error: findErr } = await supabase
      .from("bot_instances")
      .select("id, bot_account_id")
      .eq("id", instanceId)
      .is("deleted_at", null)
      .maybeSingle();

    if (findErr || !instance) {
      return NextResponse.json({ error: "Instancia no encontrada" }, { status: 404 });
    }

    // Generate short, memorable token: GOLD-XXXX-XXXX
    const raw = crypto.randomBytes(6).toString("hex").toUpperCase();
    const token = `GOLD-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;

    // Store hash (never store raw token server-side)
    const { error: updateErr } = await supabase
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
