import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type CapitalTargetType = "real" | "propfirm";

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

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("intelligence_capital_targets")
      .select("id, account_type, target_name, target_capital, created_at, updated_at")
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

    const body = (await request.json()) as {
      account_type?: string;
      target_name?: string;
      target_capital?: number | string;
    };

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

    const { data, error } = await supabase
      .from("intelligence_capital_targets")
      .insert({
        user_id: userData.user.id,
        account_type: accountType,
        target_name: targetName,
        target_capital: targetCapital,
      })
      .select("id, account_type, target_name, target_capital, created_at, updated_at")
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
