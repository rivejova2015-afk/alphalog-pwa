import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import { safeCompareTokens } from "@/lib/security/timing";
import { enforceResponseContract } from "@/lib/validation/contractGuard";
import { logAuditFromRequest } from "@/lib/security/auditLog";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────────────────────

const closedTradeSchema = z.object({
  ticket: z.number().int(),
  direction: z.enum(["BUY", "SELL"]),
  lots: z.number().positive(),
  open_price: z.number().positive(),
  close_price: z.number().positive(),
  pnl: z.number(),
  max_adverse_excursion: z.number().nonnegative(),
  open_time: z.string(),
  close_time: z.string(),
});

const openPositionSchema = z.object({
  ticket: z.number().int(),
  symbol: z.string().min(1),
  direction: z.enum(["BUY", "SELL"]),
  lots: z.number().positive(),
  open_price: z.number().positive(),
  current_price: z.number().positive(),
  profit: z.number(),
  sl: z.number().optional(),
  tp: z.number().optional(),
  open_time: z.string(),
});

const webhookSchema = z.object({
  symbol: z.literal("XAUUSD"),
  platform: z.enum(["MT4", "MT5"]),
  bid: z.number(),
  ask: z.number(),
  last: z.number(),
  balance: z.number().nonnegative(),
  equity: z.number().nonnegative(),
  positions_total: z.number().int().min(0),
  positions_buy: z.number().int().min(0),
  positions_sell: z.number().int().min(0),
  tick_volume: z.number().nonnegative(),
  bot_instance_id: z.string().uuid(),
  closed_trade: closedTradeSchema.optional(),
  open_positions: z.array(openPositionSchema).optional(),
});

const responseSchema = z.object({
  received: z.boolean(),
  is_paper: z.boolean(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Replay protection (5 min window)
// ─────────────────────────────────────────────────────────────────────────────

const replayCache = new Map<string, number>();
const REPLAY_WINDOW_MS = 5 * 60 * 1000;

function checkReplay(signature: string): boolean {
  const now = Date.now();
  const lastSeen = replayCache.get(signature);

  if (lastSeen && now - lastSeen < REPLAY_WINDOW_MS) {
    return false; // Replay detected
  }

  replayCache.set(signature, now);

  // Cleanup old entries
  for (const [sig, timestamp] of replayCache.entries()) {
    if (now - timestamp > REPLAY_WINDOW_MS * 2) {
      replayCache.delete(sig);
    }
  }

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/webhooks/mt
// Unified webhook for MT4/MT5 telemetry and closed trade reporting
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    // ── Read body — use raw text so HMAC matches EA's signed bytes ─────────
    let rawBody: string;
    let body: unknown;
    try {
      rawBody = await request.text();
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // ── 1. HMAC verification (Bearer token check via signature) ──────────────
    const signature = request.headers.get("x-signature");
    if (!signature) {
      return NextResponse.json(
        { error: "Missing X-Signature header" },
        { status: 401 }
      );
    }

    const webhookSecret = process.env.MT5_WEBHOOK_SECRET || "";
    if (!webhookSecret) {
      logError("WebhookMT", {
        component: "api/webhooks/mt",
        message: "MT5_WEBHOOK_SECRET not configured",
      });
      return NextResponse.json(
        { error: "Server misconfiguration" },
        { status: 500 }
      );
    }

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    if (!safeCompareTokens(signature, expectedSignature)) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // ── 2. Replay protection ────────────────────────────────────────────────
    if (!checkReplay(signature)) {
      logError("WebhookMT", {
        component: "api/webhooks/mt",
        message: "Replay attack detected",
      });
      return NextResponse.json(
        { error: "Request replay detected" },
        { status: 429 }
      );
    }

    // ── 3. Zod validation ───────────────────────────────────────────────────
    const parsed = webhookSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const supabase = await createClient();

    // ── 4. UPDATE bot_instances platform if needed ──────────────────────────
    const { error: updateInstanceErr } = await supabase
      .from("bot_instances")
      .update({ platform: data.platform, last_heartbeat_at: new Date().toISOString() })
      .eq("id", data.bot_instance_id);

    if (updateInstanceErr) {
      logError("WebhookMT", {
        component: "api/webhooks/mt",
        message: `Failed to update bot_instance: ${updateInstanceErr.message}`,
      });
    }

    // ── 5. Get is_paper_mode from bot_instances ────────────────────────────
    const { data: instance, error: getInstanceErr } = await supabase
      .from("bot_instances")
      .select("is_paper_mode, bot_account_id")
      .eq("id", data.bot_instance_id)
      .single();

    if (getInstanceErr || !instance) {
      return NextResponse.json(
        { error: "Bot instance not found" },
        { status: 404 }
      );
    }

    const isPaperMode = instance.is_paper_mode ?? false;

    // ── 6. UPDATE bot_telemetry ─────────────────────────────────────────────
    const { error: telemetryErr } = await supabase
      .from("bot_telemetry")
      .upsert(
        {
          bot_account_id: instance.bot_account_id,
          instance_id: data.bot_instance_id,
          equity: data.equity,
          balance: data.balance,
          positions_total: data.positions_total,
          positions_buy: data.positions_buy,
          positions_sell: data.positions_sell,
          last_heartbeat_ts: new Date().toISOString(),
          payload: {
            symbol: data.symbol,
            bid: data.bid,
            ask: data.ask,
            last: data.last,
            tick_volume: data.tick_volume,
          },
        },
        { onConflict: "bot_account_id" }
      );

    if (telemetryErr) {
      logError("WebhookMT", {
        component: "api/webhooks/mt",
        message: `Telemetry update warning: ${telemetryErr.message}`,
      });
    }

    // ── 7. If closed_trade: INSERT into trades or paper_trades ─────────────
    if (data.closed_trade) {
      const tableName = isPaperMode ? "paper_trades" : "trades";

      // Get user_id from bot_instances join chain
      const { data: accountData } = await supabase
        .from("bot_accounts")
        .select("*")
        .eq("id", instance.bot_account_id)
        .single();

      if (accountData) {
        const { error: insertErr } = await supabase.from(tableName).insert({
          user_id: accountData.user_id,
          account_id: accountData.app_account_id,
          symbol: "XAUUSD",
          direction: data.closed_trade.direction,
          status: "closed",
          entry_price: data.closed_trade.open_price,
          exit_price: data.closed_trade.close_price,
          lots: data.closed_trade.lots,
          pnl: data.closed_trade.pnl,
          pnl_percent: data.balance > 0 ? data.closed_trade.pnl / data.balance : 0,
          entry_date: data.closed_trade.open_time,
          exit_date: data.closed_trade.close_time,
          stop_loss_price: null,
          take_profit_price: null,
          notes: `Ticket: ${data.closed_trade.ticket}, MAE: ${data.closed_trade.max_adverse_excursion}, Platform: ${data.platform}`,
        });

        if (insertErr) {
          logError("WebhookMT", {
            component: "api/webhooks/mt",
            message: `Trade insert warning: ${insertErr.message}`,
          });
        } else {
          // For live trades: update current_equity in bot_signal_engine_state
          if (!isPaperMode) {
            const today = new Date().toISOString().split("T")[0];
            try {
              await supabase
                .from("bot_signal_engine_state")
                .update({ current_equity: data.equity })
                .eq("bot_instance_id", data.bot_instance_id)
                .eq("session_date", today);
            } catch (err) {
              logError("WebhookMT", {
                component: "api/webhooks/mt",
                message: `Equity update warning: ${err instanceof Error ? err.message : String(err)}`,
              });
            }
          }
        }

        // Mark specific closed_trade ticket as closed in bot_open_positions
        const ct = data.closed_trade;
        await supabase
          .from("bot_open_positions")
          .update({
            status: "closed",
            close_price: ct.close_price,
            profit: ct.pnl,
            closed_at: ct.close_time,
            last_updated_at: new Date().toISOString(),
          })
          .eq("bot_account_id", instance.bot_account_id)
          .eq("ticket", ct.ticket);
      }
    }

    // ── 7b. Upsert open_positions if provided ──────────────────────────────
    if (data.open_positions !== undefined) {
      const { data: accountData } = await supabase
        .from("bot_accounts")
        .select("user_id")
        .eq("id", instance.bot_account_id)
        .single();

      if (accountData) {
        // Lookup linked algorithm_id
        const { data: algoRow } = await supabase
          .from("algorithms")
          .select("id")
          .eq("linked_bot_account_id", instance.bot_account_id)
          .is("deleted_at", null)
          .maybeSingle();

        const now = new Date().toISOString();

        if (data.open_positions.length > 0) {
          const { error: upsertErr } = await supabase
            .from("bot_open_positions")
            .upsert(
              data.open_positions.map((p) => ({
                user_id: accountData.user_id,
                bot_account_id: instance.bot_account_id,
                algorithm_id: algoRow?.id ?? null,
                ticket: p.ticket,
                symbol: p.symbol,
                direction: p.direction,
                lots: p.lots,
                open_price: p.open_price,
                current_price: p.current_price,
                profit: p.profit,
                sl: p.sl ?? null,
                tp: p.tp ?? null,
                open_time: p.open_time,
                status: "open",
                last_updated_at: now,
              })),
              { onConflict: "bot_account_id,ticket" }
            );

          if (upsertErr) {
            logError("WebhookMT", {
              component: "api/webhooks/mt",
              message: `Open positions upsert warning: ${upsertErr.message}`,
            });
          }

          // Mark positions that are no longer open as closed
          const openTickets = data.open_positions.map((p) => p.ticket);
          await supabase
            .from("bot_open_positions")
            .update({ status: "closed", closed_at: now, last_updated_at: now })
            .eq("bot_account_id", instance.bot_account_id)
            .eq("status", "open")
            .not("ticket", "in", `(${openTickets.join(",")})`);
        } else {
          // Empty array = all positions closed
          await supabase
            .from("bot_open_positions")
            .update({ status: "closed", closed_at: now, last_updated_at: now })
            .eq("bot_account_id", instance.bot_account_id)
            .eq("status", "open");
        }
      }
    }

    // ── 8. Response with contract guard ────────────────────────────────────
    const responsePayload = {
      received: true,
      is_paper: isPaperMode,
    };

    const contractResult = enforceResponseContract(responseSchema, responsePayload);
    if (!contractResult.ok) {
      logError("WebhookMT", {
        component: "api/webhooks/mt",
        message: "Response contract violation",
        error: JSON.stringify(contractResult.errors),
      });
    }

    // ── 9. Audit log ────────────────────────────────────────────────────────
    logAuditFromRequest(
      {
        userId: "mt-ea-system",
        action: "webhook",
        resourceType: "bot_signal_engine_state",
        status: "success",
        changes: {
          platform: data.platform,
          hasClosedTrade: !!data.closed_trade,
          isPaperMode,
        },
      },
      request
    ).catch(() => undefined);

    return NextResponse.json(responsePayload, { status: 200 });
  } catch (error) {
    logError("WebhookMT", {
      component: "api/webhooks/mt",
      action: "POST",
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
