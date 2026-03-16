// src/app/api/tags/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { recordBugFromRequest } from "@/lib/security/bugRecorder";

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: () => {},
        },
      }
    );

    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: tags, error } = await supabase
      .from("tags")
      .select("id, name")
      .eq("user_id", authData.user.id)
      .is("deleted_at", null)
      .order("sort_index", { ascending: true });

    if (error) {
      console.error("[Tags API] Query error:", error);
      return NextResponse.json(
        { error: "Error fetching tags" },
        { status: 500 }
      );
    }

    return NextResponse.json({ items: tags || [] }, {
      headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' },
    });
  } catch (err) {
    console.error("[Tags API] Error:", err);
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
    const body = await request.json();
    const { name } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Tag name is required" },
        { status: 400 }
      );
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: () => {},
        },
      }
    );

    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = authData.user.id;
    const trimmedName = name.trim();

    // Check if tag already exists
    const { data: existing } = await supabase
      .from("tags")
      .select("id")
      .eq("user_id", userId)
      .eq("name_lower", trimmedName.toLowerCase())
      .is("deleted_at", null)
      .single();

    if (existing) {
      return NextResponse.json({ error: "Tag already exists" }, { status: 409 });
    }

    const { data: tag, error } = await supabase
      .from("tags")
      .insert({ user_id: userId, name: trimmedName })
      .select()
      .single();

    if (error) {
      console.error("[Tags API POST] Insert error:", error);
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Tag already exists" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Error creating tag" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { data: tag, message: "Tag created successfully" },
      { status: 201 }
    );
  } catch (err) {
    console.error("[Tags API POST] Unexpected error:", err);
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
