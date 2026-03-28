import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { encryptText } from "@/lib/security/encryption";
import type { Asset } from "@/lib/news/sources";
import { ingestNewsForAsset } from "@/lib/news/ingest";
import { dedupeNews } from "@/lib/news/dedupe";
import { scoreImpact } from "@/lib/news/impactScore";
import { buildReportBase } from "@/lib/reports/buildBase";
import { reportLog } from "@/lib/logging/reportLogs";

const allowedAssets: Asset[] = ["XAUUSD"];

const safeEncrypt = (value: string) => {
  try {
    return encryptText(value);
  } catch (err) {
    console.error("[Terminal] Failed to encrypt evidence:", err);
    return null;
  }
};

const buildReportForAsset = async (asset: Asset, title: string) => {
  const { items, failures } = await ingestNewsForAsset(asset);
  if (failures.length > 0) {
    reportLog.failure(
      `Fuentes fallidas ${asset}`,
      new Error("Sources failed"),
      {
        failures: failures.map((f) => `${f.source.name}: ${f.reason}`),
      }
    );
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);

  const filtered = items.filter((item) => item.publishedAt >= cutoff);
  const deduped = dedupeNews(filtered);
  const scored = deduped.map((item) => ({
    ...item,
    impact: scoreImpact(asset, item).label,
  }));

  return buildReportBase(asset, scored, { titleOverride: title });
};

/**
 * POST /api/terminal/evidence/generate
 * Generate evidence report using official news sources (keyword-based).
 * AI analysis is handled externally by Lattice agents via /api/terminal/reports/analyze.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { instrumentId, title } = body;

    if (!title?.trim()) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    let assetsToRun: Asset[] = allowedAssets;
    let resolvedInstrumentId: string | null = null;

    if (instrumentId) {
      const { data: instrument, error: instrumentError } = await supabase
        .from("instruments")
        .select("id, symbol")
        .eq("id", instrumentId)
        .single();

      if (instrumentError || !instrument) {
        return NextResponse.json(
          { error: "Instrumento no encontrado" },
          { status: 404 }
        );
      }

      if (!allowedAssets.includes(instrument.symbol as Asset)) {
        return NextResponse.json(
          { error: "Instrumento no soportado" },
          { status: 400 }
        );
      }

      assetsToRun = [instrument.symbol as Asset];
      resolvedInstrumentId = instrument.id as string;
    }

    const reports = await Promise.all(
      assetsToRun.map((asset) =>
        buildReportForAsset(asset, title.trim())
      )
    );

    const combinedContent = reports
      .map((report) => report.markdown)
      .join("\n\n---\n\n");

    const encryptedTitle = safeEncrypt(title.trim());
    const encryptedContent = safeEncrypt(combinedContent);

    if (!encryptedTitle || !encryptedContent) {
      return NextResponse.json(
        { error: "Configuracion de seguridad pendiente" },
        { status: 500 }
      );
    }

    const { data, error } = await supabase
      .from("terminal_evidence_reports")
      .insert([
        {
          user_id: userData.user.id,
          instrument_id: resolvedInstrumentId,
          title: encryptedTitle,
          content: encryptedContent,
        },
      ])
      .select()
      .single();

    if (error || !data) {
      console.error("Error creating evidence:", error);
      return NextResponse.json(
        { error: "Failed to create evidence" },
        { status: 500 }
      );
    }

    const incompleteReasons = reports.flatMap((report) => report.incompleteReasons);
    const incomplete = reports.some((report) => report.incomplete);

    return NextResponse.json({
      ok: true,
      status: incomplete ? "incomplete" : "done",
      reportId: data.id,
      title: title.trim(),
      content: combinedContent,
      incomplete,
      incompleteReasons,
    });
  } catch (err: unknown) {
    console.error("Error in POST /api/terminal/evidence/generate:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
