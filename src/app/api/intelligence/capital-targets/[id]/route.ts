import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveRouteId } from "@/lib/api/routeParams";

type CapitalTargetType = "real" | "propfirm";
type ManualFieldKey =
  | "manual_monthly_pct"
  | "manual_quarterly_pct"
  | "manual_semiannual_pct"
  | "manual_annual_pct";

type CapitalTargetPatchBody = {
  account_type?: string;
  target_name?: string;
  target_capital?: number | string;
  manual_monthly_pct?: number | string | null;
  manual_quarterly_pct?: number | string | null;
  manual_semiannual_pct?: number | string | null;
  manual_annual_pct?: number | string | null;
};

const TARGET_COLUMNS = [
  "id",
  "account_type",
  "target_name",
  "target_capital",
  "manual_monthly_pct",
  "manual_quarterly_pct",
  "manual_semiannual_pct",
  "manual_annual_pct",
  "manual_updated_at",
  "created_at",
  "updated_at",
].join(", ");

const MANUAL_FIELDS: ManualFieldKey[] = [
  "manual_monthly_pct",
  "manual_quarterly_pct",
  "manual_semiannual_pct",
  "manual_annual_pct",
];

const isMissingTableError = (error: unknown) => {
  const maybe = error as { code?: string; message?: string } | null;
  return (
    maybe?.code === "42P01" ||
    (typeof maybe?.message === "string" &&
      maybe.message.toLowerCase().includes("does not exist"))
  );
};

const isValidTargetType = (value: unknown): value is CapitalTargetType =>
  value === "real" || value === "propfirm";

const parseManualPercent = (value: unknown) => {
  if (value === undefined) {
    return { provided: false as const, value: null as number | null };
  }

  if (value === null || value === "") {
    return { provided: true as const, value: null as number | null };
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return { provided: true as const, error: "must be a valid number" };
    if (value <= -100 || value >= 10000) {
      return { provided: true as const, error: "must be > -100 and < 10000" };
    }
    return { provided: true as const, value };
  }

  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").replace(/%/g, "").trim();
    if (!normalized) {
      return { provided: true as const, value: null as number | null };
    }
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) return { provided: true as const, error: "must be a valid number" };
    if (parsed <= -100 || parsed >= 10000) {
      return { provided: true as const, error: "must be > -100 and < 10000" };
    }
    return { provided: true as const, value: parsed };
  }

  return { provided: true as const, error: "must be a valid number" };
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

    const body = (await request.json()) as CapitalTargetPatchBody;
    const updatePayload: Record<string, unknown> = {};
    let hasManualField = false;

    if (body.account_type !== undefined) {
      const accountType = body.account_type?.trim().toLowerCase();
      if (!isValidTargetType(accountType)) {
        return NextResponse.json(
          { error: "account_type must be real or propfirm" },
          { status: 400 }
        );
      }
      updatePayload.account_type = accountType;
    }

    if (body.target_name !== undefined) {
      const targetName = body.target_name.trim();
      if (!targetName) {
        return NextResponse.json({ error: "target_name is required" }, { status: 400 });
      }
      updatePayload.target_name = targetName;
    }

    if (body.target_capital !== undefined) {
      const targetCapital = Number(body.target_capital);
      if (!Number.isFinite(targetCapital) || targetCapital <= 0) {
        return NextResponse.json(
          { error: "target_capital must be a valid number greater than 0" },
          { status: 400 }
        );
      }
      updatePayload.target_capital = targetCapital;
    }

    for (const field of MANUAL_FIELDS) {
      const parsed = parseManualPercent(body[field]);
      if (parsed.provided) {
        hasManualField = true;
        if ("error" in parsed) {
          return NextResponse.json(
            { error: `${field} ${parsed.error}` },
            { status: 400 }
          );
        }
        updatePayload[field] = parsed.value;
      }
    }

    if (hasManualField) {
      updatePayload.manual_updated_at = new Date().toISOString();
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { error: "No valid fields provided for update" },
        { status: 400 }
      );
    }

    const { data: existingTarget, error: existingError } = await supabase
      .from("intelligence_capital_targets")
      .select("id")
      .eq("id", id)
      .eq("user_id", userData.user.id)
      .is("deleted_at", null)
      .single();

    if (existingError || !existingTarget) {
      return NextResponse.json({ error: "Target not found" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("intelligence_capital_targets")
      .update(updatePayload)
      .eq("id", id)
      .eq("user_id", userData.user.id)
      .select(TARGET_COLUMNS)
      .single();

    if (error) {
      if (isMissingTableError(error)) {
        return NextResponse.json(
          { error: "Missing intelligence_capital_targets table. Run migration 032 first." },
          { status: 500 }
        );
      }
      console.error("Error updating intelligence capital target:", error);
      return NextResponse.json({ error: "Failed to update target" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in PATCH /api/intelligence/capital-targets/[id]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
