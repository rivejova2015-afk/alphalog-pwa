// src/app/api/terminal/evidence/[id]/attachments/[attachmentId]/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * DELETE /api/terminal/evidence/{id}/attachments/{attachmentId}
 * Soft-delete attachment (soft-delete metadata, optionally delete from storage)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; attachmentId: string } }
) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, attachmentId } = params;

    // Verify attachment ownership
    const { data: attachment } = await supabase
      .from("terminal_evidence_attachments")
      .select("user_id, path")
      .eq("id", attachmentId)
      .eq("report_id", id)
      .single();

    if (!attachment || attachment.user_id !== userData.user.id) {
      return NextResponse.json(
        { error: "Attachment not found or unauthorized" },
        { status: 404 }
      );
    }

    // Soft-delete: update metadata
    const { error: dbError } = await supabase
      .from("terminal_evidence_attachments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", attachmentId);

    if (dbError) {
      console.error("Error deleting attachment metadata:", dbError);
      return NextResponse.json(
        { error: "Failed to delete attachment" },
        { status: 500 }
      );
    }

    // Try to delete from storage (best-effort, don't fail if storage delete fails)
    try {
      await supabase.storage.from("log_attachments").remove([attachment.path]);
    } catch (storageErr) {
      console.warn("Warning: Failed to delete file from storage:", storageErr);
      // Continue - metadata is already soft-deleted
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error(
      "Error in DELETE /api/terminal/evidence/[id]/attachments/[attachmentId]:",
      err
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/terminal/evidence/{id}/attachments/{attachmentId}/signed-url
 * Returns signed URL for downloading/viewing attachment (60s validity)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; attachmentId: string } }
) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, attachmentId } = params;

    // Verify attachment ownership
    const { data: attachment } = await supabase
      .from("terminal_evidence_attachments")
      .select("user_id, path")
      .eq("id", attachmentId)
      .eq("report_id", id)
      .is("deleted_at", null)
      .single();

    if (!attachment || attachment.user_id !== userData.user.id) {
      return NextResponse.json(
        { error: "Attachment not found or unauthorized" },
        { status: 404 }
      );
    }

    // Generate signed URL (60 second validity)
    const { data, error } = await supabase.storage
      .from("log_attachments")
      .createSignedUrl(attachment.path, 60);

    if (error) {
      console.error("Error creating signed URL:", error);
      return NextResponse.json(
        { error: "Failed to generate download URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({ signedUrl: data.signedUrl });
  } catch (err: any) {
    console.error(
      "Error in GET /api/terminal/evidence/[id]/attachments/[attachmentId]/signed-url:",
      err
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
