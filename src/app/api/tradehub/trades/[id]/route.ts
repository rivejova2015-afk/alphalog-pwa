// src/app/api/tradehub/trades/[id]/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { decryptText, encryptText } from "@/lib/security/encryption";

/**
 * PATCH /api/tradehub/trades/{id}
 * Update trade or restore from trash
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const { restore, ...updateData } = body;

    // Verify ownership
    const { data: existingTrade } = await supabase
      .from("trades")
      .select("user_id, symbol, direction, status, entry_date, exit_date, entry_price, exit_price, lots, stop_loss_price, take_profit_price, pnl, pnl_percent, notes, setup_id, is_featured_in_report")
      .eq("id", id)
      .single();

    if (!existingTrade) {
      return NextResponse.json(
        { error: "Trade not found" },
        { status: 404 }
      );
    }

    if (existingTrade.user_id !== userData.user.id) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    let updates: any = {};

    if (restore) {
      // Restore from trash
      updates.deleted_at = null;
    } else {
      // Regular update
      updates = {
        symbol: updateData.symbol !== undefined ? updateData.symbol : existingTrade.symbol,
        direction: updateData.direction !== undefined ? updateData.direction : existingTrade.direction,
        status: updateData.status !== undefined ? updateData.status : existingTrade.status,
        entry_date: updateData.entry_date !== undefined ? updateData.entry_date : existingTrade.entry_date,
        exit_date: updateData.exit_date !== undefined ? updateData.exit_date : existingTrade.exit_date,
        entry_price: updateData.entry_price !== undefined ? updateData.entry_price : existingTrade.entry_price,
        exit_price: updateData.exit_price !== undefined ? updateData.exit_price : existingTrade.exit_price,
        lots: updateData.lots !== undefined ? updateData.lots : existingTrade.lots,
        stop_loss_price: updateData.stop_loss_price !== undefined ? updateData.stop_loss_price : existingTrade.stop_loss_price,
        take_profit_price: updateData.take_profit_price !== undefined ? updateData.take_profit_price : existingTrade.take_profit_price,
        pnl: updateData.pnl !== undefined ? updateData.pnl : existingTrade.pnl,
        pnl_percent: updateData.pnl_percent !== undefined ? updateData.pnl_percent : existingTrade.pnl_percent,
        notes: updateData.notes !== undefined ? encryptText(updateData.notes) : existingTrade.notes,
        setup_id: updateData.setup_id !== undefined ? updateData.setup_id : existingTrade.setup_id,
        is_featured_in_report: updateData.is_featured_in_report !== undefined ? updateData.is_featured_in_report : existingTrade.is_featured_in_report,
      };
    }

    const { data, error } = await supabase
      .from("trades")
      .update(updates)
      .eq("id", id)
      .eq("user_id", userData.user.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating trade:", error);
      return NextResponse.json(
        { error: "Failed to update trade" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ...data,
      notes: decryptText(data.notes),
    });
  } catch (err: any) {
    console.error("Error in PATCH /api/tradehub/trades/[id]:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tradehub/trades/{id}
 * Hard-delete trade (cascade evidence + storage)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    // Verify ownership
    const { data: existingTrade } = await supabase
      .from("trades")
      .select("user_id, screenshot_path")
      .eq("id", id)
      .single();

    if (!existingTrade) {
      return NextResponse.json(
        { error: "Trade not found" },
        { status: 404 }
      );
    }

    if (existingTrade.user_id !== userData.user.id) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const { data: evidenceRows, error: evidenceError } = await supabase
      .from("tv_analysis_evidence")
      .select("id, image_path")
      .eq("user_id", userData.user.id)
      .eq("trade_id", id);

    if (evidenceError) {
      console.error("Error fetching evidence for trade delete:", evidenceError);
      return NextResponse.json(
        { error: "Failed to delete trade evidence" },
        { status: 500 }
      );
    }

    const evidencePaths = (evidenceRows || [])
      .map((row: { image_path?: string | null }) => row.image_path)
      .filter(Boolean) as string[];

    if (evidencePaths.length > 0) {
      try {
        await supabase.storage.from("log_attachments").remove(evidencePaths);
      } catch (storageErr) {
        console.warn("Warning: Failed to delete evidence files:", storageErr);
      }
    }

    if (evidenceRows && evidenceRows.length > 0) {
      const evidenceIds = evidenceRows.map((row: { id: string }) => row.id);
      await supabase
        .from("tv_analysis_evidence")
        .delete()
        .in("id", evidenceIds)
        .eq("user_id", userData.user.id);
    }

    if (existingTrade?.screenshot_path) {
      try {
        await supabase.storage.from("log_attachments").remove([existingTrade.screenshot_path]);
      } catch (storageErr) {
        console.warn("Warning: Failed to delete trade screenshot:", storageErr);
      }
    }

    const { error } = await supabase
      .from("trades")
      .delete()
      .eq("id", id)
      .eq("user_id", userData.user.id);

    if (error) {
      console.error("Error deleting trade:", error);
      return NextResponse.json(
        { error: "Failed to delete trade" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Error in DELETE /api/tradehub/trades/[id]:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
