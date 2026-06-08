import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptText } from "@/lib/security/encryption";
import { logError, logWarn } from "@/lib/log";

const safeDecrypt = (value?: string | null) => {
  try {
    return decryptText(value) || "";
  } catch (error) {
    logWarn("SecureMail", "Decrypt failed", { component: "secure-mail.messages.[id].decrypt", error: error instanceof Error ? error.message : String(error) });
    return value || "";
  }
};

/**
 * GET /api/secure-mail/messages/{id}
 * Returns message + attachments with AES layer removed.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: message, error: messageError } = await supabase
      .from("secure_messages")
      .select("*")
      .eq("id", id)
      .eq("user_id", userData.user.id)
      .single();

    if (messageError || !message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Audit log: record message access (fire-and-forget)
    void supabase.from("secure_message_access_audit").insert({
      user_id: userData.user.id,
      message_id: id,
      event: "read",
    });

    const { data: attachments, error: attachmentsError } = await supabase
      .from("secure_attachments")
      .select("*")
      .eq("message_id", id)
      .eq("user_id", userData.user.id)
      .is("deleted_at", null);

    if (attachmentsError) {
      logError("SecureMail", { component: "secure-mail.messages.[id]", message: "Fetch attachments error:", error: attachmentsError instanceof Error ? attachmentsError.message : String(attachmentsError) });
      return NextResponse.json({ error: "Failed to fetch attachments" }, { status: 500 });
    }

    const decryptedMessage = {
      ...message,
      subject_ciphertext: safeDecrypt(message.subject_ciphertext),
      body_ciphertext: safeDecrypt(message.body_ciphertext),
    };

    const decryptedAttachments = (attachments || []).map((att) => ({
      ...att,
      filename_ciphertext: safeDecrypt(att.filename_ciphertext),
    }));

    return NextResponse.json({ message: decryptedMessage, attachments: decryptedAttachments });
  } catch (error) {
    logError("SecureMail", { component: "secure-mail.messages.[id]", message: "GET message error:", error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
