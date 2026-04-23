import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { encryptText, decryptText } from "@/lib/security/encryption";
import { buildChatContext } from "@/lib/terminal-ia/buildChatContext";
import { buildAssistantSystemPrompt } from "@/lib/terminal-ia/chatPrompt";
import type { Asset } from "@/lib/news/sources";

const MODEL = "claude-sonnet-4-20250514";
const MAX_HISTORY = 20;
const MEMORY_EXTRACT_THRESHOLD = 5;

const safeDecrypt = (value: string | null | undefined): string => {
  if (!value) return "";
  try {
    return decryptText(value) ?? value;
  } catch {
    return value;
  }
};

type Params = { params: Promise<{ id: string }> };

type ClaudeStreamEvent =
  | { type: "content_block_delta"; delta: { type: "text_delta"; text: string } }
  | { type: "message_stop" }
  | { type: "error"; error: { message: string } };

/**
 * GET /api/terminal/chat/sessions/[id]/messages
 * Returns paginated message history (decrypted).
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: sessionId } = await params;
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = userData.user.id;

    // Verify session ownership
    const { data: session, error: sessionError } = await supabase
      .from("terminal_chat_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const limit = 50;
    const before = request.nextUrl.searchParams.get("before"); // cursor-based pagination

    let query = supabase
      .from("terminal_chat_messages")
      .select("id, role, content, rating, context_snapshot, created_at")
      .eq("session_id", sessionId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (before) {
      query = query.lt("created_at", before);
    }

    const { data: msgs, error } = await query;
    if (error) {
      return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
    }

    const messages = (msgs ?? [])
      .reverse()
      .map((m) => ({ ...m, content: safeDecrypt(m.content as string) }));

    return NextResponse.json({ messages });
  } catch (err) {
    console.error("[Chat Messages] GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/terminal/chat/sessions/[id]/messages
 * Sends a user message and streams back the assistant response via SSE.
 *
 * Body: { content: string, isOnboarding?: boolean }
 * Response: text/event-stream
 *   data: {"type":"delta","content":"..."}
 *   data: {"type":"done","message_id":"uuid"}
 *   data: {"type":"error","message":"..."}
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { id: sessionId } = await params;
  const encoder = new TextEncoder();

  const sendEvent = (
    controller: ReadableStreamDefaultController,
    payload: Record<string, unknown>
  ) => {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
  };

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Auth
        const supabase = await createClient();
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user) {
          sendEvent(controller, { type: "error", message: "Unauthorized" });
          controller.close();
          return;
        }
        const userId = userData.user.id;

        // Verify session ownership + get asset
        const { data: session, error: sessionError } = await supabase
          .from("terminal_chat_sessions")
          .select("id, asset")
          .eq("id", sessionId)
          .eq("user_id", userId)
          .is("deleted_at", null)
          .single();

        if (sessionError || !session) {
          sendEvent(controller, { type: "error", message: "Session not found" });
          controller.close();
          return;
        }

        const asset = session.asset as Asset;

        // Parse body
        const body = await request.json().catch(() => ({}));
        const userContent = typeof body.content === "string" ? body.content.trim() : "";
        const isOnboarding = body.isOnboarding === true;

        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          sendEvent(controller, { type: "error", message: "AI service not configured" });
          controller.close();
          return;
        }

        // Save user message (if not onboarding auto-brief)
        let userMessageId: string | null = null;
        if (!isOnboarding && userContent) {
          const encryptedUserContent = encryptText(userContent);
          const { data: savedUserMsg } = await supabase
            .from("terminal_chat_messages")
            .insert({
              session_id: sessionId,
              user_id: userId,
              role: "user",
              content: encryptedUserContent,
            })
            .select("id")
            .single();
          userMessageId = savedUserMsg?.id ?? null;
        }

        // Load history (last MAX_HISTORY messages)
        const { data: historyRows } = await supabase
          .from("terminal_chat_messages")
          .select("role, content")
          .eq("session_id", sessionId)
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(MAX_HISTORY);

        const history = (historyRows ?? [])
          .filter((m) => m.role === "user" || m.role === "assistant")
          .reverse()
          .map((m) => ({
            role: m.role as "user" | "assistant",
            content: safeDecrypt(m.content as string),
          }));

        // Build context (market data, news, events, memory)
        const context = await buildChatContext(supabase, userId, asset);

        // Get assistant name from settings
        const { data: settings } = await supabase
          .from("terminal_assistant_settings")
          .select("assistant_name")
          .eq("user_id", userId)
          .single();
        const assistantName = settings?.assistant_name ?? "AlphaAnalyst";

        const systemPrompt = buildAssistantSystemPrompt(context, assistantName);

        // Build messages for Claude
        const claudeMessages: { role: "user" | "assistant"; content: string }[] = isOnboarding
          ? [{ role: "user", content: `Dame un análisis del mercado ${asset} en este momento. Usa todo el contexto disponible.` }]
          : [...history];

        if (!isOnboarding && userContent) {
          // The user message was just added to history but may not reflect yet; ensure it's last
          if (claudeMessages[claudeMessages.length - 1]?.content !== userContent) {
            claudeMessages.push({ role: "user", content: userContent });
          }
        }

        // Context snapshot for storage
        const contextSnapshot = {
          news_count: context.recentNews.length,
          events_count: context.upcomingEvents.length,
          has_price: !!context.livePrice && !context.livePrice.stale,
          price: context.livePrice?.last ?? null,
          asset,
        };

        // Stream from Anthropic API
        const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: MODEL,
            max_tokens: 1500,
            stream: true,
            system: systemPrompt,
            messages: claudeMessages,
          }),
          signal: request.signal,
        });

        if (!anthropicResponse.ok) {
          sendEvent(controller, { type: "error", message: "AI service error" });
          controller.close();
          return;
        }

        if (!anthropicResponse.body) {
          sendEvent(controller, { type: "error", message: "Empty response body from AI service" });
          controller.close();
          return;
        }

        // Read the stream and forward chunks
        const reader = anthropicResponse.body.getReader();
        const dec = new TextDecoder();
        let fullContent = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          const chunk = dec.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr || jsonStr === "[DONE]") continue;

            try {
              const event = JSON.parse(jsonStr) as ClaudeStreamEvent;
              if (
                event.type === "content_block_delta" &&
                event.delta.type === "text_delta"
              ) {
                fullContent += event.delta.text;
                sendEvent(controller, { type: "delta", content: event.delta.text });
              } else if (event.type === "message_stop") {
                break;
              }
            } catch {
              // skip malformed lines
            }
          }
        }

        // Save assistant response
        let assistantMessageId: string | null = null;
        if (fullContent) {
          const encryptedAssistant = encryptText(fullContent);
          const { data: savedAssistantMsg } = await supabase
            .from("terminal_chat_messages")
            .insert({
              session_id: sessionId,
              user_id: userId,
              role: "assistant",
              content: encryptedAssistant,
              context_snapshot: contextSnapshot,
            })
            .select("id")
            .single();
          assistantMessageId = savedAssistantMsg?.id ?? null;

          // Update session updated_at
          await supabase
            .from("terminal_chat_sessions")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", sessionId)
            .eq("user_id", userId);
        }

        sendEvent(controller, {
          type: "done",
          message_id: assistantMessageId,
          user_message_id: userMessageId,
        });

        // Background: trigger memory extraction if session is long enough
        const { count: msgCount } = await supabase
          .from("terminal_chat_messages")
          .select("id", { count: "exact", head: true })
          .eq("session_id", sessionId)
          .eq("user_id", userId);

        if ((msgCount ?? 0) >= MEMORY_EXTRACT_THRESHOLD) {
          // Fire and forget — don't await
          const serviceSupabase = createServiceClient();
          void triggerMemoryExtraction(serviceSupabase, sessionId, userId, asset);
        }

        controller.close();
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // Client disconnected — stream closed, partial content already saved
          controller.close();
          return;
        }
        console.error("[Chat Messages] Stream error:", err);
        try {
          sendEvent(controller, { type: "error", message: "Internal server error" });
          controller.close();
        } catch {
          // controller may already be closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

async function triggerMemoryExtraction(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  serviceSupabase: any,
  sessionId: string,
  userId: string,
  asset: string
) {
  try {
    // Check if memory was already extracted for this session
    const { count } = await serviceSupabase
      .from("terminal_assistant_memory")
      .select("id", { count: "exact", head: true })
      .eq("source_session_id", sessionId)
      .eq("user_id", userId);

    if ((count ?? 0) > 0) return; // Already extracted

    const { extractMemoryFromSession } = await import(
      "@/lib/terminal-ia/extractMemory"
    );

    // Load all messages for extraction
    const { data: msgs } = await serviceSupabase
      .from("terminal_chat_messages")
      .select("role, content")
      .eq("session_id", sessionId)
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(40);

    if (!msgs || msgs.length < 4) return;

    const decrypted = (msgs as { role: string; content: string }[]).map((m) => ({
      role: m.role,
      content: safeDecrypt(m.content),
    }));

    const memoryItems = await extractMemoryFromSession(decrypted, asset);

    if (memoryItems.length > 0) {
      await serviceSupabase.from("terminal_assistant_memory").insert(
        memoryItems.map((item) => ({
          user_id: userId,
          memory_type: item.type,
          content: item.content,
          importance_score: item.importance_score,
          asset: item.asset ?? null,
          source_session_id: sessionId,
        }))
      );
    }
  } catch (err) {
    console.error("[Memory Extraction] Error:", err);
    // Non-critical — don't throw
  }
}
