import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptText, encryptText } from "@/lib/security/encryption";
import { logAuditFromRequest } from "@/lib/security/auditLog";
import { journalEntryResponseSchema, journalEntrySchema, validatePayloadSafe, validationErrorResponse } from "@/lib/validation/schemas";
import { recordBugFromRequest } from "@/lib/security/bugRecorder";
import { autoFixJournalEntry } from "@/lib/validation/autoFix";
import { enforceResponseContract } from "@/lib/validation/contractGuard";
import { logError, logWarn } from "@/lib/log";

const safeDecrypt = (value?: string | null) => {
  try {
    return decryptText(value) || "";
  } catch (error) {
    logWarn("Journal", "Decrypt failed", { component: "safeDecrypt", error: String(error) });
    return value || "";
  }
};

const safeEncrypt = (value: string) => {
  try {
    return encryptText(value);
  } catch (error) {
    logError("Journal", { component: "safeEncrypt", message: "Encrypt failed", error: String(error) });
    return null;
  }
};

const parseContent = (content: string) => {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  } catch {
    // Fallback to plain text
  }
  return { text: content } as Record<string, unknown>;
};

const isClientAbortError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;

  const maybeCode = "code" in error ? String((error as { code?: unknown }).code || "") : "";
  if (maybeCode === "ECONNRESET" || maybeCode === "ABORT_ERR") return true;

  const maybeName = "name" in error ? String((error as { name?: unknown }).name || "") : "";
  if (maybeName === "AbortError") return true;

  const maybeMessage = "message" in error ? String((error as { message?: unknown }).message || "") : "";
  return maybeMessage.toLowerCase().includes("aborted");
};

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("journal_entries")
      .select("id, user_id, title, content, mood, tags, date, created_at, updated_at, deleted_at")
      .eq("user_id", userData.user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      logError("Journal", { component: "GET", message: "Fetch error", error: error.message });
      await recordBugFromRequest(request, {
        userId: userData.user.id,
        status: 500,
        error,
      });
      return NextResponse.json({ error: "Failed to fetch journal entries" }, { status: 500 });
    }

    const normalized = (data || []).map((entry) => {
      const contentPlain = safeDecrypt(entry.content);
      const parsed = parseContent(contentPlain);
      return {
        id: entry.id,
        user_id: entry.user_id,
        text: String(parsed.text || ""),
        mood: entry.mood,
        tags: entry.tags,
        mood_score: parsed.mood_score ?? null,
        market_conditions: parsed.market_conditions ?? null,
        focus_areas: parsed.focus_areas ?? null,
        lessons_learned: parsed.lessons_learned ?? null,
        action_items: parsed.action_items ?? null,
        trade_id: parsed.trade_id ?? null,
        is_private: parsed.is_private ?? false,
        created_at: entry.created_at,
        updated_at: entry.updated_at,
        deleted_at: entry.deleted_at,
      };
    });

    return NextResponse.json(normalized, {
      headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' },
    });
  } catch (error) {
    logError("Journal", { component: "GET", message: "Unexpected error", error: String(error) });
    await recordBugFromRequest(request, {
      userId: null,
      status: 500,
      error,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const fixed = autoFixJournalEntry(body as Record<string, unknown>);

    if (fixed.changed) {
      logAuditFromRequest(
        {
          userId: userData.user.id,
          action: "api_call",
          resourceType: "journal",
          status: "partial",
          changes: { auto_fix: fixed.changes },
        },
        request
      ).catch(e => logWarn("Journal", "Audit: failed to log auto-fix", { error: String(e) }));
    }

    const validation = validatePayloadSafe(journalEntrySchema, fixed.data);

    if (!validation.success) {
      logAuditFromRequest(
        {
          userId: userData.user.id,
          action: "api_call",
          resourceType: "journal",
          status: "failure",
          errorMessage: `Validation failed: ${Object.values(validation.errors).join("; ")}`,
        },
        request
      ).catch(e => logWarn("Journal", "Audit: failed to log validation error", { error: String(e) }));

      return NextResponse.json(
        validationErrorResponse(validation.errors),
        { status: 400 }
      );
    }

    const {
      text,
      mood,
      tags,
      mood_score,
      market_conditions,
      focus_areas,
      lessons_learned,
      action_items,
      trade_id,
      is_private,
    } = validation.data;

    const titleRaw = text.split("\n")[0]?.slice(0, 80) || text.slice(0, 80);
    const contentPayload = {
      text,
      mood_score: mood_score ?? null,
      market_conditions: market_conditions ?? null,
      focus_areas: focus_areas ?? null,
      lessons_learned: lessons_learned ?? null,
      action_items: action_items ?? null,
      trade_id: trade_id ?? null,
      is_private: is_private ?? false,
    };

    const encryptedTitle = safeEncrypt(titleRaw);
    const encryptedContent = safeEncrypt(JSON.stringify(contentPayload));

    if (!encryptedTitle || !encryptedContent) {
      return NextResponse.json(
        { error: "Encryption key missing" },
        { status: 500 }
      );
    }

    const { data, error } = await supabase
      .from("journal_entries")
      .insert({
        user_id: userData.user.id,
        date: new Date().toISOString().slice(0, 10),
        title: encryptedTitle,
        content: encryptedContent,
        mood: mood ?? "neutral",
        tags: tags && tags.length > 0 ? tags : ["journal"],
      })
      .select("id, user_id, title, content, mood, tags, date, created_at, updated_at, deleted_at")
      .single();

    if (error || !data) {
      if (error?.code === "42501") {
        logWarn("Journal", "Insert blocked by RLS policy", { error: error.message });
        return NextResponse.json(
          { error: "No tienes permisos para crear entradas de journal. Verifica la politica RLS en Supabase." },
          { status: 403 }
        );
      }

      logError("Journal", { component: "POST", message: "Insert error", error: error?.message ?? "no data" });
      await recordBugFromRequest(request, {
        userId: userData.user.id,
        status: 500,
        error: error || new Error("Insert failed"),
      });
      return NextResponse.json({ error: "Failed to create entry" }, { status: 500 });
    }

    const contentPlain = safeDecrypt(data.content);
    const parsed = parseContent(contentPlain);

    logAuditFromRequest(
      {
        userId: userData.user.id,
        action: "create",
        resourceType: "journal",
        resourceId: data.id,
        changes: { mood, tags, is_private: contentPayload.is_private },
      },
      request
    ).catch(e => logWarn("Journal", "Audit: failed to log journal create", { error: String(e) }));

    const responsePayload = {
      id: data.id,
      user_id: data.user_id,
      text: String(parsed.text || ""),
      mood: data.mood,
      tags: data.tags,
      mood_score: parsed.mood_score ?? null,
      market_conditions: parsed.market_conditions ?? null,
      focus_areas: parsed.focus_areas ?? null,
      lessons_learned: parsed.lessons_learned ?? null,
      action_items: parsed.action_items ?? null,
      trade_id: parsed.trade_id ?? null,
      is_private: parsed.is_private ?? false,
      created_at: data.created_at,
      updated_at: data.updated_at,
      deleted_at: data.deleted_at,
    };

    const responseCheck = enforceResponseContract(journalEntryResponseSchema, responsePayload);

    if (!responseCheck.ok) {
      await recordBugFromRequest(request, {
        userId: userData.user.id,
        status: 500,
        error: new Error("Response contract violation"),
        payload: { errors: responseCheck.errors },
      });

      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }

    return NextResponse.json(responseCheck.data);
  } catch (error) {
    if (isClientAbortError(error)) {
      return NextResponse.json({ error: "Request aborted by client" }, { status: 499 });
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    logError("Journal", { component: "POST", message: "Unexpected error", error: String(error) });
    await recordBugFromRequest(request, {
      userId: null,
      status: 500,
      error,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/journal
 * Soft-deletes a journal entry by id (sets deleted_at).
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({})) as { id?: string };
    const { id } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("journal_entries")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userData.user.id);

    if (error) {
      logError("Journal", { component: "DELETE", message: "Delete error", error: error.message });
      return NextResponse.json({ error: "Failed to delete entry" }, { status: 500 });
    }

    logAuditFromRequest(
      { userId: userData.user.id, action: "delete", resourceType: "journal", resourceId: id, status: "success" },
      request
    ).catch((e) => logWarn("Journal", "Audit: journal delete log failed", { error: String(e) }));

    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("Journal", { component: "DELETE", message: "Unexpected error", error: String(error) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
