import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { accountCreateSchema } from "@/lib/validation/schemas";
import { logError } from "@/lib/log";
import { storeInstanceSecret } from "@/lib/mt5/vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN_TTL_MINUTES = 10;

const requestSchema = accountCreateSchema.extend({
  mt5: z.object({
    platform: z.enum(["MT5"]),
    broker_name: z.string().min(1).max(100),
    label: z.string().min(1).max(80),
  }),
});

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generatePairingToken(): string {
  const raw = crypto.randomBytes(6).toString("hex").toUpperCase();
  return `GOLD-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

export async function POST(request: NextRequest) {
  let createdAccountId: string | null = null;
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = userData.user.id;

  try {
    const rawBody = await request.json();
    const parsed = requestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
    }

    const { mt5, ...accountData } = parsed.data;

    // Verify category exists
    const { data: category, error: catError } = await supabase
      .from("account_categories")
      .select("id")
      .eq("id", accountData.category_id)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single();
    if (catError || !category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    // 1. Create account (RLS-scoped via anon client)
    const { data: account, error: createErr } = await supabase
      .from("accounts")
      .insert({
        user_id: userId,
        name: accountData.name.trim(),
        category_id: accountData.category_id,
        account_size: accountData.account_size ?? null,
        current_balance: accountData.current_balance ?? null,
        operation_state: accountData.operation_state?.trim() || null,
        phase_status: accountData.phase_status?.trim() || null,
        role: accountData.role?.trim() || null,
        withdrawals_enabled: accountData.withdrawals_enabled ?? true,
        currency: accountData.currency?.trim() || "USD",
        status: accountData.status?.trim() || "active",
      })
      .select("*")
      .single();

    if (createErr || !account) {
      logError("AccountsWithMt5", { component: "create-account", message: createErr?.message ?? "unknown" });
      return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
    }
    createdAccountId = account.id;

    // 2. Find or create the user's telemetry bot
    const svc = createServiceClient();
    const { data: existingBot } = await svc
      .from("bots")
      .select("id")
      .eq("user_id", userId)
      .eq("name", "AlphaLog Telemetry")
      .maybeSingle();

    let botId = existingBot?.id;
    if (!botId) {
      const { data: newBot, error: botErr } = await svc
        .from("bots")
        .insert({ user_id: userId, name: "AlphaLog Telemetry" })
        .select("id")
        .single();
      if (botErr || !newBot) {
        throw new Error(`bot create failed: ${botErr?.message ?? "unknown"}`);
      }
      botId = newBot.id;
    }

    // 3. Create bot_account with placeholder account_id (replaced after pairing)
    const placeholderAccountId = `pending-${crypto.randomUUID()}`;
    const { data: botAccount, error: baErr } = await svc
      .from("bot_accounts")
      .insert({
        user_id: userId,
        bot_id: botId,
        account_id: placeholderAccountId,
        label: mt5.label,
        app_account_id: createdAccountId,
      })
      .select("id")
      .single();
    if (baErr || !botAccount) {
      throw new Error(`bot_account create failed: ${baErr?.message ?? "unknown"}`);
    }

    // 4. Create bot_instance with pairing token
    const token = generatePairingToken();
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60_000).toISOString();
    const instanceId = crypto.randomUUID();
    const instanceSecret = crypto.randomBytes(32).toString("hex");

    const { data: instance, error: instErr } = await svc
      .from("bot_instances")
      .insert({
        bot_account_id: botAccount.id,
        instance_id: instanceId,
        platform: mt5.platform,
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

    // instance_secret no longer stored in plaintext on the row — encrypted in
    // the lattice vault instead (project='alphalog-mt5', name=<bot_instances.id>).
    await storeInstanceSecret(instance.id, instanceSecret);

    return NextResponse.json({
      account,
      pairing: {
        token,
        instance_id: instance.id,
        expires_at: expiresAt,
        expires_in_minutes: TOKEN_TTL_MINUTES,
      },
    }, { status: 201 });

  } catch (err) {
    logError("AccountsWithMt5", { component: "POST /api/accounts/with-mt5", message: String(err) });
    // Rollback: soft-delete the created account so we don't leave orphans
    if (createdAccountId) {
      await supabase
        .from("accounts")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", createdAccountId)
        .eq("user_id", userId);
    }
    return NextResponse.json({ error: "Failed to create paired account" }, { status: 500 });
  }
}
