import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { logError } from "@/lib/log";

const DEFAULT_SETTINGS = {
  assistant_name: "AlphaAnalyst",
  default_asset: "XAUUSD",
};

/**
 * GET /api/terminal/assistant/settings
 * Returns assistant settings, creating defaults if not found.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = userData.user.id;

    const { data, error } = await supabase
      .from("terminal_assistant_settings")
      .select("assistant_name, default_asset, updated_at")
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      // Create defaults on first access
      const { data: created } = await supabase
        .from("terminal_assistant_settings")
        .insert({ user_id: userId, ...DEFAULT_SETTINGS })
        .select("assistant_name, default_asset, updated_at")
        .single();
      return NextResponse.json({ settings: created ?? DEFAULT_SETTINGS });
    }

    return NextResponse.json({ settings: data });
  } catch (err) {
    logError("Assistant Settings", { component: "terminal.assistant.settings", message: "GET error:", error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/terminal/assistant/settings
 * Updates assistant name and/or default asset.
 * Body: { assistant_name?: string, default_asset?: "XAUUSD" | "US500" }
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = userData.user.id;

    const body = await request.json().catch(() => ({}));
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (typeof body.assistant_name === "string") {
      const name = body.assistant_name.trim().slice(0, 50);
      if (name) updates.assistant_name = name;
    }
    if (body.default_asset === "XAUUSD" || body.default_asset === "US500") {
      updates.default_asset = body.default_asset;
    }

    const { error } = await supabase
      .from("terminal_assistant_settings")
      .upsert({ user_id: userId, ...DEFAULT_SETTINGS, ...updates });

    if (error) {
      return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    logError("Assistant Settings", { component: "terminal.assistant.settings", message: "PATCH error:", error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
