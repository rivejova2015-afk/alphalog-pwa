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
      console.error("[SecureMail] Fetch messages error:", error);
      return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
    }

    const decrypted = (data || []).map((msg) => ({
      ...msg,
      subject_ciphertext: safeDecrypt(msg.subject_ciphertext),
      body_ciphertext: safeDecrypt(msg.body_ciphertext),
    }));

    return NextResponse.json(decrypted);
  } catch (error) {
    console.error("[SecureMail] GET messages error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
