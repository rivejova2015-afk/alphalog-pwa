import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { decryptText } from "@/lib/security/encryption";
import { logError } from "@/lib/log";

const PR_OFFSET_MS = 4 * 60 * 60 * 1000; // UTC-4

function formatPRDate(date: Date): string {
  const pr = new Date(date.getTime() - PR_OFFSET_MS);
  return pr.toLocaleString("es-PR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

const safeDecrypt = (value: string): string => {
  try {
    return decryptText(value) ?? value;
  } catch {
    return value;
  }
};

/**
 * GET /api/terminal/chat/sessions
 * Returns paginated list of chat sessions with last message preview.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = userData.user.id;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = 20;
    const offset = (page - 1) * limit;

    const { data: sessions, error } = await supabase
      .from("terminal_chat_sessions")
      .select("id, title, asset, created_at, updated_at")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 });
    }

    // Attach last message preview for each session
    const sessionIds = (sessions ?? []).map((s) => s.id as string);
    const previews: Record<string, string> = {};

    if (sessionIds.length > 0) {
      const { data: lastMsgs } = await supabase
        .from("terminal_chat_messages")
        .select("session_id, content, role")
        .in("session_id", sessionIds)
        .eq("role", "assistant")
        .order("created_at", { ascending: false });

      if (lastMsgs) {
        const seen = new Set<string>();
        for (const msg of lastMsgs) {
          const sid = msg.session_id as string;
          if (!seen.has(sid)) {
            seen.add(sid);
            const decrypted = safeDecrypt(msg.content as string);
            previews[sid] = decrypted.slice(0, 80).replace(/\n/g, " ");
          }
        }
      }
    }

    const result = (sessions ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      asset: s.asset,
      created_at: s.created_at,
      updated_at: s.updated_at,
      preview: previews[s.id as string] ?? null,
    }));

    return NextResponse.json({ sessions: result, page, limit });
  } catch (err) {
    logError("Chat Sessions", { component: "terminal.chat.sessions", message: "GET error:", error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/terminal/chat/sessions
 * Creates a new chat session.
 * Body: { asset: "XAUUSD" | "US500" }
 * Returns: { session, isFirst }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = userData.user.id;

    const body = await request.json().catch(() => ({}));
    const asset = (body.asset === "US500" ? "US500" : "XAUUSD") as "XAUUSD" | "US500";
    const title = formatPRDate(new Date());

    // Check if user has any previous sessions
    const { count } = await supabase
      .from("terminal_chat_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("deleted_at", null);

    const isFirst = (count ?? 0) === 0;

    const { data, error } = await supabase
      .from("terminal_chat_sessions")
      .insert({ user_id: userId, title, asset })
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
    }

    return NextResponse.json({ session: data, isFirst }, { status: 201 });
  } catch (err) {
    logError("Chat Sessions", { component: "terminal.chat.sessions", message: "POST error:", error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
