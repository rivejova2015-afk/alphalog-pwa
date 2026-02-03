// src/app/api/tradehub/evidence/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { decryptText, encryptText } from "@/lib/security/encryption";

/**
 * GET /api/tradehub/evidence
 * Returns evidence for authenticated user, optionally filtered by setup or range
 * Params: setupId (optional), range (optional: 30/90/120/365/ytd/all)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const setupId = url.searchParams.get("setupId");
    const range = url.searchParams.get("range") || "all";

    let dateFrom: string | null = null;
    if (range && range !== "all") {
      const today = new Date();
      const startOfYear = new Date(today.getFullYear(), 0, 1);
      const daysMap: Record<string, number> = {
        "30": 30,
        "90": 90,
        "120": 120,
        "365": 365,
      };

      if (range === "ytd") {
        dateFrom = startOfYear.toISOString().slice(0, 10);
      } else if (daysMap[range]) {
        const d = new Date();
        d.setDate(d.getDate() - daysMap[range]);
        dateFrom = d.toISOString().slice(0, 10);
      }
    }

    let query = supabase
      .from("tv_analysis_evidence")
      .select("*, account:accounts(id, name), trade:trades(id, symbol, direction, setup_id)")
      .eq("user_id", userData.user.id)
      .is("deleted_at", null);

    // Filter by setup if provided
    if (setupId) {
      // Get evidence directly for this setup, OR evidence from trades of this setup
      query = query.or(`setup_id.eq.${setupId},trade.setup_id.eq.${setupId}`);
    }

    // Filter by date range if provided
    if (dateFrom) {
      query = query.gte("captured_at", dateFrom);
    }

    const { data, error } = await query.order("captured_at", { ascending: false });

    if (error) {
      console.error("Error fetching evidence:", error);
      return NextResponse.json(
        { error: "Failed to fetch evidence" },
        { status: 500 }
      );
    }

    // Deduplicate by id
    const seen = new Set<string>();
    const dedupedData = (data || []).filter((ev: { id: string }) => {
      if (seen.has(ev.id)) return false;
      seen.add(ev.id);
      return true;
    });

    const decrypted = dedupedData.map((item: any) => ({
      ...item,
      user_notes: decryptText(item.user_notes),
    }));

    return NextResponse.json(decrypted);
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
        user_notes: encryptText(notes) || null,
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

    return NextResponse.json({
      ...data,
      user_notes: decryptText(data.user_notes),
    });
  } catch (err: unknown) {
    console.error("Error in POST /api/tradehub/evidence:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
