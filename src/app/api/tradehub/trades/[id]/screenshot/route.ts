// src/app/api/tradehub/trades/[id]/screenshot/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { resolveRouteId } from "@/lib/api/routeParams";

/**
 * POST /api/tradehub/trades/{id}/screenshot
 * Upload screenshot for trade
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id?: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = await resolveRouteId(context);
    if (!id) {
      return NextResponse.json(
        { error: "Invalid resource id" },
        { status: 400 }
      );
    }

    // Verify trade exists and belongs to user
    const { data: trade } = await supabase
      .from("trades")
      .select("user_id, account_id")
      .eq("id", id)
      .eq("user_id", userData.user.id)
      .single();

    if (!trade) {
      return NextResponse.json(
        { error: "Trade not found or unauthorized" },
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

    // Whitelist allowed MIME types for screenshots
    const ALLOWED_MIMETYPES = new Set([
      "image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf",
    ]);
    if (!ALLOWED_MIMETYPES.has(file.type)) {
      return NextResponse.json(
        { error: "File type not allowed. Allowed: JPEG, PNG, GIF, WebP, PDF" },
        { status: 400 }
      );
    }

    // Sanitize filename to prevent path traversal
    const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
    const uuid = randomUUID();
    const safePath = `${userData.user.id}/tradehub/trades/${id}/${uuid}_${safeFilename}`;

    // Upload to storage (reuse existing bucket)
    const { error: uploadError } = await supabase.storage
      .from("log_attachments") // Reuse existing bucket
      .upload(safePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("Error uploading file:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload screenshot" },
        { status: 500 }
      );
    }

    // Update trade record with screenshot path
    const { error: updateError } = await supabase
      .from("trades")
      .update({ screenshot_path: safePath })
      .eq("id", id);

    if (updateError) {
      console.error("Error updating trade:", updateError);
      // Attempt cleanup
      await supabase.storage.from("log_attachments").remove([safePath]);
      return NextResponse.json(
        { error: "Failed to save screenshot path" },
        { status: 500 }
      );
    }

    // Generate signed URL for preview (60 seconds)
    const { data: signedData } = await supabase.storage
      .from("log_attachments")
      .createSignedUrl(safePath, 60);

    return NextResponse.json({
      ok: true,
      path: safePath,
      signedUrl: signedData?.signedUrl || null,
    });
  } catch (err: any) {
    console.error("Error in POST /api/tradehub/trades/[id]/screenshot:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/tradehub/trades/{id}/screenshot
 * Get signed URL for screenshot
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id?: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = await resolveRouteId(context);
    if (!id) {
      return NextResponse.json(
        { error: "Invalid resource id" },
        { status: 400 }
      );
    }

    // Verify trade exists and belongs to user
    const { data: trade } = await supabase
      .from("trades")
      .select("screenshot_path")
      .eq("id", id)
      .eq("user_id", userData.user.id)
      .single();

    if (!trade || !trade.screenshot_path) {
      return NextResponse.json(
        { error: "Screenshot not found" },
        { status: 404 }
      );
    }

    // Generate signed URL (60 seconds)
    const { data: signedData, error: signError } = await supabase.storage
      .from("log_attachments")
      .createSignedUrl(trade.screenshot_path, 60);

    if (signError) {
      console.error("Error generating signed URL:", signError);
      return NextResponse.json(
        { error: "Failed to generate signed URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({ signedUrl: signedData.signedUrl });
  } catch (err: any) {
    console.error("Error in GET /api/tradehub/trades/[id]/screenshot:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
