// src/app/api/tradehub/evidence/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { decryptText, encryptText } from "@/lib/security/encryption";
import { recordBugFromRequest } from "@/lib/security/bugRecorder";
import { logError } from "@/lib/log";

const isMissingTable = (error: any) =>
  error?.code === "42P01" ||
  (typeof error?.message === "string" &&
    error.message.toLowerCase().includes("does not exist"));

const safeDecrypt = (value?: string | null) => {
  try {
    return decryptText(value);
  } catch (err) {
    console.warn("[TradeHub] Failed to decrypt evidence text:", err);
    return value ?? null;
  }
};

const getStorageUploadMessage = (error: { message?: string; code?: string } | null) => {
  const message = (error?.message || "").toLowerCase();
  if (message.includes("bucket") && message.includes("not found")) {
    return "Storage bucket no configurado (log_attachments)";
  }
  if (message.includes("row-level security") || message.includes("policy")) {
    return "Permisos de storage insuficientes para subir evidencia";
  }
  if (message.includes("duplicate")) {
    return "El archivo ya existe, intenta con otro nombre";
  }
  return "No se pudo subir el archivo de evidencia";
};

const getDbInsertMessage = (error: { message?: string; code?: string } | null) => {
  const code = error?.code || "";
  if (code === "23503") return "La cuenta o el trade seleccionado no existe";
  if (code === "23514") return "Los datos de evidencia no cumplen validaciones";
  if (code === "23502") return "Faltan campos obligatorios para guardar la evidencia";
  return "No se pudo guardar la evidencia en base de datos";
};

type EvidenceRow = {
  id: string;
  user_notes?: string | null;
  report_text?: string | null;
  title?: string | null;
  image_path?: string | null;
  file_path?: string | null;
  mime_type?: string | null;
  validation_status: "needs_review" | "valid" | "invalid";
  trade_id?: string | null;
  account_id?: string | null;
  captured_at?: string;
  created_at?: string;
  account?: { id: string; name: string } | null;
  trade?: { id: string; symbol: string; direction: string; setup_id?: string | null } | null;
};

type EvidenceJoinRow = EvidenceRow & {
  account?: { id: string; name: string } | { id: string; name: string }[] | null;
  trade?: { id: string; symbol: string; direction: string; setup_id?: string | null } | {
    id: string;
    symbol: string;
    direction: string;
    setup_id?: string | null;
  }[] | null;
};

const normalizeEvidenceRow = (row: EvidenceJoinRow): EvidenceRow => {
  const account = Array.isArray(row.account) ? row.account[0] ?? null : row.account ?? null;
  const trade = Array.isArray(row.trade) ? row.trade[0] ?? null : row.trade ?? null;

  return {
    ...row,
    account,
    trade,
  };
};

const mapTradeEvidence = (row: EvidenceRow) => ({
  id: row.id,
  title: row.title || null,
  user_notes: row.report_text || null,
  image_path: row.file_path || null,
  file_path: row.file_path || null,
  mime_type: row.mime_type || null,
  validation_status: row.validation_status,
  trade_id: row.trade_id ?? null,
  account_id: row.account_id ?? null,
  captured_at: row.created_at || row.captured_at || null,
  created_at: row.created_at || row.captured_at || null,
  account: row.account ?? null,
  trade: row.trade ?? null,
  source: "trade_evidence",
});

const mapLegacyEvidence = (row: EvidenceRow) => ({
  id: row.id,
  title: safeDecrypt(row.user_notes) || null,
  user_notes: safeDecrypt(row.user_notes),
  image_path: row.image_path || null,
  file_path: row.image_path || null,
  mime_type: row.mime_type || null,
  validation_status: row.validation_status,
  trade_id: row.trade_id ?? null,
  account_id: row.account_id ?? null,
  captured_at: row.captured_at || row.created_at || null,
  created_at: row.created_at || row.captured_at || null,
  account: row.account ?? null,
  trade: row.trade ?? null,
  source: "tv_analysis_evidence",
});

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
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10)));
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const offset = (page - 1) * limit;

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

    const tradeEvidenceQuery = supabase
      .from("trade_evidence")
      .select("id, title, report_text, file_path, mime_type, validation_status, trade_id, account_id, created_at, account:accounts(id, name), trade:trades(id, symbol, direction, setup_id)")
      .eq("user_id", userData.user.id)
      .is("deleted_at", null);

    if (setupId) {
      tradeEvidenceQuery.or(`trade.setup_id.eq.${setupId}`);
    }
    if (dateFrom) {
      tradeEvidenceQuery.gte("created_at", dateFrom);
    }

    let tradeEvidenceRows: EvidenceRow[] = [];
    const { data: tradeEvidenceData, error: tradeEvidenceError } = await tradeEvidenceQuery
      .order("created_at", { ascending: false })
      .range(offset, offset + limit * 2 - 1); // fetch 2x limit to allow dedup with legacy

    if (tradeEvidenceError && !isMissingTable(tradeEvidenceError)) {
      console.error("Error fetching trade_evidence:", tradeEvidenceError);
      return NextResponse.json(
        { error: "Failed to fetch evidence" },
        { status: 500 }
      );
    }
    if (!tradeEvidenceError && tradeEvidenceData) {
      tradeEvidenceRows = tradeEvidenceData.map((row) => normalizeEvidenceRow(row as EvidenceJoinRow));
    }

    let legacyRows: EvidenceRow[] = [];
    let legacyQuery = supabase
      .from("tv_analysis_evidence")
      .select("id, image_path, mime_type, validation_status, trade_id, account_id, captured_at, created_at, user_notes, account:accounts(id, name), trade:trades(id, symbol, direction, setup_id)")
      .eq("user_id", userData.user.id)
      .is("deleted_at", null);

    if (setupId) {
      legacyQuery = legacyQuery.or(`trade.setup_id.eq.${setupId}`);
    }

    if (dateFrom) {
      legacyQuery = legacyQuery.gte("captured_at", dateFrom);
    }

    const { data: legacyData, error: legacyError } = await legacyQuery
      .order("captured_at", { ascending: false })
      .range(offset, offset + limit * 2 - 1);

    if (legacyError && !isMissingTable(legacyError)) {
      console.error("Error fetching legacy evidence:", legacyError);
      return NextResponse.json(
        { error: "Failed to fetch evidence" },
        { status: 500 }
      );
    }

    if (!legacyError && legacyData) {
      legacyRows = legacyData.map((row) => normalizeEvidenceRow(row as EvidenceJoinRow));
    }

    const combined = [
      ...tradeEvidenceRows.map(mapTradeEvidence),
      ...legacyRows.map(mapLegacyEvidence),
    ];

    const deduped = Array.from(
      new Map(combined.map((item) => [item.id, item])).values()
    ).sort((a, b) => {
      const aDate = new Date(a.captured_at || a.created_at || 0).getTime();
      const bDate = new Date(b.captured_at || b.created_at || 0).getTime();
      return bDate - aDate;
    }).slice(0, limit);

    return NextResponse.json(
      { items: deduped, page, limit, hasMore: deduped.length === limit },
      { headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' } }
    );
  } catch (err: unknown) {
    logError("Evidence", { component: "GET", message: "Unexpected error", error: String(err) });
    await recordBugFromRequest(request, {
      userId: null,
      status: 500,
      error: err,
    });
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
    const notes = (formData.get("notes") as string) || "";
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

    const capturedAtDate = new Date(capturedAt);
    if (Number.isNaN(capturedAtDate.getTime())) {
      return NextResponse.json(
        { error: "Captured at date is invalid" },
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

    // Whitelist allowed MIME types for evidence uploads
    const ALLOWED_MIMETYPES = new Set([
      "image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf",
    ]);
    if (!ALLOWED_MIMETYPES.has(file.type)) {
      return NextResponse.json(
        { error: "File type not allowed. Allowed: JPEG, PNG, GIF, WebP, PDF" },
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

    const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
    const uuid = randomUUID();
    const safePath = `${userData.user.id}/tradehub/evidence/${uuid}_${safeFilename}`;

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
        {
          error: getStorageUploadMessage(uploadError),
          details: uploadError.message,
        },
        { status: 500 }
      );
    }

    const reportTextRaw = notes?.trim() || "";
    const reportText =
      reportTextRaw || `Evidencia sin notas (${new Date(capturedAt).toLocaleDateString("es-ES")})`;
    const title =
      reportTextRaw?.slice(0, 120) || file.name || "Evidencia";

    const tradeEvidenceInsert = await supabase
      .from("trade_evidence")
      .insert({
        user_id: userData.user.id,
        title,
        report_text: reportText,
        file_path: safePath,
        mime_type: file.type || null,
        size_bytes: file.size || null,
        trade_id: tradeId || null,
        account_id: accountId || null,
        created_at: capturedAtDate.toISOString(),
      })
      .select("id, title, report_text, file_path, mime_type, validation_status, trade_id, account_id, created_at")
      .single();

    if (tradeEvidenceInsert.error && !isMissingTable(tradeEvidenceInsert.error)) {
      console.error("Error inserting trade_evidence:", tradeEvidenceInsert.error);
      await supabase.storage.from("log_attachments").remove([safePath]);
      return NextResponse.json(
        {
          error: getDbInsertMessage(tradeEvidenceInsert.error),
          details: tradeEvidenceInsert.error.message,
        },
        { status: 500 }
      );
    }

    if (!tradeEvidenceInsert.error && tradeEvidenceInsert.data) {
      return NextResponse.json(mapTradeEvidence(tradeEvidenceInsert.data as EvidenceRow));
    }

    let encryptedNotes: string | null = null;
    try {
      encryptedNotes = encryptText(notes) || null;
    } catch (err) {
      console.error("Error encrypting notes:", err);
      await supabase.storage.from("log_attachments").remove([safePath]);
      return NextResponse.json(
        { error: "Configuración de seguridad pendiente" },
        { status: 500 }
      );
    }

    // Insert legacy evidence record
    const { data, error: insertError } = await supabase
      .from("tv_analysis_evidence")
      .insert({
        user_id: userData.user.id,
        image_path: safePath,
        captured_at: capturedAtDate.toISOString(),
        user_notes: encryptedNotes,
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
        {
          error: getDbInsertMessage(insertError),
        },
        { status: 500 }
      );
    }

    return NextResponse.json(mapLegacyEvidence(data as EvidenceRow));
  } catch (err: unknown) {
    logError("Evidence", { component: "POST", message: "Unexpected error", error: String(err) });
    await recordBugFromRequest(request, {
      userId: null,
      status: 500,
      error: err,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
