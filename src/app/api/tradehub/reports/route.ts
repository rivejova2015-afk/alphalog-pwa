// src/app/api/tradehub/reports/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { decryptText } from "@/lib/security/encryption";
import { recordBugFromRequest } from "@/lib/security/bugRecorder";

const safeDecrypt = (value?: string | null) => {
  try {
    return decryptText(value);
  } catch (err) {
    console.warn("[TradeHub] Failed to decrypt weekly report:", err);
    return value ?? "";
  }
};

/**
 * GET /api/tradehub/reports
 * List all weekly reports for authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = userData.user.id;

    // Fetch reports
    const { data: reports, error: reportsError } = await supabase
      .from("weekly_reports")
      .select("*")
      .eq("user_id", userId)
      .eq("deleted_at", null)
      .order("week_start", { ascending: false });

    if (reportsError) {
      console.error("[Reports GET] Query error:", reportsError);
      return NextResponse.json([]);
    }

    const decrypted = (reports || []).map((report: any) => ({
      ...report,
      content_md: safeDecrypt(report.content_md),
    }));

    return NextResponse.json(decrypted, {
      headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' },
    });
  } catch (err: unknown) {
    console.error("[Reports GET] Error:", err);
    await recordBugFromRequest(request, {
      userId: null,
      status: 500,
      error: err,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
