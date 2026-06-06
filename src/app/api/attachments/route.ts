// src/app/api/attachments/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { logError as captureError, logWarn } from "@/lib/log";

const MAX_FILE_MB = 100;
const BLOCKED_EXTENSIONS = [".exe", ".bat"];
const BUCKET_NAME = "log_attachments";

/**
 * POST /api/attachments
 * Upload attachment metadata (file is handled client-side via Supabase Storage)
 * Body: { logId: string, filename: string, mimeType: string, sizeBytes: number, path: string }
 * Returns: { id: string, path: string, signedUrl: string } (200) or error (400/401)
 */
type AttachmentPostBody = {
  logId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  path: string;
};

function isAttachmentPostBody(b: unknown): b is AttachmentPostBody {
  if (!b || typeof b !== "object") return false;
  const o = b as Record<string, unknown>;
  return (
    typeof o.logId === "string" &&
    typeof o.filename === "string" &&
    typeof o.path === "string" &&
    typeof o.mimeType === "string" &&
    typeof o.sizeBytes === "number"
  );
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = userData.user.id;

    const rawBody = await request.json();
    if (!isAttachmentPostBody(rawBody)) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const { logId, filename, mimeType, sizeBytes, path } = rawBody;

    if (!logId || !filename || !path) {
      return NextResponse.json(
        { error: "Missing required fields: logId, filename, path" },
        { status: 400 }
      );
    }

    // Verify log belongs to user
    const { data: log, error: logError } = await supabase
      .from("logs")
      .select("id")
      .eq("id", logId)
      .eq("user_id", userId)
      .single();

    if (logError || !log) {
      return NextResponse.json(
        { error: "Log not found or unauthorized" },
        { status: 404 }
      );
    }

    // Insert attachment metadata
    const { data: attachment, error: insertError } = await supabase
      .from("log_attachments")
      .insert({
        log_id: logId,
        user_id: userId,
        path,
        filename,
        mime_type: mimeType,
        size_bytes: sizeBytes,
      })
      .select("id, path")
      .single();

    if (insertError) {
      captureError("Attachments", { component: "attachments", message: "Error inserting attachment metadata:", error: insertError instanceof Error ? insertError.message : String(insertError) });
      return NextResponse.json(
        { error: "Failed to save attachment metadata" },
        { status: 500 }
      );
    }

    // Generate signed URL (60 seconds)
    const { data: signedData, error: signError } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(path, 60);

    if (signError) {
      captureError("Attachments", { component: "attachments", message: "Error creating signed URL:", error: signError instanceof Error ? signError.message : String(signError) });
      return NextResponse.json(
        { error: "Failed to generate signed URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      id: attachment.id,
      path: attachment.path,
      signedUrl: signedData.signedUrl,
    });
  } catch (err: unknown) {
    captureError("Attachments", { component: "attachments", message: "Error in POST /api/attachments:", error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/attachments?attachmentId=xxx
 * Soft-delete attachment metadata + attempt to delete file from storage
 * Returns: { success: boolean } (200) or error
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = userData.user.id;
    const attachmentId = request.nextUrl.searchParams.get("attachmentId");

    if (!attachmentId) {
      return NextResponse.json(
        { error: "Missing attachmentId parameter" },
        { status: 400 }
      );
    }

    // Get attachment to verify ownership and get path
    const { data: attachment, error: getError } = await supabase
      .from("log_attachments")
      .select("id, path, log_id")
      .eq("id", attachmentId)
      .eq("user_id", userId)
      .single();

    if (getError || !attachment) {
      return NextResponse.json(
        { error: "Attachment not found or unauthorized" },
        { status: 404 }
      );
    }

    // Soft-delete: set deleted_at
    const { error: updateError } = await supabase
      .from("log_attachments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", attachmentId);

    if (updateError) {
      captureError("Attachments", { component: "attachments", message: "Error soft-deleting attachment:", error: updateError instanceof Error ? updateError.message : String(updateError) });
      return NextResponse.json(
        { error: "Failed to delete attachment" },
        { status: 500 }
      );
    }

    // Try to delete file from storage (non-blocking if fails)
    const { error: storageError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([attachment.path]);

    if (storageError) {
      logWarn("Attachments", "failed to delete file from storage", { component: "attachments.delete.storage", error: storageError instanceof Error ? storageError.message : String(storageError) });
      // Don't fail the request - metadata is already soft-deleted
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    captureError("Attachments", { component: "attachments", message: "Error in DELETE /api/attachments:", error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/attachments?logId=xxx
 * Fetch all active attachments for a log with signed URLs
 * Returns: Array<{ id, filename, mimeType, sizeBytes, signedUrl }> (200) or error
 */
type AttachmentRow = {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  path: string;
};

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = userData.user.id;
    const logId = request.nextUrl.searchParams.get("logId");

    if (!logId) {
      return NextResponse.json(
        { error: "Missing logId parameter" },
        { status: 400 }
      );
    }

    // Fetch active attachments
    const { data: attachments, error: listError } = await supabase
      .from("log_attachments")
      .select("id, filename, mime_type, size_bytes, path")
      .eq("log_id", logId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (listError) {
      captureError("Attachments", { component: "attachments", message: "Error fetching attachments:", error: listError instanceof Error ? listError.message : String(listError) });
      return NextResponse.json(
        { error: "Failed to fetch attachments" },
        { status: 500 }
      );
    }

    // Generate signed URLs for each attachment
    const attachmentsWithUrls = await Promise.all(
      ((attachments || []) as AttachmentRow[]).map(async (att) => {
        const { data: signedData, error: signError } = await supabase.storage
          .from(BUCKET_NAME)
          .createSignedUrl(att.path, 60);

        return {
          id: att.id,
          filename: att.filename,
          mimeType: att.mime_type,
          sizeBytes: att.size_bytes,
          signedUrl: signError ? null : signedData?.signedUrl,
          path: att.path,
        };
      })
    );

    return NextResponse.json(attachmentsWithUrls);
  } catch (err: unknown) {
    captureError("Attachments", { component: "attachments", message: "Error in GET /api/attachments:", error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
