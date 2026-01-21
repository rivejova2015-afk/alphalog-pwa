// src/app/api/tradehub/setups/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

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
      console.error("Error fetching setups:", error);
      return NextResponse.json(
        { error: "Failed to fetch setups" },
        { status: 500 }
      );
    }

    return NextResponse.json(data || []);
  } catch (err: unknown) {
    console.error("Error in GET /api/tradehub/setups:", err);
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
      console.error("Error creating setup:", error);
      return NextResponse.json(
        { error: "Failed to create setup" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error("Error in POST /api/tradehub/setups:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
