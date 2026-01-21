// src/app/api/tradehub/evidence/signed-url/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/tradehub/evidence/signed-url?id=<evidence_id>
 * Generate signed URL for evidence image preview (60s validity)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const evidenceId = searchParams.get("id");

    if (!evidenceId) {
      return NextResponse.json(
        { error: "Missing evidence ID" },
        { status: 400 }
      );
    }

    // Verify ownership and get image_path
    const { data: evidence, error: fetchError } = await supabase
      .from("tv_analysis_evidence")
      .select("user_id, image_path")
      .eq("id", evidenceId)
      .eq("user_id", userData.user.id)
      .eq("deleted_at", null)
      .single();

    if (fetchError || !evidence) {
      return NextResponse.json(
        { error: "Evidence not found or unauthorized" },
        { status: 404 }
      );
    }

    // Generate signed URL (60 seconds validity)
    const { data: signedUrl, error: urlError } = await supabase.storage
      .from("log_attachments")
      .createSignedUrl(evidence.image_path, 60);

    if (urlError) {
      console.error("Error generating signed URL:", urlError);
      return NextResponse.json(
        { error: "Failed to generate signed URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({ signedUrl: signedUrl.signedUrl });
  } catch (err: unknown) {
    console.error("Error in GET /api/tradehub/evidence/signed-url:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
