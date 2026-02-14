// src/app/api/tradehub/trades/[id]/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { decryptText, encryptText } from "@/lib/security/encryption";
import { mirrorTradeOnUpdate } from "@/lib/copygroups/mirroring";
import { onTradeClosedSaved } from "@/lib/tradermap/progressEngine";
import { logAuditFromRequest } from "@/lib/security/auditLog";
import { tradeUpdateResponseSchema, tradeUpdateSchema, validatePayloadSafe, validationErrorResponse } from "@/lib/validation/schemas";
import { autoFixTradeUpdate } from "@/lib/validation/autoFix";
import { recordBugFromRequest } from "@/lib/security/bugRecorder";
import { asString } from "@/lib/validation/nullGuards";
import { enforceResponseContract } from "@/lib/validation/contractGuard";
import { resolveRouteId } from "@/lib/api/routeParams";

/**
 * PATCH /api/tradehub/trades/{id}
 * Update trade or restore from trash
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id?: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = userData.user.id;
    const id = await resolveRouteId(context);
    if (!id) {
      return NextResponse.json(
        { error: "Invalid resource id" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const fixed = autoFixTradeUpdate(body as Record<string, unknown>);

    if (fixed.changed) {
      logAuditFromRequest(
        {
          userId,
          action: "api_call",
          resourceType: "trade",
          resourceId: id,
          status: "partial",
          changes: { auto_fix: fixed.changes },
        },
        request
      ).catch(e => console.warn("[Audit] Failed to log auto-fix:", e));
    }

    const validation = validatePayloadSafe(tradeUpdateSchema, fixed.data);

    if (!validation.success) {
      logAuditFromRequest(
        {
          userId,
          action: "api_call",
          resourceType: "trade",
          resourceId: id,
          status: "failure",
          errorMessage: `Validation failed: ${Object.values(validation.errors).join("; ")}`,
        },
        request
      ).catch(e => console.warn("[Audit] Failed to log validation error:", e));

      return NextResponse.json(
        validationErrorResponse(validation.errors),
        { status: 400 }
      );
    }

    const { restore, ...updateData } = validation.data;

    // Verify ownership
    const { data: existingTrade, error: tradeError } = await supabase
      .from("trades")
      .select("id, user_id, account_id, symbol, direction, status, entry_date, exit_date, entry_price, exit_price, lots, stop_loss_price, take_profit_price, pnl, pnl_percent, notes, setup_id, is_featured_in_report")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (tradeError || !existingTrade) {
      return NextResponse.json(
        { error: "Trade not found" },
        { status: 404 }
      );
    }

    if (updateData.account_id) {
      const { data: account, error: accountError } = await supabase
        .from("accounts")
        .select("id")
        .eq("id", updateData.account_id)
        .eq("user_id", userId)
        .single();

      if (accountError || !account) {
        return NextResponse.json(
          { error: "Account not found" },
          { status: 404 }
        );
      }
    }

    if (updateData.setup_id) {
      const { data: setup, error: setupError } = await supabase
        .from("setups")
        .select("id")
        .eq("id", updateData.setup_id)
        .eq("user_id", userId)
        .single();

      if (setupError || !setup) {
        return NextResponse.json(
          { error: "Setup not found" },
          { status: 404 }
        );
      }
    }

    let updates: any = {};

    if (restore) {
      // Restore from trash
      updates.deleted_at = null;
    } else {
      // Regular update
      updates = {
        account_id: updateData.account_id !== undefined ? updateData.account_id : existingTrade.account_id,
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
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      console.error("Error updating trade:", error);
      return NextResponse.json(
        { error: "Failed to update trade" },
        { status: 500 }
      );
    }

    if (!restore) {
      try {
        await mirrorTradeOnUpdate({
          supabase,
          masterTrade: data,
          userId,
        });
      } catch (mirrorError) {
        console.warn("[TradeHub] Mirroring update failed:", mirrorError);
      }
    }

    const progressUpdate = await onTradeClosedSaved(supabase, userId, {
      id: data.id,
      account_id: data.account_id,
      status: data.status,
      exit_date: data.exit_date,
    });

    if (!restore) {
      const changeKeys = Object.keys(updateData).filter(
        k => updateData[k as keyof typeof updateData] !== (existingTrade as Record<string, unknown>)[k]
      );
      if (changeKeys.length > 0) {
        logAuditFromRequest(
          {
            userId,
            action: "update",
            resourceType: "trade",
            resourceId: id,
            changes: changeKeys.reduce((acc, k) => {
              acc[k] = { before: (existingTrade as Record<string, unknown>)[k], after: updateData[k as keyof typeof updateData] };
              return acc;
            }, {} as Record<string, unknown>),
          },
          request
        ).catch(e => console.warn("[Audit] Failed to log trade update:", e));
      }
    } else {
      logAuditFromRequest(
        {
          userId,
          action: "update",
          resourceType: "trade",
          resourceId: id,
          changes: { restored: true },
        },
        request
      ).catch(e => console.warn("[Audit] Failed to log trade restore:", e));
    }

    const responsePayload = {
      ...data,
      notes: decryptText(asString(data.notes)),
      progress_update: progressUpdate,
    };

    const responseCheck = enforceResponseContract(tradeUpdateResponseSchema, responsePayload);

    if (!responseCheck.ok) {
      await recordBugFromRequest(request, {
        userId,
        status: 500,
        error: new Error("Response contract violation"),
        payload: { errors: responseCheck.errors },
      });

      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }

    return NextResponse.json(responseCheck.data);
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
  context: { params: Promise<{ id?: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = userData.user.id;
    const id = await resolveRouteId(context);
    if (!id) {
      return NextResponse.json(
        { error: "Invalid resource id" },
        { status: 400 }
      );
    }

    // Verify ownership
    const { data: existingTrade, error: tradeError } = await supabase
      .from("trades")
      .select("user_id, screenshot_path")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (tradeError || !existingTrade) {
      return NextResponse.json(
        { error: "Trade not found" },
        { status: 404 }
      );
    }

    const isMissingTable = (error: any) =>
      error?.code === "42P01" ||
      (typeof error?.message === "string" && error.message.toLowerCase().includes("does not exist"));

    const { data: evidenceRows, error: evidenceError } = await supabase
      .from("tv_analysis_evidence")
      .select("id, image_path")
      .eq("user_id", userId)
      .eq("trade_id", id);

    if (evidenceError && !isMissingTable(evidenceError)) {
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
        .eq("user_id", userId);
    }

    const { data: reportEvidenceRows, error: reportEvidenceError } = await supabase
      .from("trade_evidence")
      .select("id, file_path")
      .eq("user_id", userId)
      .eq("trade_id", id);

    if (reportEvidenceError && !isMissingTable(reportEvidenceError)) {
      console.error("Error fetching trade_evidence for trade delete:", reportEvidenceError);
      return NextResponse.json(
        { error: "Failed to delete trade evidence" },
        { status: 500 }
      );
    }

    const reportPaths = (reportEvidenceRows || [])
      .map((row: { file_path?: string | null }) => row.file_path)
      .filter(Boolean) as string[];

    if (reportPaths.length > 0) {
      try {
        await supabase.storage.from("log_attachments").remove(reportPaths);
      } catch (storageErr) {
        console.warn("Warning: Failed to delete report evidence files:", storageErr);
      }
    }

    if (reportEvidenceRows && reportEvidenceRows.length > 0) {
      const reportIds = reportEvidenceRows.map((row: { id: string }) => row.id);
      await supabase
        .from("trade_evidence")
        .delete()
        .in("id", reportIds)
        .eq("user_id", userId);
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
      .eq("user_id", userId);

    if (error) {
      console.error("Error deleting trade:", error);
      return NextResponse.json(
        { error: "Failed to delete trade" },
        { status: 500 }
      );
    }

    logAuditFromRequest(
      {
        userId,
        action: "delete",
        resourceType: "trade",
        resourceId: id,
      },
      request
    ).catch(e => console.warn("[Audit] Failed to log trade delete:", e));

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Error in DELETE /api/tradehub/trades/[id]:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
