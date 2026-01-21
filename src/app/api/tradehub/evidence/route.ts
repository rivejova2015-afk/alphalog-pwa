// src/app/api/tradehub/evidence/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

/**
 * GET /api/tradehub/evidence
 * Returns evidence for authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("tv_analysis_evidence")
      .select("*, account:accounts(id, name), trade:trades(id, symbol, direction)")
      .eq("user_id", userData.user.id)
      .is("deleted_at", null)
      .order("captured_at", { ascending: false });

    if (error) {
      console.error("Error fetching evidence:", error);
      return NextResponse.json(
        { error: "Failed to fetch evidence" },
        { status: 500 }
      );
    }

    return NextResponse.json(data || []);
  } catch (err: unknown) {
    console.error("Error in GET /api/tradehub/evidence:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tradehub/evidence
 * Upload evidence with image file
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const notes = formData.get("notes") as string;
    const accountId = formData.get("account_id") as string;
    const tradeId = formData.get("trade_id") as string;
    const capturedAt = formData.get("captured_at") as string;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    if (!capturedAt) {
      return NextResponse.json(
        { error: "Captured at date is required" },
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

    // Block dangerous extensions
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    const blockedExts = [".exe", ".bat"];
    if (blockedExts.includes(ext)) {
      return NextResponse.json(
        { error: `Extension ${ext} not allowed` },
        { status: 400 }
      );
    }

    // Verify account and trade exist if provided
    if (accountId) {
      const { data: account } = await supabase
        .from("accounts")
        .select("id")
        .eq("id", accountId)
        .eq("user_id", userData.user.id)
        .single();

      if (!account) {
        return NextResponse.json(
          { error: "Account not found" },
          { status: 404 }
        );
      }
    }

    if (tradeId) {
      const { data: trade } = await supabase
        .from("trades")
        .select("id")
        .eq("id", tradeId)
        .eq("user_id", userData.user.id)
        .single();

      if (!trade) {
        return NextResponse.json(
          { error: "Trade not found" },
          { status: 404 }
        );
      }
    }

    // Generate path: ${userId}/tradehub/evidence/${uuid}_${filename}
    const uuid = randomUUID();
    const safePath = `${userData.user.id}/tradehub/evidence/${uuid}_${file.name}`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from("log_attachments")
      .upload(safePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("Error uploading file:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload file" },
        { status: 500 }
      );
    }

    // Insert evidence record
    const { data, error: insertError } = await supabase
      .from("tv_analysis_evidence")
      .insert({
        user_id: userData.user.id,
        image_path: safePath,
        captured_at: new Date(capturedAt).toISOString(),
        user_notes: notes || null,
        trade_id: tradeId || null,
        account_id: accountId || null,
        validation_status: "needs_review",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting evidence:", insertError);
      // Attempt cleanup
      await supabase.storage.from("log_attachments").remove([safePath]);
      return NextResponse.json(
        { error: "Failed to save evidence" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error("Error in POST /api/tradehub/evidence:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
