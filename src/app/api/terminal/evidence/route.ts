// src/app/api/terminal/evidence/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/terminal/evidence
 * Returns all evidence reports for user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("terminal_evidence_reports")
      .select("*")
      .eq("user_id", userData.user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching evidence:", error);
      return NextResponse.json(
        { error: "Failed to fetch evidence" },
        { status: 500 }
      );
    }

    return NextResponse.json(data || []);
  } catch (err: unknown) {
    console.error("Error in GET /api/terminal/evidence:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/terminal/evidence
 * Create evidence report
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { title, content, instrument_id } = body;

    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json(
        { error: "Missing required fields: title, content" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("terminal_evidence_reports")
      .insert([
        {
          user_id: userData.user.id,
          title,
          content,
          instrument_id,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error creating evidence:", error);
      return NextResponse.json(
        { error: "Failed to create evidence" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error("Error in POST /api/terminal/evidence:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
