/**
 * POST /api/cron/security/backfill-encryption
 *
 * Phase B one-shot migration: encrypt existing plaintext financial fields in
 * batches. Processes up to 50 rows per call. Run repeatedly until each table's
 * `remaining` count drops to 0, then stop calling it.
 *
 * NOT scheduled in crontab — by design. This is an ops-driven endpoint,
 * invoked manually (or from a one-shot Fly machine) after a deploy that adds
 * a new encrypted field. Adding it to the recurring schedule would keep
 * scanning fully-encrypted tables forever for no work.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { encryptNumeric, encryptForDomain } from "@/lib/security/encryption";
import { safeCompareTokens } from "@/lib/security/timing";

const BATCH_SIZE = 50;

export async function POST(request: NextRequest) {
  const cronSecret = request.headers.get("x-cron-secret");
  const expected = process.env.CRON_SECRET;
  if (!safeCompareTokens(cronSecret, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const svc = await createServiceClient();
  const summary: Record<string, { processed: number; remaining: number }> = {};

  // --- Trades: backfill pnl_enc, entry_price_enc, exit_price_enc, pnl_percent_enc ---
  const { data: trades, error: tradesErr } = await svc
    .from("trades")
    .select("id, pnl, entry_price, exit_price, pnl_percent")
    .is("pnl_enc", null)
    .not("pnl", "is", null)
    .limit(BATCH_SIZE);

  if (!tradesErr && trades && trades.length > 0) {
    for (const trade of trades) {
      await svc
        .from("trades")
        .update({
          pnl_enc: encryptNumeric("trades", trade.pnl),
          entry_price_enc: encryptNumeric("trades", trade.entry_price),
          exit_price_enc: encryptNumeric("trades", trade.exit_price),
          pnl_percent_enc: encryptNumeric("trades", trade.pnl_percent),
        })
        .eq("id", trade.id);
    }

    const { count: remaining } = await svc
      .from("trades")
      .select("id", { count: "exact", head: true })
      .is("pnl_enc", null)
      .not("pnl", "is", null);

    summary.trades = { processed: trades.length, remaining: remaining ?? 0 };
  } else {
    summary.trades = { processed: 0, remaining: 0 };
  }

  // --- Treasury payouts: backfill amount_enc ---
  const { data: payouts, error: payoutsErr } = await svc
    .from("treasury_payouts")
    .select("id, amount, notes")
    .is("amount_enc", null)
    .not("amount", "is", null)
    .limit(BATCH_SIZE);

  if (!payoutsErr && payouts && payouts.length > 0) {
    for (const payout of payouts) {
      const update: Record<string, string | null> = {
        amount_enc: encryptNumeric("treasury", payout.amount),
      };
      // Also encrypt plaintext notes that aren't already encrypted
      if (payout.notes && !payout.notes.startsWith("enc:")) {
        update.notes = encryptForDomain("treasury", payout.notes);
      }
      await svc.from("treasury_payouts").update(update).eq("id", payout.id);
    }

    const { count: remaining } = await svc
      .from("treasury_payouts")
      .select("id", { count: "exact", head: true })
      .is("amount_enc", null)
      .not("amount", "is", null);

    summary.treasury_payouts = {
      processed: payouts.length,
      remaining: remaining ?? 0,
    };
  } else {
    summary.treasury_payouts = { processed: 0, remaining: 0 };
  }

  const totalRemaining = Object.values(summary).reduce(
    (acc, s) => acc + s.remaining,
    0
  );

  return NextResponse.json({
    ok: true,
    summary,
    done: totalRemaining === 0,
  });
}
