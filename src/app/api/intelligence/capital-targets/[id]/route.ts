import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveRouteId } from "@/lib/api/routeParams";
import { logError } from "@/lib/log";

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
  capital_account_id?: string | null;
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
  "capital_account_id",
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

const MANUAL_FIELDS: ManualFieldKey[] = [
  "manual_monthly_pct",
  "manual_quarterly_pct",
  "manual_semiannual_pct",
  "manual_annual_pct",
];

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isMissingSchemaError = (error: unknown) => {
  const maybe = error as { code?: string; message?: string } | null;
  const message = typeof maybe?.message === "string" ? maybe.message.toLowerCase() : "";
  return (
    maybe?.code === "42P01" ||
    maybe?.code === "42703" ||
    message.includes("does not exist")
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

const parseCapitalAccountId = (value: unknown) => {
  if (value === undefined) {
    return { provided: false as const, value: null as string | null };
  }

  if (value === null || value === "") {
    return { provided: true as const, value: null as string | null };
  }

  if (typeof value !== "string") {
    return { provided: true as const, error: "capital_account_id must be a valid UUID" };
  }

  const normalized = value.trim();
  if (!UUID_REGEX.test(normalized)) {
    return { provided: true as const, error: "capital_account_id must be a valid UUID" };
  }

  return { provided: true as const, value: normalized };
};

async function validateCapitalAccountLink(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  capitalAccountId: string,
  expectedType: CapitalTargetType
) {
  const { data, error } = await supabase
    .from("intelligence_capital_accounts")
    .select("id, account_type")
    .eq("id", capitalAccountId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .single();

  if (error || !data) {
    return { ok: false as const, error: "La cuenta de capital seleccionada no existe." };
  }

  if (data.account_type !== expectedType) {
    return {
      ok: false as const,
      error: "La cuenta de capital no coincide con el tipo seleccionado (real/propfirm).",
    };
  }

  return { ok: true as const };
}

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
    let parsedAccountType: CapitalTargetType | undefined;

    if (body.account_type !== undefined) {
      const accountType = body.account_type?.trim().toLowerCase();
      if (!isValidTargetType(accountType)) {
        return NextResponse.json(
          { error: "account_type must be real or propfirm" },
          { status: 400 }
        );
      }
      parsedAccountType = accountType;
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

    const customCurrent = parseCustomCurrentCapital(body.custom_current_capital);
    if ("error" in customCurrent) {
      return NextResponse.json({ error: customCurrent.error }, { status: 400 });
    }
    if (customCurrent.provided) {
      updatePayload.custom_current_capital = customCurrent.value;
      updatePayload.custom_current_updated_at =
        customCurrent.value === null ? null : new Date().toISOString();
    }

    const capitalAccount = parseCapitalAccountId(body.capital_account_id);
    if ("error" in capitalAccount) {
      return NextResponse.json({ error: capitalAccount.error }, { status: 400 });
    }
    if (capitalAccount.provided) {
      updatePayload.capital_account_id = capitalAccount.value;
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
      .select("id, account_type, capital_account_id")
      .eq("id", id)
      .eq("user_id", userData.user.id)
      .is("deleted_at", null)
      .single();

    if (existingError || !existingTarget) {
      return NextResponse.json({ error: "Target not found" }, { status: 404 });
    }

    const finalAccountType = parsedAccountType ?? (existingTarget.account_type as CapitalTargetType);
    const finalCapitalAccountId =
      capitalAccount.provided
        ? capitalAccount.value
        : (existingTarget.capital_account_id as string | null);

    if (finalCapitalAccountId) {
      const validation = await validateCapitalAccountLink(
        supabase,
        userData.user.id,
        finalCapitalAccountId,
        finalAccountType
      );
      if (!validation.ok) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
    }

    const { data, error } = await supabase
      .from("intelligence_capital_targets")
      .update(updatePayload)
      .eq("id", id)
      .eq("user_id", userData.user.id)
      .select(TARGET_COLUMNS)
      .single();

    if (error) {
      if (isMissingSchemaError(error)) {
        return NextResponse.json(
          { error: "Missing intelligence capital schema. Run migrations 032, 033, 035 and 036." },
          { status: 500 }
        );
      }
      logError("IntelligenceCapitalTargets", { component: "intelligence.capital-targets.[id]", message: "Error updating intelligence capital target:", error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json({ error: "Failed to update target" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    logError("IntelligenceCapitalTargets", { component: "intelligence.capital-targets.[id]", message: "Error in PATCH /api/intelligence/capital-targets/[id]:", error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
