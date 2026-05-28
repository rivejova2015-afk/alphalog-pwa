// src/app/api/account-categories/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { recordBugFromRequest } from "@/lib/security/bugRecorder";
import { logAuditFromRequest } from "@/lib/security/auditLog";
import { logError } from "@/lib/log";

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
      logError("AccountCategories", { component: "account-categories", message: "Error fetching categories:", error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json(
        { error: "Failed to fetch categories" },
        { status: 500 }
      );
    }

    return NextResponse.json(categories || [], {
      headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' },
    });
  } catch (err: unknown) {
    logError("AccountCategories", { component: "account-categories", message: "Error in GET /api/account-categories:", error: err instanceof Error ? err.message : String(err) });
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
      logError("AccountCategories", { component: "account-categories", message: "Error creating category:", error: createError instanceof Error ? createError.message : String(createError) });
      return NextResponse.json(
        { error: "Failed to create category" },
        { status: 500 }
      );
    }

    await logAuditFromRequest(
      { userId, action: "create", resourceType: "account_category", resourceId: category.id, status: "success" },
      request
    );

    return NextResponse.json(category, { status: 201 });
  } catch (err: unknown) {
    logError("AccountCategories", { component: "account-categories", message: "Error in POST /api/account-categories:", error: err instanceof Error ? err.message : String(err) });
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
      logError("AccountCategories", { component: "account-categories", message: "Error updating category:", error: updateError instanceof Error ? updateError.message : String(updateError) });
      return NextResponse.json(
        { error: "Failed to update category" },
        { status: 500 }
      );
    }

    await logAuditFromRequest(
      { userId, action: "update", resourceType: "account_category", resourceId: id, status: "success" },
      request
    );

    return NextResponse.json(updated);
  } catch (err: unknown) {
    logError("AccountCategories", { component: "account-categories", message: "Error in PATCH /api/account-categories:", error: err instanceof Error ? err.message : String(err) });
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
      logError("AccountCategories", { component: "account-categories", message: "Error counting accounts for category:", error: countError instanceof Error ? countError.message : String(countError) });
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
          logError("AccountCategories", { component: "account-categories", message: "Error creating category during reassignment:", error: createCatError instanceof Error ? createCatError.message : String(createCatError) });
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
        logError("AccountCategories", { component: "account-categories", message: "Error reassigning accounts:", error: reassignError instanceof Error ? reassignError.message : String(reassignError) });
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
      logError("AccountCategories", { component: "account-categories", message: "Error deleting category:", error: deleteError instanceof Error ? deleteError.message : String(deleteError) });
      return NextResponse.json(
        { error: "Failed to delete category" },
        { status: 500 }
      );
    }

    await logAuditFromRequest(
      {
        userId,
        action: "delete",
        resourceType: "account_category",
        resourceId: id,
        status: "success",
        changes: { reassigned_to: targetCategoryId, accounts_reassigned: accountsCount },
      },
      request
    );

    return NextResponse.json({ success: true, targetCategoryId });
  } catch (err: unknown) {
    logError("AccountCategories", { component: "account-categories", message: "Error in DELETE /api/account-categories:", error: err instanceof Error ? err.message : String(err) });
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
