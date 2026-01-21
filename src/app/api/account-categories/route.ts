// src/app/api/account-categories/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/account-categories
 * Fetch all active account categories for user
 * Returns: Array<{id, name}>
 */
type Category = { id: string; name: string };

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: categories, error } = await supabase
      .from("account_categories")
      .select("id, name")
      .eq("user_id", userData.user.id)
      .is("deleted_at", null)
      .order("sort_index", { ascending: true });

    if (error) {
      console.error("Error fetching categories:", error);
      return NextResponse.json(
        { error: "Failed to fetch categories" },
        { status: 500 }
      );
    }

    return NextResponse.json(categories || []);
  } catch (err: unknown) {
    console.error("Error in GET /api/account-categories:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/account-categories
 * Create account category (with anti-duplicados check)
 * Body: {name: string}
 * Returns: {id, name}
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const raw = (await request.json()) as unknown;
    const name = typeof (raw as Record<string, unknown>)?.name === "string" ? (raw as Record<string, unknown>).name as string : "";

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    // Check for duplicates (case-insensitive)
    const nameLower = name.toLowerCase();
    const { data: existing, error: checkError } = await supabase
      .from("account_categories")
      .select("id")
      .eq("user_id", userData.user.id)
      .eq("name_lower", nameLower)
      .is("deleted_at", null)
      .single();

    if (checkError && checkError.code !== "PGRST116") {
      // PGRST116 = no rows returned (expected)
      console.error("Error checking duplicates:", checkError);
      return NextResponse.json(
        { error: "Failed to check for duplicates" },
        { status: 500 }
      );
    }

    if (existing) {
      // Category already exists
      return NextResponse.json(
        { error: "already_exists", message: "Category already exists" },
        { status: 409 }
      );
    }

    // Create category
    const { data: category, error: createError } = await supabase
      .from("account_categories")
      .insert({
        user_id: userData.user.id,
        name: name.trim(),
      })
      .select("id, name")
      .single();

    if (createError) {
      console.error("Error creating category:", createError);
      return NextResponse.json(
        { error: "Failed to create category" },
        { status: 500 }
      );
    }

    return NextResponse.json(category, { status: 201 });
  } catch (err: unknown) {
    console.error("Error in POST /api/account-categories:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
