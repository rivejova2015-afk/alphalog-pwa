import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveRouteId } from "@/lib/api/routeParams";
import { logError } from "@/lib/log";

type CapitalType = "real" | "propfirm";

type CapitalAccountPatchBody = {
  account_type?: string;
  account_name?: string;
  current_capital?: number | string;
};

const CAPITAL_ACCOUNT_COLUMNS = [
  "id",
  "account_type",
  "account_name",
  "current_capital",
  "created_at",
  "updated_at",
].join(", ");

const isValidType = (value: unknown): value is CapitalType =>
  value === "real" || value === "propfirm";

const parsePositiveNumber = (value: unknown) => {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
};

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id?: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return unauthorized();
    }

    const id = await resolveRouteId(context);
    if (!id) {
      return NextResponse.json({ error: "Invalid resource id" }, { status: 400 });
    }

    const { data: existing, error: existingError } = await supabase
      .from("intelligence_capital_accounts")
      .select("id")
      .eq("id", id)
      .eq("user_id", userData.user.id)
      .is("deleted_at", null)
      .single();

    if (existingError || !existing) {
      return NextResponse.json({ error: "Capital account not found" }, { status: 404 });
    }

    const body = (await request.json()) as CapitalAccountPatchBody;
    const updates: Record<string, unknown> = {};

    if (body.account_type !== undefined) {
      const accountType = body.account_type.trim().toLowerCase();
      if (!isValidType(accountType)) {
        return NextResponse.json({ error: "account_type must be real or propfirm" }, { status: 400 });
      }
      updates.account_type = accountType;
    }

    if (body.account_name !== undefined) {
      const accountName = body.account_name.trim();
      if (!accountName) {
        return NextResponse.json({ error: "account_name is required" }, { status: 400 });
      }
      updates.account_name = accountName;
    }

    if (body.current_capital !== undefined) {
      const currentCapital = parsePositiveNumber(body.current_capital);
      if (currentCapital === null) {
        return NextResponse.json(
          { error: "current_capital must be a valid number greater than 0" },
          { status: 400 }
        );
      }
      updates.current_capital = currentCapital;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields provided for update" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("intelligence_capital_accounts")
      .update(updates)
      .eq("id", id)
      .eq("user_id", userData.user.id)
      .select(CAPITAL_ACCOUNT_COLUMNS)
      .single();

    if (error) {
      logError("IntelligenceCapitalAccounts", { component: "intelligence.capital-accounts.[id]", message: "Error updating intelligence capital account:", error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json({ error: "Failed to update capital account" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    logError("IntelligenceCapitalAccounts", { component: "intelligence.capital-accounts.[id]", message: "Error in PATCH /api/intelligence/capital-accounts/[id]:", error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _: NextRequest,
  context: { params: Promise<{ id?: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return unauthorized();
    }

    const id = await resolveRouteId(context);
    if (!id) {
      return NextResponse.json({ error: "Invalid resource id" }, { status: 400 });
    }

    const { data: existing, error: existingError } = await supabase
      .from("intelligence_capital_accounts")
      .select("id")
      .eq("id", id)
      .eq("user_id", userData.user.id)
      .is("deleted_at", null)
      .single();

    if (existingError || !existing) {
      return NextResponse.json({ error: "Capital account not found" }, { status: 404 });
    }

    const now = new Date().toISOString();

    const { error: clearTargetLinksError } = await supabase
      .from("intelligence_capital_targets")
      .update({ capital_account_id: null })
      .eq("user_id", userData.user.id)
      .eq("capital_account_id", id)
      .is("deleted_at", null);

    if (clearTargetLinksError) {
      logError("IntelligenceCapitalAccounts", { component: "intelligence.capital-accounts.[id]", message: "Error clearing target links for deleted capital account:", error: clearTargetLinksError instanceof Error ? clearTargetLinksError.message : String(clearTargetLinksError) });
      return NextResponse.json({ error: "Failed to unlink related targets" }, { status: 500 });
    }

    const { error } = await supabase
      .from("intelligence_capital_accounts")
      .update({ deleted_at: now })
      .eq("id", id)
      .eq("user_id", userData.user.id);

    if (error) {
      logError("IntelligenceCapitalAccounts", { component: "intelligence.capital-accounts.[id]", message: "Error deleting intelligence capital account:", error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json({ error: "Failed to delete capital account" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("IntelligenceCapitalAccounts", { component: "intelligence.capital-accounts.[id]", message: "Error in DELETE /api/intelligence/capital-accounts/[id]:", error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
