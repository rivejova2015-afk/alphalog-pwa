import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { decryptText } from "@/lib/security/encryption";
import { logError } from "@/lib/log";

const safeDecrypt = (value: string): string => {
  try {
    return decryptText(value) ?? value;
  } catch {
    return value;
  }
};

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/terminal/chat/sessions/[id]
 * Returns session + last 50 messages (decrypted).
 */
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = userData.user.id;

    const [sessionResult, messagesResult] = await Promise.all([
      supabase
        .from("terminal_chat_sessions")
        .select("id, title, asset, created_at, updated_at")
        .eq("id", id)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .single(),
      supabase
        .from("terminal_chat_messages")
        .select("id, role, content, rating, context_snapshot, created_at")
        .eq("session_id", id)
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(50),
    ]);

    if (sessionResult.error || !sessionResult.data) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const messages = (messagesResult.data ?? []).map((m) => ({
      ...m,
      content: safeDecrypt(m.content as string),
    }));

    return NextResponse.json({ session: sessionResult.data, messages });
  } catch (err) {
    logError("Chat Session", { component: "terminal.chat.sessions.[id]", message: "GET error:", error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/terminal/chat/sessions/[id]
 * Renames session title.
 * Body: { title: string }
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = userData.user.id;

    const body = await request.json().catch(() => ({}));
    const title = typeof body.title === "string" ? body.title.trim() : null;
    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("terminal_chat_sessions")
      .update({ title, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId)
      .is("deleted_at", null);

    if (error) {
      return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    logError("Chat Session", { component: "terminal.chat.sessions.[id]", message: "PATCH error:", error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/terminal/chat/sessions/[id]
 * Soft-deletes a session (messages cascade via DB).
 */
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = userData.user.id;

    const { error } = await supabase
      .from("terminal_chat_sessions")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId)
      .is("deleted_at", null);

    if (error) {
      return NextResponse.json({ error: "Failed to delete session" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    logError("Chat Session", { component: "terminal.chat.sessions.[id]", message: "DELETE error:", error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
