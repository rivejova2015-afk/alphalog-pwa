import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type CapitalTargetType = "real" | "propfirm";
type ManualFieldKey =
  | "manual_monthly_pct"
  | "manual_quarterly_pct"
  | "manual_semiannual_pct"
  | "manual_annual_pct";

type CapitalTargetRequestBody = {
  account_type?: string;
  target_name?: string;
  target_capital?: number | string;
  manual_monthly_pct?: number | string | null;
  manual_quarterly_pct?: number | string | null;
  manual_semiannual_pct?: number | string | null;
  manual_annual_pct?: number | string | null;
  custom_current_capital?: number | string | null;
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
  "custom_current_capital",
  "custom_current_updated_at",
  "created_at",
  "updated_at",
].join(", ");

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

const MANUAL_FIELDS: ManualFieldKey[] = [
  "manual_monthly_pct",
  "manual_quarterly_pct",
  "manual_semiannual_pct",
  "manual_annual_pct",
];

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

const parseCustomCurrentCapital = (value: unknown) => {
  if (value === undefined) {
    return { provided: false as const, value: null as number | null };
  }

  if (value === null || value === "") {
    return { provided: true as const, value: null as number | null };
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) {
      return { provided: true as const, error: "custom_current_capital must be a valid number greater than 0" };
    }
    return { provided: true as const, value };
  }

  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").trim();
    if (!normalized) {
      return { provided: true as const, value: null as number | null };
    }
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return { provided: true as const, error: "custom_current_capital must be a valid number greater than 0" };
    }
    return { provided: true as const, value: parsed };
  }

  return { provided: true as const, error: "custom_current_capital must be a valid number greater than 0" };
};

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("intelligence_capital_targets")
      .select(TARGET_COLUMNS)
      .eq("user_id", userData.user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      if (isMissingTableError(error)) {
        return NextResponse.json([]);
      }
      console.error("Error fetching intelligence capital targets:", error);
      return NextResponse.json({ error: "Failed to fetch targets" }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error("Error in GET /api/intelligence/capital-targets:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as CapitalTargetRequestBody;

    const accountType = body.account_type?.trim().toLowerCase();
    if (!isValidTargetType(accountType)) {
      return NextResponse.json(
        { error: "account_type must be real or propfirm" },
        { status: 400 }
      );
    }

    const targetName = body.target_name?.trim();
    if (!targetName) {
      return NextResponse.json({ error: "target_name is required" }, { status: 400 });
    }

    const targetCapital = Number(body.target_capital);
    if (!Number.isFinite(targetCapital) || targetCapital <= 0) {
      return NextResponse.json(
        { error: "target_capital must be a valid number greater than 0" },
        { status: 400 }
      );
    }

    const manualPayload: Partial<Record<ManualFieldKey, number | null>> = {};
    let hasManualField = false;
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
        manualPayload[field] = parsed.value;
      }
    }

    const customCurrent = parseCustomCurrentCapital(body.custom_current_capital);
    if ("error" in customCurrent) {
      return NextResponse.json({ error: customCurrent.error }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("intelligence_capital_targets")
      .insert({
        user_id: userData.user.id,
        account_type: accountType,
        target_name: targetName,
        target_capital: targetCapital,
        ...manualPayload,
        manual_updated_at: hasManualField ? new Date().toISOString() : null,
        custom_current_capital: customCurrent.value,
        custom_current_updated_at:
          customCurrent.provided && customCurrent.value !== null ? new Date().toISOString() : null,
      })
      .select(TARGET_COLUMNS)
      .single();

    if (error) {
      if (isMissingTableError(error)) {
        return NextResponse.json(
          { error: "Missing intelligence_capital_targets table. Run migration 032 first." },
          { status: 500 }
        );
      }
      console.error("Error creating intelligence capital target:", error);
      return NextResponse.json({ error: "Failed to save target" }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/intelligence/capital-targets:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
