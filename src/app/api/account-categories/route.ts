// src/app/api/account-categories/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

type Category = { id: string; name: string; description: string | null; created_at: string };

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return unauthorized();
    }

    const userId = userData.user.id;

    const { data: categories, error } = await supabase
      .from("account_categories")
      .select("id, name, description, created_at")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("name_lower", { ascending: true });

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

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return unauthorized();
    }

    const userId = userData.user.id;
    const raw = (await request.json()) as unknown;
    const body = raw as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description =
      typeof body.description === "string" && body.description.trim()
        ? body.description.trim()
        : null;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const { data: category, error: createError } = await supabase
      .from("account_categories")
      .insert({
        user_id: userId,
        name,
        description,
      })
      .select("id, name, description, created_at")
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

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return unauthorized();
    }

    const userId = userData.user.id;
    const raw = (await request.json()) as unknown;
    const { id, name, description } = raw as Record<string, unknown>;

    if (!id || typeof id !== "string" || !name || !name.toString().trim()) {
      return NextResponse.json(
        { error: "ID and name are required" },
        { status: 400 }
      );
    }

    const trimmedName = name.toString().trim();
    const trimmedDescription =
      typeof description === "string" && description.trim()
        ? description.trim()
        : null;

    const { data: existing, error: verifyError } = await supabase
      .from("account_categories")
      .select("id")
      .eq("id", id)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single();

    if (verifyError || !existing) {
      return NextResponse.json(
        { error: "Category not found or unauthorized" },
        { status: 404 }
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from("account_categories")
      .update({ name: trimmedName, description: trimmedDescription })
      .eq("id", id)
      .select("id, name, description, created_at")
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

type DeleteBody = {
  id: string;
  reassignTo?: string | null;
  createNew?: { name: string; description?: string | null } | null;
};

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return unauthorized();
    }

    const userId = userData.user.id;
    const raw = (await request.json()) as unknown as DeleteBody;
    const { id, reassignTo, createNew } = raw ?? {};

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const { data: existing, error: verifyError } = await supabase
      .from("account_categories")
      .select("id")
      .eq("id", id)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single();

    if (verifyError || !existing) {
      return NextResponse.json(
        { error: "Category not found or unauthorized" },
        { status: 404 }
      );
    }

    // Count accounts using this category
    const { data: accountsUsing, error: countError } = await supabase
      .from("accounts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("category_id", id)
      .is("deleted_at", null);

    if (countError) {
      console.error("Error counting accounts for category:", countError);
      return NextResponse.json(
        { error: "Failed to validate category usage" },
        { status: 500 }
      );
    }

    const accountsCount = accountsUsing?.length ?? 0;
    let targetCategoryId: string | null = null;

    if (accountsCount > 0) {
      // Need a target category
      if (reassignTo) {
        // Validate target belongs to user
        const { data: target, error: targetError } = await supabase
          .from("account_categories")
          .select("id")
          .eq("id", reassignTo)
          .eq("user_id", userId)
          .is("deleted_at", null)
          .single();

        if (targetError || !target) {
          return NextResponse.json(
            { error: "Target category not found" },
            { status: 404 }
          );
        }
        targetCategoryId = target.id;
      } else if (createNew?.name) {
        const trimmedName = createNew.name.trim();
        const trimmedDescription = createNew.description?.trim?.() || null;
        if (!trimmedName) {
          return NextResponse.json(
            { error: "Name is required for new category" },
            { status: 400 }
          );
        }

        const { data: newCategory, error: createCatError } = await supabase
          .from("account_categories")
          .insert({
            user_id: userId,
            name: trimmedName,
            description: trimmedDescription,
          })
          .select("id")
          .single();

        if (createCatError || !newCategory) {
          console.error("Error creating category during reassignment:", createCatError);
          return NextResponse.json(
            { error: "Failed to create target category" },
            { status: 500 }
          );
        }
        targetCategoryId = newCategory.id;
      } else {
        return NextResponse.json(
          { error: "reassign_required" },
          { status: 400 }
        );
      }

      // Reassign accounts
      const { error: reassignError } = await supabase
        .from("accounts")
        .update({ category_id: targetCategoryId })
        .eq("user_id", userId)
        .eq("category_id", id)
        .is("deleted_at", null);

      if (reassignError) {
        console.error("Error reassigning accounts:", reassignError);
        return NextResponse.json(
          { error: "Failed to reassign accounts" },
          { status: 500 }
        );
      }
    }

    // Soft delete original category
    const { error: deleteError } = await supabase
      .from("account_categories")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId);

    if (deleteError) {
      console.error("Error deleting category:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete category" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, targetCategoryId });
  } catch (err: unknown) {
    console.error("Error in DELETE /api/account-categories:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
