// src/app/api/tradehub/evidence/signed-url/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { logError } from "@/lib/log";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isMissingTable = (error: any) =>
  error?.code === "42P01" ||
  (typeof error?.message === "string" &&
    error.message.toLowerCase().includes("does not exist"));

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

    if (!UUID_REGEX.test(evidenceId)) {
      return NextResponse.json(
        { error: "Invalid evidence ID" },
        { status: 400 }
      );
    }

    const userId = userData.user.id;

    const { data: tradeEvidence, error: tradeError } = await supabase
      .from("trade_evidence")
      .select("user_id, file_path")
      .eq("id", evidenceId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single();

    if (tradeError && !isMissingTable(tradeError)) {
      logError("TradehubEvidenceSignedUrl", { component: "tradehub.evidence.signed-url", message: "Error fetching trade_evidence:", error: tradeError instanceof Error ? tradeError.message : String(tradeError) });
      return NextResponse.json(
        { error: "Failed to generate signed URL" },
        { status: 500 }
      );
    }

    if (tradeEvidence?.file_path) {
      const { data: signedUrl, error: urlError } = await supabase.storage
        .from("log_attachments")
        .createSignedUrl(tradeEvidence.file_path, 60);

      if (urlError) {
        logError("TradehubEvidenceSignedUrl", { component: "tradehub.evidence.signed-url", message: "Error generating signed URL:", error: urlError instanceof Error ? urlError.message : String(urlError) });
        return NextResponse.json(
          { error: "Failed to generate signed URL", details: urlError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ signedUrl: signedUrl.signedUrl });
    }

    // Verify ownership and get image_path (legacy)
    const { data: evidence, error: fetchError } = await supabase
      .from("tv_analysis_evidence")
      .select("user_id, image_path")
      .eq("id", evidenceId)
      .eq("user_id", userId)
      .is("deleted_at", null)
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
      logError("TradehubEvidenceSignedUrl", { component: "tradehub.evidence.signed-url", message: "Error generating signed URL:", error: urlError instanceof Error ? urlError.message : String(urlError) });
      return NextResponse.json(
        { error: "Failed to generate signed URL", details: urlError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ signedUrl: signedUrl.signedUrl });
  } catch (err: unknown) {
    logError("TradehubEvidenceSignedUrl", { component: "tradehub.evidence.signed-url", message: "Error in GET /api/tradehub/evidence/signed-url:", error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
