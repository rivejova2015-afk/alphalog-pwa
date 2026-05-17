// src/app/api/tradehub/setups/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { recordBugFromRequest } from "@/lib/security/bugRecorder";
import { enforceResponseContract } from "@/lib/validation/contractGuard";
import { setupResponseSchema } from "@/lib/validation/schemas";
import { logError, logWarn } from "@/lib/log";

/**
 * GET /api/tradehub/setups
 * Returns setups for authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("setups")
      .select("*")
      .eq("user_id", userData.user.id)
      .is("deleted_at", null)
      .order("sort_index", { ascending: true });

    if (error) {
      logError("Setups", { component: "GET", message: "Fetch error", error: error.message });
      return NextResponse.json(
        { error: "Failed to fetch setups" },
        { status: 500 }
      );
    }

    const result = data || [];

    const contractResult = enforceResponseContract(setupResponseSchema.array(), result);
    if (!contractResult.ok) {
      logWarn("Setups", "ContractGuard GET violation", { errors: contractResult.errors });
    }

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' },
    });
  } catch (err: unknown) {
    logError("Setups", { component: "GET", message: "Unexpected error", error: String(err) });
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
 * POST /api/tradehub/setups
 * Create new setup
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    // Check for duplicates (case-insensitive, excluding soft-deleted)
    const { data: existing } = await supabase
      .from("setups")
      .select("id")
      .eq("user_id", userData.user.id)
      .eq("name_lower", name.toLowerCase())
      .is("deleted_at", null)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "Setup with this name already exists" },
        { status: 409 }
      );
    }

    const { data, error } = await supabase
      .from("setups")
      .insert({
        user_id: userData.user.id,
        name,
        description: description || null,
      })
      .select()
      .single();

    if (error) {
      logError("Setups", { component: "POST", message: "Create error", error: error.message });
      return NextResponse.json(
        { error: "Failed to create setup" },
        { status: 500 }
      );
    }

    const contractResult = enforceResponseContract(setupResponseSchema, data);
    if (!contractResult.ok) {
      logWarn("Setups", "ContractGuard POST violation", { errors: contractResult.errors });
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    logError("Setups", { component: "POST", message: "Unexpected error", error: String(err) });
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
