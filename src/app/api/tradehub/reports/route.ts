// src/app/api/tradehub/reports/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { decryptText } from "@/lib/security/encryption";

/**
 * GET /api/tradehub/reports
 * List all weekly reports for authenticated user
 */
export async function GET() {
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
      content_md: decryptText(report.content_md),
    }));

    return NextResponse.json(decrypted);
  } catch (err: unknown) {
    console.error("[Reports GET] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
