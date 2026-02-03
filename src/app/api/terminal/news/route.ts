// src/app/api/terminal/news/route.ts
import { createClient } from "@/lib/supabase/server";
import { decryptText, encryptText } from "@/lib/security/encryption";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/terminal/news?instrumentId={id}
 * Returns news for a specific instrument
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const instrumentId = request.nextUrl.searchParams.get("instrumentId");
    if (!instrumentId) {
      return NextResponse.json(
        { error: "instrumentId is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("terminal_news")
      .select("*")
      .eq("user_id", userData.user.id)
      .eq("instrument_id", instrumentId)
      .is("deleted_at", null)
      .order("timestamp_utc", { ascending: false });

    if (error) {
      console.error("Error fetching news:", error);
      return NextResponse.json(
        { error: "Failed to fetch news" },
        { status: 500 }
      );
    }

    const decrypted = (data || []).map((item) => ({
      ...item,
      title: decryptText(item.title),
      url: decryptText(item.url),
      source: decryptText(item.source),
    }));

    return NextResponse.json(decrypted);
  } catch (err: unknown) {
    console.error("Error in GET /api/terminal/news:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/terminal/news
 * Create news
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      instrumentId,
      title,
      url,
      source,
      relevancy_score,
      impact_label,
    } = body;

    if (!instrumentId || !title?.trim()) {
      return NextResponse.json(
        { error: "Missing required fields: instrumentId, title" },
        { status: 400 }
      );
    }

    // Verify instrument exists
    const { data: instrument } = await supabase
      .from("instruments")
      .select("id")
      .eq("id", instrumentId)
      .single();

    if (!instrument) {
      return NextResponse.json(
        { error: "Instrument not found" },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from("terminal_news")
      .insert([
        {
          user_id: userData.user.id,
          instrument_id: instrumentId,
          title: encryptText(title),
          url: encryptText(url),
          source: encryptText(source),
          relevancy_score,
          impact_label,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error creating news:", error);
      return NextResponse.json(
        { error: "Failed to create news" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ...data,
      title: decryptText(data.title),
      url: decryptText(data.url),
      source: decryptText(data.source),
    });
  } catch (err: unknown) {
    console.error("Error in POST /api/terminal/news:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
