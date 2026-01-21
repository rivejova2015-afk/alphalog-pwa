// src/app/api/tradehub/trades/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

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
    const trash = url.searchParams.get("trash") === "true";

    let query = supabase
      .from("trades")
      .select("*, account:accounts(id, name), setup:setups(id, name)")
      .eq("user_id", userData.user.id)
      .order("created_at", { ascending: false });

    if (accountId) {
      query = query.eq("account_id", accountId);
    }

    if (trash) {
      query = query.not("deleted_at", "is", null);
    } else {
      query = query.is("deleted_at", null);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching trades:", error);
      return NextResponse.json(
        { error: "Failed to fetch trades" },
        { status: 500 }
      );
    }

    return NextResponse.json(data || []);
  } catch (err: unknown) {
    console.error("Error in GET /api/tradehub/trades:", err);
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
    } = body;

    // Validate required fields
    if (
      !account_id ||
      !symbol ||
      !direction ||
      !status ||
      !entry_date ||
      entry_price == null ||
      exit_price == null ||
      !lots ||
      !stop_loss_price ||
      !take_profit_price ||
      pnl_percent == null
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

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
        notes,
        setup_id,
        is_featured_in_report: is_featured_in_report || false,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating trade:", error);
      return NextResponse.json(
        { error: "Failed to create trade" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error("Error in POST /api/tradehub/trades:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
