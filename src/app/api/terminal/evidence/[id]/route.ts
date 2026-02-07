// src/app/api/terminal/evidence/[id]/route.ts
import { createClient } from "@/lib/supabase/server";
import { decryptText, encryptText } from "@/lib/security/encryption";
import { NextRequest, NextResponse } from "next/server";

const safeDecrypt = (value?: string | null) => {
  try {
    return decryptText(value);
  } catch (err) {
    console.warn("[Terminal] Failed to decrypt evidence:", err);
    return value ?? "";
  }
};

const safeEncrypt = (value: string) => {
  try {
    return encryptText(value);
  } catch (err) {
    console.error("[Terminal] Failed to encrypt evidence:", err);
    return null;
  }
};

/**
 * PATCH /api/terminal/evidence/{id}
 * Update evidence report
 */
export async function PATCH(
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
    const body = await request.json();
    const { title, content, instrument_id } = body;

    // Verify ownership
    const { data: existingReport } = await supabase
      .from("terminal_evidence_reports")
      .select("user_id")
      .eq("id", id)
      .single();

    if (!existingReport || existingReport.user_id !== userData.user.id) {
      return NextResponse.json(
        { error: "Report not found or unauthorized" },
        { status: 404 }
      );
    }

    const encryptedTitle = title !== undefined ? safeEncrypt(title) : undefined;
    const encryptedContent = content !== undefined ? safeEncrypt(content) : undefined;

    if ((title !== undefined && !encryptedTitle) || (content !== undefined && !encryptedContent)) {
      return NextResponse.json(
        { error: "Configuracion de seguridad pendiente" },
        { status: 500 }
      );
    }

    const { data, error } = await supabase
      .from("terminal_evidence_reports")
      .update({
        title: encryptedTitle,
        content: encryptedContent,
        instrument_id,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating evidence:", error);
      return NextResponse.json(
        { error: "Failed to update evidence" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ...data,
      title: safeDecrypt(data.title),
      content: safeDecrypt(data.content),
    });
  } catch (err: any) {
    console.error("Error in PATCH /api/terminal/evidence/[id]:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/terminal/evidence/{id}
 * Hard-delete evidence report (cascades to attachments + storage)
 */
export async function DELETE(
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

    // Verify ownership
    const { data: existingReport } = await supabase
      .from("terminal_evidence_reports")
      .select("user_id")
      .eq("id", id)
      .single();

    if (!existingReport || existingReport.user_id !== userData.user.id) {
      return NextResponse.json(
        { error: "Report not found or unauthorized" },
        { status: 404 }
      );
    }

    const { data: attachments, error: attachmentsError } = await supabase
      .from("terminal_evidence_attachments")
      .select("id, path")
      .eq("report_id", id)
      .eq("user_id", userData.user.id);

    if (attachmentsError) {
      console.error("Error fetching attachments:", attachmentsError);
      return NextResponse.json(
        { error: "Failed to delete evidence" },
        { status: 500 }
      );
    }

    const attachmentPaths = (attachments || [])
      .map((att) => att.path)
      .filter(Boolean) as string[];

    if (attachmentPaths.length > 0) {
      try {
        await supabase.storage.from("log_attachments").remove(attachmentPaths);
      } catch (storageErr) {
        console.warn("Warning: Failed to delete attachment files:", storageErr);
      }
    }

    if (attachments && attachments.length > 0) {
      const attachmentIds = attachments.map((att) => att.id);
      await supabase
        .from("terminal_evidence_attachments")
        .delete()
        .in("id", attachmentIds)
        .eq("user_id", userData.user.id);
    }

    const { error } = await supabase
      .from("terminal_evidence_reports")
      .delete()
      .eq("id", id)
      .eq("user_id", userData.user.id);

    if (error) {
      console.error("Error deleting evidence:", error);
      return NextResponse.json(
        { error: "Failed to delete evidence" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Error in DELETE /api/terminal/evidence/[id]:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
