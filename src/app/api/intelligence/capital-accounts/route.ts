import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordBugFromRequest } from "@/lib/security/bugRecorder";

type CapitalType = "real" | "propfirm";

type CapitalAccountRequestBody = {
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

const isMissingTableError = (error: unknown) => {
  const maybe = error as { code?: string; message?: string } | null;
  return (
    maybe?.code === "42P01" ||
    (typeof maybe?.message === "string" &&
      maybe.message.toLowerCase().includes("does not exist"))
  );
};

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

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("intelligence_capital_accounts")
      .select(CAPITAL_ACCOUNT_COLUMNS)
      .eq("user_id", userData.user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      if (isMissingTableError(error)) {
        return NextResponse.json([]);
      }
      console.error("Error fetching intelligence capital accounts:", error);
      return NextResponse.json({ error: "Failed to fetch capital accounts" }, { status: 500 });
    }

    return NextResponse.json(data || [], {
      headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' },
    });
  } catch (error) {
    console.error("Error in GET /api/intelligence/capital-accounts:", error);
    await recordBugFromRequest(request, {
      userId: null,
      status: 500,
      error,
    });
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

    const body = (await request.json()) as CapitalAccountRequestBody;
    const accountType = body.account_type?.trim().toLowerCase();
    if (!isValidType(accountType)) {
      return NextResponse.json({ error: "account_type must be real or propfirm" }, { status: 400 });
    }

    const accountName = body.account_name?.trim();
    if (!accountName) {
      return NextResponse.json({ error: "account_name is required" }, { status: 400 });
    }

    const currentCapital = parsePositiveNumber(body.current_capital);
    if (currentCapital === null) {
      return NextResponse.json(
        { error: "current_capital must be a valid number greater than 0" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("intelligence_capital_accounts")
      .insert({
        user_id: userData.user.id,
        account_type: accountType,
        account_name: accountName,
        current_capital: currentCapital,
      })
      .select(CAPITAL_ACCOUNT_COLUMNS)
      .single();

    if (error) {
      if (isMissingTableError(error)) {
        return NextResponse.json(
          { error: "Missing intelligence_capital_accounts table. Run migration 036 first." },
          { status: 500 }
        );
      }
      console.error("Error creating intelligence capital account:", error);
      return NextResponse.json({ error: "Failed to create capital account" }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/intelligence/capital-accounts:", error);
    await recordBugFromRequest(request, {
      userId: null,
      status: 500,
      error,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
