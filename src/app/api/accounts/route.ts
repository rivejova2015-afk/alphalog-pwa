// src/app/api/accounts/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { enforceResponseContract } from "@/lib/validation/contractGuard";
import { accountResponseSchema } from "@/lib/validation/schemas";

/**
 * GET /api/accounts?trash=false
 * Fetch accounts (active or deleted)
 * Query: trash = "true" (show deleted) or "false" (show active)
 * Returns: Array<Account>
 */
type AccountCategory = { id: string; name: string; description?: string | null };
type AccountRow = {
  id: string;
  name: string;
  category_id: string;
  account_size: number | null;
  current_balance: number | null;
  operation_state: string | null;
  phase_status: string | null;
  role: string | null;
  withdrawals_enabled: boolean | null;
  currency: string;
  status: string;
  sort_index: number | null;
  account_categories?: AccountCategory | null;
};

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const trash = request.nextUrl.searchParams.get("trash") === "true";

    let query = supabase
      .from("accounts")
      .select(`
        id,
        name,
        category_id,
        account_size,
        current_balance,
        operation_state,
        phase_status,
        role,
        withdrawals_enabled,
        currency,
        status,
        sort_index,
        account_categories:category_id(id, name, description)
      `)
      .eq("user_id", userData.user.id)
      .order("sort_index", { ascending: true })
      .order("name", { ascending: true });

    // Filter by soft-delete status
    if (trash) {
      query = query.not("deleted_at", "is", null);
    } else {
      query = query.is("deleted_at", null);
    }

    const { data: accounts, error } = await query as unknown as { data: AccountRow[] | null; error: unknown };

    if (error) {
      console.error("Error fetching accounts (with category join):", error);
      const fallbackQuery = supabase
        .from("accounts")
        .select(
          "id, name, category_id, account_size, current_balance, operation_state, phase_status, role, withdrawals_enabled, currency, status, sort_index"
        )
        .eq("user_id", userData.user.id)
        .order("sort_index", { ascending: true })
        .order("name", { ascending: true });

      const filteredFallback = trash
        ? fallbackQuery.not("deleted_at", "is", null)
        : fallbackQuery.is("deleted_at", null);

      const { data: fallbackAccounts, error: fallbackError } =
        (await filteredFallback) as unknown as { data: AccountRow[] | null; error: unknown };

      if (fallbackError) {
        console.error("Error fetching accounts (fallback):", fallbackError);
        return NextResponse.json(
          { error: "Failed to fetch accounts" },
          { status: 500 }
        );
      }

      const fallbackMapped = (fallbackAccounts || []).map((acc) => ({
        id: acc.id,
        name: acc.name,
        category_id: acc.category_id,
        account_size: acc.account_size,
        current_balance: acc.current_balance,
        operation_state: acc.operation_state,
        phase_status: acc.phase_status,
        role: acc.role,
        withdrawals_enabled: acc.withdrawals_enabled,
        currency: acc.currency,
        status: acc.status,
        sort_index: acc.sort_index,
        category: null,
      }));

      const contractResult = enforceResponseContract(accountResponseSchema.array(), fallbackMapped);
      if (!contractResult.ok) {
        console.warn("[ContractGuard] GET /api/accounts (fallback) contract violation:", contractResult.errors);
      }

      return NextResponse.json(fallbackMapped, {
        headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' },
      });
    }

    // Map category to flattened structure
    const mapped = (accounts || []).map((acc) => ({
      id: acc.id,
      name: acc.name,
      category_id: acc.category_id,
      account_size: acc.account_size,
      current_balance: acc.current_balance,
      operation_state: acc.operation_state,
      phase_status: acc.phase_status,
      role: acc.role,
      withdrawals_enabled: acc.withdrawals_enabled,
      currency: acc.currency,
      status: acc.status,
      sort_index: acc.sort_index,
      category: acc.account_categories ?? null,
    }));

    const contractResult = enforceResponseContract(accountResponseSchema.array(), mapped);
    if (!contractResult.ok) {
      console.warn("[ContractGuard] GET /api/accounts contract violation:", contractResult.errors);
    }

    return NextResponse.json(mapped, {
      headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' },
    });
  } catch (err: unknown) {
    console.error("Error in GET /api/accounts:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/accounts
 * Create account
 * Body: {name, category_id, account_size?, current_balance?, ...}
 * Returns: {id, name, ...}
 */
type CreateAccountBody = {
  name: string;
  category_id: string;
  account_size?: number | string | null;
  current_balance?: number | string | null;
  operation_state?: string | null;
  phase_status?: string | null;
  role?: string | null;
  withdrawals_enabled?: boolean | null;
  currency?: string;
  status?: string;
};

function isCreateAccountBody(body: unknown): body is CreateAccountBody {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return typeof b.name === "string" && typeof b.category_id === "string";
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody = await request.json();
    if (!isCreateAccountBody(rawBody)) {
      return NextResponse.json(
        { error: "Invalid body" },
        { status: 400 }
      );
    }
    const {
      name,
      category_id,
      account_size,
      current_balance,
      operation_state,
      phase_status,
      role,
      withdrawals_enabled,
      currency,
      status,
    } = rawBody;

    if (!name || !name.trim() || !category_id) {
      return NextResponse.json(
        { error: "Name and category_id are required" },
        { status: 400 }
      );
    }

    // Verify category exists for this user
    const { data: category, error: catError } = await supabase
      .from("account_categories")
      .select("id")
      .eq("id", category_id)
      .eq("user_id", userData.user.id)
      .is("deleted_at", null)
      .single();

    if (catError || !category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    // Create account
    const { data: account, error: createError } = await supabase
      .from("accounts")
      .insert({
        user_id: userData.user.id,
        name: name.trim(),
        category_id,
        account_size: typeof account_size === 'number' ? account_size : (typeof account_size === 'string' && account_size ? parseFloat(account_size) : null),
        current_balance: typeof current_balance === 'number' ? current_balance : (typeof current_balance === 'string' && current_balance ? parseFloat(current_balance) : null),
        operation_state: operation_state || null,
        phase_status: phase_status || null,
        role: role || null,
        withdrawals_enabled: withdrawals_enabled ?? true,
        currency: typeof currency === "string" && currency.trim() ? currency.trim() : "USD",
        status: typeof status === "string" && status.trim() ? status.trim() : "active",
      })
      .select("*")
      .single();

    if (createError) {
      console.error("Error creating account:", createError);
      return NextResponse.json(
        { error: "Failed to create account" },
        { status: 500 }
      );
    }

    const contractResult = enforceResponseContract(accountResponseSchema, account);
    if (!contractResult.ok) {
      console.warn("[ContractGuard] POST /api/accounts contract violation:", contractResult.errors);
    }

    return NextResponse.json(account, { status: 201 });
  } catch (err: unknown) {
    console.error("Error in POST /api/accounts:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
