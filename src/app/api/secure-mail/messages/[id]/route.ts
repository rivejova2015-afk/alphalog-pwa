import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptText } from "@/lib/security/encryption";

const safeDecrypt = (value?: string | null) => {
  try {
    return decryptText(value) || "";
  } catch (error) {
    console.warn("[SecureMail] Decrypt failed:", error);
    return value || "";
  }
};

/**
 * GET /api/secure-mail/messages/{id}
 * Returns message + attachments with AES layer removed.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    const { data: message, error: messageError } = await supabase
      .from("secure_messages")
      .select("*")
      .eq("id", id)
      .eq("user_id", userData.user.id)
      .single();

    if (messageError || !message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const { data: attachments, error: attachmentsError } = await supabase
      .from("secure_attachments")
      .select("*")
      .eq("message_id", id)
      .eq("user_id", userData.user.id)
      .is("deleted_at", null);

    if (attachmentsError) {
      console.error("[SecureMail] Fetch attachments error:", attachmentsError);
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
    console.error("[SecureMail] GET message error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
