import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Asset } from "@/lib/news/sources";
import { runReportPipeline } from "@/lib/reports/runReport";

const allowedAssets: Asset[] = ["US500", "XAUUSD"];

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const asset = body?.asset as Asset | "BOTH" | undefined;

    if (!asset || (asset !== "BOTH" && !allowedAssets.includes(asset))) {
      return NextResponse.json({ error: "Invalid asset" }, { status: 400 });
    }

    const assetsToRun = asset === "BOTH" ? allowedAssets : [asset];
    const results = await Promise.all(
      assetsToRun.map((assetItem) =>
        runReportPipeline({
          supabase,
          userId: user.id,
          asset: assetItem,
          lookbackDays: 7,
        })
      )
    );

    const anyFailed = results.some((result) => result.outcome === "failed");
    const anyDone = results.some((result) => result.outcome === "done");
    const anyNoChanges = results.some((result) => result.outcome === "done_no_changes");

    if (!anyDone && !anyNoChanges) {
      return NextResponse.json(
        {
          ok: false,
          error: "No se pudo generar el reporte.",
          assets: results,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      status: anyFailed ? "partial" : "ok",
      assets: results,
    });
  } catch (error) {
    console.error("Error in POST /api/terminal/reports/generate:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
