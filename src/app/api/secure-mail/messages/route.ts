import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptText } from "@/lib/security/encryption";
import { recordBugFromRequest } from "@/lib/security/bugRecorder";
import { logError, logWarn } from "@/lib/log";

const safeDecrypt = (value?: string | null) => {
  try {
    return decryptText(value) || "";
  } catch (error) {
    logWarn("SecureMail", "Decrypt failed", { component: "secure-mail.messages.decrypt", error: error instanceof Error ? error.message : String(error) });
    return value || "";
  }
};

/**
 * GET /api/secure-mail/messages?mailboxId=...&direction=...
 * Returns AES-decrypted ciphertext (PGP stays intact)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const mailboxId = request.nextUrl.searchParams.get("mailboxId") || "";
    const direction = request.nextUrl.searchParams.get("direction") || "";

    if (!mailboxId) {
      return NextResponse.json({ error: "mailboxId is required" }, { status: 400 });
    }

    // Verify mailbox ownership before querying messages (defense-in-depth vs IDOR)
    const { data: mailbox } = await supabase
      .from("secure_mailboxes")
      .select("id")
      .eq("id", mailboxId)
      .eq("user_id", userData.user.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!mailbox) {
      return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
    }

    let query = supabase
      .from("secure_messages")
      .select("*")
      .eq("user_id", userData.user.id)
      .eq("mailbox_id", mailboxId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (direction && direction !== "all") {
      query = query.eq("direction", direction);
    }

    const { data, error } = await query;

    if (error) {
      logError("SecureMail", { component: "secure-mail.messages", message: "Fetch messages error:", error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
    }

    const decrypted = (data || []).map((msg) => ({
      ...msg,
      subject_ciphertext: safeDecrypt(msg.subject_ciphertext),
      body_ciphertext: safeDecrypt(msg.body_ciphertext),
    }));

    return NextResponse.json(decrypted, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    logError("SecureMail", { component: "secure-mail.messages", message: "GET messages error:", error: error instanceof Error ? error.message : String(error) });
    await recordBugFromRequest(request, {
      userId: null,
      status: 500,
      error,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
