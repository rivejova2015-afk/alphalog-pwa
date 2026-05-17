// src/app/api/tradehub/trades/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { decryptText, encryptText, encryptNumeric, decryptNumeric } from "@/lib/security/encryption";
import { mirrorTradeOnCreate } from "@/lib/copygroups/mirroring";
import { onTradeClosedSaved } from "@/lib/tradermap/progressEngine";
import { logAuditFromRequest } from "@/lib/security/auditLog";
import { tradeCreateSchema, tradeResponseSchema, validatePayloadSafe, validationErrorResponse } from "@/lib/validation/schemas";
import { recordBugFromRequest } from "@/lib/security/bugRecorder";
import { asString } from "@/lib/validation/nullGuards";
import { autoFixTradeCreate } from "@/lib/validation/autoFix";
import { enforceResponseContract } from "@/lib/validation/contractGuard";
import { logError, logWarn } from "@/lib/log";

/**
 * GET /api/tradehub/trades
 * Returns trades filtered by user, account, and trash status
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const accountId = url.searchParams.get("accountId");
    const setupId = url.searchParams.get("setupId");
    const trash = url.searchParams.get("trash") === "true";
    const status = url.searchParams.get("status");
    const closedOnly = url.searchParams.get("closedOnly") === "true";
    const range = url.searchParams.get("range");
    const limit = Number(url.searchParams.get("limit") || 50);
    const offset = Number(url.searchParams.get("offset") || 0);

    let dateFrom: string | null = null;
    if (range && range !== "all") {
      const today = new Date();
      const startOfYear = new Date(today.getFullYear(), 0, 1);
      const daysMap: Record<string, number> = {
        "30": 30,
        "90": 90,
        "120": 120,
        "365": 365,
      };

      if (range === "ytd") {
        dateFrom = startOfYear.toISOString().slice(0, 10);
      } else if (daysMap[range]) {
        const d = new Date();
        d.setDate(d.getDate() - daysMap[range]);
        dateFrom = d.toISOString().slice(0, 10);
      }
    }

    let query = supabase
      .from("trades")
      .select("*, account:accounts(id, name), setup:setups(id, name)")
      .eq("user_id", userData.user.id)
      .order("exit_date", { ascending: false });

    if (accountId) {
      query = query.eq("account_id", accountId);
    }

    if (setupId) {
      query = query.eq("setup_id", setupId);
    }

    if (trash) {
      query = query.not("deleted_at", "is", null);
    } else {
      query = query.is("deleted_at", null);
    }

    if (status) {
      query = query.ilike("status", status);
    }

    if (closedOnly) {
      query = query.not("exit_date", "is", null);
    }

    if (dateFrom) {
      query = query.gte("exit_date", dateFrom);
    }

    if (Number.isFinite(limit) && limit > 0) {
      const from = Math.max(0, offset);
      const to = from + limit - 1;
      query = query.range(from, to);
    }

    const { data, error } = await query;

    if (error) {
      logError("TradeHub", { component: "GET trades", message: "Fetch error", error: error.message });
      await recordBugFromRequest(request, {
        userId: userData.user.id,
        status: 500,
        error,
        payload: { accountId, setupId, trash, status, closedOnly, range },
      });
      const baseData = (data ?? {}) as Record<string, unknown>;
      const responsePayload = {
        ...baseData,
        notes: decryptText(asString((data as { notes?: unknown } | null)?.notes)),
      };

      const responseCheck = enforceResponseContract(tradeResponseSchema, responsePayload);

      if (!responseCheck.ok) {
        await recordBugFromRequest(request, {
          userId: userData.user.id,
          status: 500,
          error: new Error("Response contract violation"),
          payload: { errors: responseCheck.errors },
        });

        return NextResponse.json(
          { error: "Internal server error" },
          { status: 500 }
        );
      }

      return NextResponse.json(responseCheck.data, {
        headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
      });
    }

    const decrypted = (data || []).map((trade: any) => ({
      ...trade,
      notes: decryptText(asString(trade.notes)),
      pnl: decryptNumeric("trades", trade.pnl_enc, trade.pnl),
      entry_price: decryptNumeric("trades", trade.entry_price_enc, trade.entry_price),
      exit_price: decryptNumeric("trades", trade.exit_price_enc, trade.exit_price),
      pnl_percent: decryptNumeric("trades", trade.pnl_percent_enc, trade.pnl_percent),
    }));

    return NextResponse.json(decrypted, {
      headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
    });
  } catch (err: unknown) {
    logError("TradeHub", { component: "GET trades", message: "Unexpected error", error: String(err) });
    await recordBugFromRequest(request, {
      userId: null,
      status: 500,
      error: err,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tradehub/trades
 * Create new trade
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const fixed = autoFixTradeCreate(body as Record<string, unknown>);

    if (fixed.changed) {
      logAuditFromRequest(
        {
          userId: userData.user.id,
          action: "api_call",
          resourceType: "trade",
          status: "partial",
          changes: { auto_fix: fixed.changes },
        },
        request
      ).catch(e => logWarn("TradeHub", "Audit: failed to log auto-fix", { error: String(e) }));
    }

    const validation = validatePayloadSafe(tradeCreateSchema, fixed.data);

    if (!validation.success) {
      logAuditFromRequest(
        {
          userId: userData.user.id,
          action: "api_call",
          resourceType: "trade",
          status: "failure",
          errorMessage: `Validation failed: ${Object.values(validation.errors).join("; ")}`,
        },
        request
      ).catch(e => logWarn("TradeHub", "Audit: failed to log validation error", { error: String(e) }));

      return NextResponse.json(
        validationErrorResponse(validation.errors),
        { status: 400 }
      );
    }

    const {
      account_id,
      symbol,
      direction,
      status,
      entry_date,
      exit_date,
      entry_price,
      exit_price,
      lots,
      stop_loss_price,
      take_profit_price,
      pnl,
      pnl_percent,
      notes,
      setup_id,
      is_featured_in_report,
    } = validation.data;

    // Verify account exists and belongs to user
    const { data: account } = await supabase
      .from("accounts")
      .select("id")
      .eq("id", account_id)
      .eq("user_id", userData.user.id)
      .single();

    if (!account) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    // Verify setup exists if provided
    if (setup_id) {
      const { data: setup } = await supabase
        .from("setups")
        .select("id")
        .eq("id", setup_id)
        .eq("user_id", userData.user.id)
        .single();

      if (!setup) {
        return NextResponse.json(
          { error: "Setup not found" },
          { status: 404 }
        );
      }
    }

    const { data, error } = await supabase
      .from("trades")
      .insert({
        user_id: userData.user.id,
        account_id,
        symbol,
        direction,
        status,
        entry_date,
        exit_date,
        entry_price,
        exit_price,
        lots,
        stop_loss_price,
        take_profit_price,
        pnl,
        pnl_percent,
        notes: encryptText(notes),
        setup_id,
        is_featured_in_report: is_featured_in_report || false,
        pnl_enc: encryptNumeric("trades", pnl),
        entry_price_enc: encryptNumeric("trades", entry_price),
        exit_price_enc: encryptNumeric("trades", exit_price),
        pnl_percent_enc: encryptNumeric("trades", pnl_percent),
      })
      .select()
      .single();

    if (error) {
      logError("TradeHub", { component: "POST trades", message: "Create error", error: error.message });
      await recordBugFromRequest(request, {
        userId: userData.user.id,
        status: 500,
        error,
        payload: { account_id, symbol, direction, status },
      });
      return NextResponse.json(
        { error: "Failed to create trade" },
        { status: 500 }
      );
    }

    try {
      await mirrorTradeOnCreate({
        supabase,
        masterTrade: data,
        userId: userData.user.id,
      });
    } catch (mirrorError) {
      logWarn("TradeHub", "Mirroring failed", { error: String(mirrorError) });
    }

    const progressUpdate = await onTradeClosedSaved(supabase, userData.user.id, {
      id: data.id,
      account_id: data.account_id,
      status: data.status,
      exit_date: data.exit_date,
    });

    logAuditFromRequest(
      {
        userId: userData.user.id,
        action: "create",
        resourceType: "trade",
        resourceId: data.id,
        changes: {
          symbol,
          direction,
          account_id,
        },
      },
      request
    ).catch(e => logWarn("TradeHub", "Audit: failed to log trade create", { error: String(e) }));

    return NextResponse.json({
      ...data,
      notes: decryptText(data.notes),
      progress_update: progressUpdate,
    });
  } catch (err: unknown) {
    logError("TradeHub", { component: "POST trades", message: "Unexpected error", error: String(err) });
    await recordBugFromRequest(request, {
      userId: null,
      status: 500,
      error: err,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
