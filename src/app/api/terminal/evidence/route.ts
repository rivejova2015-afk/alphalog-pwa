// src/app/api/terminal/evidence/route.ts
import { createClient } from "@/lib/supabase/server";
import { decryptText, encryptText } from "@/lib/security/encryption";
import { NextRequest, NextResponse } from "next/server";
import { recordBugFromRequest } from "@/lib/security/bugRecorder";
import { logError, logWarn } from "@/lib/log";

const safeDecrypt = (value?: string | null) => {
  try {
    return decryptText(value);
  } catch (err) {
    logWarn("TerminalEvidence", "Failed to decrypt evidence", { component: "terminal.evidence.decrypt", error: err instanceof Error ? err.message : String(err) });
    return value ?? "";
  }
};

const safeEncrypt = (value: string) => {
  try {
    return encryptText(value);
  } catch (err) {
    logError("Terminal", { component: "terminal.evidence", message: "Failed to encrypt evidence:", error: err instanceof Error ? err.message : String(err) });
    return null;
  }
};

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
      logError("TerminalEvidence", { component: "terminal.evidence", message: "Error fetching evidence:", error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json(
        { error: "Failed to fetch evidence" },
        { status: 500 }
      );
    }

    const decrypted = (data || []).map((report) => ({
      ...report,
      title: safeDecrypt(report.title),
      content: safeDecrypt(report.content),
    }));

    return NextResponse.json(decrypted, {
      headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' },
    });
  } catch (err: unknown) {
    logError("TerminalEvidence", { component: "terminal.evidence", message: "Error in GET /api/terminal/evidence:", error: err instanceof Error ? err.message : String(err) });
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

    const encryptedTitle = safeEncrypt(title);
    const encryptedContent = safeEncrypt(content);
    if (!encryptedTitle || !encryptedContent) {
      return NextResponse.json(
        { error: "Configuracion de seguridad pendiente" },
        { status: 500 }
      );
    }

    const { data, error } = await supabase
      .from("terminal_evidence_reports")
      .insert([
        {
          user_id: userData.user.id,
          title: encryptedTitle,
          content: encryptedContent,
          instrument_id,
        },
      ])
      .select()
      .single();

    if (error) {
      logError("TerminalEvidence", { component: "terminal.evidence", message: "Error creating evidence:", error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json(
        { error: "Failed to create evidence" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ...data,
      title: safeDecrypt(data.title),
      content: safeDecrypt(data.content),
    });
  } catch (err: unknown) {
    logError("TerminalEvidence", { component: "terminal.evidence", message: "Error in POST /api/terminal/evidence:", error: err instanceof Error ? err.message : String(err) });
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
