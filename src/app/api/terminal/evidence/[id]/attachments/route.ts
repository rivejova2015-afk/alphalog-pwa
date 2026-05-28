// src/app/api/terminal/evidence/[id]/attachments/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { logError } from "@/lib/log";

/**
 * GET /api/terminal/evidence/{id}/attachments
 * Returns attachments for a report
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

    // Verify report ownership
    const { data: report } = await supabase
      .from("terminal_evidence_reports")
      .select("user_id")
      .eq("id", id)
      .maybeSingle();

    if (!report || report.user_id !== userData.user.id) {
      return NextResponse.json(
        { error: "Report not found or unauthorized" },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from("terminal_evidence_attachments")
      .select("*")
      .eq("report_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (error) {
      logError("TerminalEvidenceAttachments", { component: "terminal.evidence.[id].attachments", message: "Error fetching attachments:", error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json(
        { error: "Failed to fetch attachments" },
        { status: 500 }
      );
    }

    return NextResponse.json(data || []);
  } catch (err: any) {
    logError("TerminalEvidenceAttachments", { component: "terminal.evidence.[id].attachments", message: "Error in GET /api/terminal/evidence/[id]/attachments:", error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/terminal/evidence/{id}/attachments
 * Upload attachment (multipart file upload)
 * 
 * Rules:
 * - Max 100MB per file
 * - Block .exe, .bat extensions
 * - Store in bucket: path = ${userId}/terminal/evidence/${reportId}/${uuid}_${filename}
 */
export async function POST(
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

    // Verify report ownership
    const { data: report } = await supabase
      .from("terminal_evidence_reports")
      .select("user_id")
      .eq("id", id)
      .maybeSingle();

    if (!report || report.user_id !== userData.user.id) {
      return NextResponse.json(
        { error: "Report not found or unauthorized" },
        { status: 404 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file size (100MB)
    const MAX_SIZE = 100 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File exceeds 100MB limit" },
        { status: 400 }
      );
    }

    // Whitelist allowed MIME types
    const ALLOWED_MIMETYPES = new Set([
      "image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf",
    ]);
    if (!ALLOWED_MIMETYPES.has(file.type)) {
      return NextResponse.json(
        { error: "File type not allowed. Allowed: JPEG, PNG, GIF, WebP, PDF" },
        { status: 400 }
      );
    }

    const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
    const uuid = randomUUID();
    const safePath = `${userData.user.id}/terminal/evidence/${id}/${uuid}_${safeFilename}`;

    // Upload to storage (reuse existing bucket)
    const { error: uploadError } = await supabase.storage
      .from("log_attachments") // Reuse existing bucket
      .upload(safePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      logError("TerminalEvidenceAttachments", { component: "terminal.evidence.[id].attachments", message: "Error uploading file:", error: uploadError instanceof Error ? uploadError.message : String(uploadError) });
      return NextResponse.json(
        { error: "Failed to upload file" },
        { status: 500 }
      );
    }

    // Insert attachment record
    const { data, error: dbError } = await supabase
      .from("terminal_evidence_attachments")
      .insert([
        {
          user_id: userData.user.id,
          report_id: id,
          path: safePath,
          filename: file.name,
          mime_type: file.type,
          size_bytes: file.size,
        },
      ])
      .select()
      .single();

    if (dbError) {
      logError("TerminalEvidenceAttachments", { component: "terminal.evidence.[id].attachments", message: "Error creating attachment record:", error: dbError instanceof Error ? dbError.message : String(dbError) });
      // Clean up uploaded file on DB error
      await supabase.storage.from("log_attachments").remove([safePath]);
      return NextResponse.json(
        { error: "Failed to save attachment record" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (err: any) {
    logError("TerminalEvidenceAttachments", { component: "terminal.evidence.[id].attachments", message: "Error in POST /api/terminal/evidence/[id]/attachments:", error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
