// src/app/api/account-categories/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/account-categories
 * Fetch all active account categories for authenticated user
 * Returns: Array<{id, name, created_at}>
 */
type Category = { id: string; name: string; created_at: string };

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = userData.user.id;

    // Fetch categories for this user only
    const { data: categories, error } = await supabase
      .from("account_categories")
      .select("id, name, created_at")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("name", { ascending: true });

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
 * Create account category for user
 * Body: {name: string}
 * Returns: {id, name, created_at}
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = userData.user.id;
    const raw = (await request.json()) as unknown;
    const name = typeof (raw as Record<string, unknown>)?.name === "string" ? (raw as Record<string, unknown>).name as string : "";

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    // Check for duplicates (case-insensitive, per user)
    const nameLower = name.trim().toLowerCase();
    const { data: existing, error: checkError } = await supabase
      .from("account_categories")
      .select("id")
      .eq("user_id", userId)
      .ilike("name", nameLower)
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
      // Category already exists for this user
      return NextResponse.json(
        { error: "already_exists", message: "Category already exists" },
        { status: 409 }
      );
    }

    // Create category for user
    const { data: category, error: createError } = await supabase
      .from("account_categories")
      .insert({
        user_id: userId,
        name: name.trim(),
      })
      .select("id, name, created_at")
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

/**
 * PATCH /api/account-categories
 * Update category name
 * Body: {id: string, name: string}
 * Returns: {id, name, created_at}
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = userData.user.id;
    const raw = await request.json() as unknown;
    const { id, name } = raw as Record<string, unknown>;

    if (!id || !name || !name.toString().trim()) {
      return NextResponse.json(
        { error: "ID and name are required" },
        { status: 400 }
      );
    }

    // Verify ownership
    const { data: existing, error: verifyError } = await supabase
      .from("account_categories")
      .select("id")
      .eq("id", id as string)
      .eq("user_id", userId)
      .single();

    if (verifyError || !existing) {
      return NextResponse.json(
        { error: "Category not found or unauthorized" },
        { status: 404 }
      );
    }

    // Update category
    const { data: updated, error: updateError } = await supabase
      .from("account_categories")
      .update({ name: (name as string).trim() })
      .eq("id", id as string)
      .select("id, name, created_at")
      .single();

    if (updateError) {
      console.error("Error updating category:", updateError);
      return NextResponse.json(
        { error: "Failed to update category" },
        { status: 500 }
      );
    }

    return NextResponse.json(updated);
  } catch (err: unknown) {
    console.error("Error in PATCH /api/account-categories:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/account-categories
 * Soft delete (set deleted_at)
 * Body: {id: string}
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = userData.user.id;
    const raw = await request.json() as unknown;
    const { id } = raw as Record<string, unknown>;

    if (!id) {
      return NextResponse.json(
        { error: "ID is required" },
        { status: 400 }
      );
    }

    // Verify ownership
    const { data: existing, error: verifyError } = await supabase
      .from("account_categories")
      .select("id")
      .eq("id", id as string)
      .eq("user_id", userId)
      .single();

    if (verifyError || !existing) {
      return NextResponse.json(
        { error: "Category not found or unauthorized" },
        { status: 404 }
      );
    }

    // Soft delete
    const { error: deleteError } = await supabase
      .from("account_categories")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id as string);

    if (deleteError) {
      console.error("Error deleting category:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete category" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("Error in DELETE /api/account-categories:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
