import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { logAuditFromRequest } from "@/lib/security/auditLog";
import { recordBugFromRequest } from "@/lib/security/bugRecorder";
import {
  buildSummary,
  buildTradesCsv,
  buildPositionsCsv,
  buildEquityCsv,
  renderArchivePdf,
  type PolyarbArchiveDataset,
} from "@/lib/polyarb/archive";

const BUCKET = "log_attachments";

type StoragePath = string;

async function uploadAll(
  supabase: Awaited<ReturnType<typeof createClient>>,
  paths: { path: StoragePath; body: Buffer | string; mime: string }[],
): Promise<{ ok: true } | { ok: false; uploaded: StoragePath[]; error: string }> {
  const uploaded: StoragePath[] = [];
  for (const item of paths) {
    const body =
      typeof item.body === "string" ? Buffer.from(item.body, "utf-8") : item.body;
    const { error } = await supabase.storage.from(BUCKET).upload(item.path, body, {
      contentType: item.mime,
      cacheControl: "3600",
      upsert: false,
    });
    if (error) {
      return { ok: false, uploaded, error: error.message };
    }
    uploaded.push(item.path);
  }
  return { ok: true };
}

async function cleanupStorage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  paths: StoragePath[],
): Promise<void> {
  if (paths.length === 0) return;
  try {
    await supabase.storage.from(BUCKET).remove(paths);
  } catch (err) {
    console.warn("[polyarb/archive] cleanup failed:", err);
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Pick the user's active polyarb agent (most recent if many).
    const { data: agents, error: agentErr } = await supabase
      .from("polyarb_agents")
      .select("id, name")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (agentErr) {
      return NextResponse.json({ error: agentErr.message }, { status: 500 });
    }
    const agent = agents?.[0];
    if (!agent) {
      return NextResponse.json(
        { error: "No PolyArb agent found for this user." },
        { status: 404 },
      );
    }

    // 2. Fetch live (unarchived) datasets.
    const [tradesRes, positionsRes, equityRes, telemetryRes] = await Promise.all([
      supabase
        .from("polyarb_trades")
        .select(
          "id, trade_type, market_slug, outcome, side, price, size_usd, fee_usd, pnl_usd, status, executed_at",
        )
        .eq("user_id", user.id)
        .eq("agent_id", agent.id)
        .is("archived_at", null)
        .order("executed_at", { ascending: true })
        .limit(50000),
      supabase
        .from("polyarb_positions")
        .select(
          "id, market_slug, outcome, side, status, entry_price, exit_price, size_usd, pnl_usd, pnl_percent, opened_at, closed_at, exit_reason",
        )
        .eq("user_id", user.id)
        .eq("agent_id", agent.id)
        .is("deleted_at", null)
        .in("status", ["CLOSED", "LIQUIDATED"])
        .order("closed_at", { ascending: true })
        .limit(50000),
      supabase
        .from("polyarb_equity_snapshots")
        .select("snapshot_at, equity_usd, pnl_usd, open_positions")
        .eq("user_id", user.id)
        .eq("agent_id", agent.id)
        .is("archived_at", null)
        .order("snapshot_at", { ascending: true })
        .limit(50000),
      supabase
        .from("polyarb_telemetry")
        .select("*")
        .eq("user_id", user.id)
        .eq("agent_id", agent.id)
        .maybeSingle(),
    ]);

    if (tradesRes.error) {
      return NextResponse.json({ error: tradesRes.error.message }, { status: 500 });
    }
    if (positionsRes.error) {
      return NextResponse.json({ error: positionsRes.error.message }, { status: 500 });
    }
    if (equityRes.error) {
      return NextResponse.json({ error: equityRes.error.message }, { status: 500 });
    }

    const dataset: PolyarbArchiveDataset = {
      agentId: agent.id,
      agentName: agent.name ?? "PolyArb",
      trades: (tradesRes.data ?? []).map((t) => ({
        id: t.id,
        trade_type: t.trade_type ?? "ENTRY",
        market_slug: t.market_slug ?? null,
        outcome: t.outcome ?? null,
        side: t.side,
        price: typeof t.price === "string" ? Number(t.price) : t.price ?? 0,
        size_usd: t.size_usd ?? null,
        fee_usd: t.fee_usd ?? null,
        pnl_usd: t.pnl_usd ?? null,
        status: t.status,
        executed_at: t.executed_at,
      })),
      positions: (positionsRes.data ?? []).map((p) => ({
        id: p.id,
        market_slug: p.market_slug,
        outcome: p.outcome,
        side: p.side,
        status: p.status,
        entry_price:
          typeof p.entry_price === "string" ? Number(p.entry_price) : p.entry_price ?? null,
        exit_price:
          typeof p.exit_price === "string" ? Number(p.exit_price) : p.exit_price ?? null,
        size_usd: p.size_usd ?? null,
        pnl_usd: p.pnl_usd ?? null,
        pnl_percent: p.pnl_percent ?? null,
        opened_at: p.opened_at ?? null,
        closed_at: p.closed_at ?? null,
        exit_reason: p.exit_reason ?? null,
      })),
      equitySnapshots: (equityRes.data ?? []).map((s) => ({
        snapshot_at: s.snapshot_at,
        equity_usd: typeof s.equity_usd === "string" ? Number(s.equity_usd) : s.equity_usd ?? 0,
        pnl_usd: typeof s.pnl_usd === "string" ? Number(s.pnl_usd) : s.pnl_usd ?? 0,
        open_positions: s.open_positions ?? 0,
      })),
      telemetrySnapshot:
        (telemetryRes.data as Record<string, unknown> | null) ?? null,
    };

    const totalRows =
      dataset.trades.length + dataset.positions.length + dataset.equitySnapshots.length;

    // 3. Idempotent no-op.
    if (totalRows === 0) {
      return NextResponse.json({
        archived: 0,
        evidenceId: null,
        archivePaths: [],
        message: "No hay actividad pendiente para archivar.",
      });
    }

    // 4. Build artifacts.
    const summary = buildSummary(dataset);
    const tradesCsv = buildTradesCsv(dataset);
    const positionsCsv = buildPositionsCsv(dataset);
    const equityCsv = buildEquityCsv(dataset);
    const pdfBuffer = await renderArchivePdf(dataset, summary);

    // 5. Upload files.
    const archiveUuid = randomUUID();
    const baseDir = `${user.id}/polyarb/archive/${archiveUuid}`;
    const tradesPath = `${baseDir}/trades.csv`;
    const positionsPath = `${baseDir}/positions.csv`;
    const equityPath = `${baseDir}/equity.csv`;
    const pdfPath = `${baseDir}/summary.pdf`;

    const upload = await uploadAll(supabase, [
      { path: tradesPath, body: tradesCsv, mime: "text/csv" },
      { path: positionsPath, body: positionsCsv, mime: "text/csv" },
      { path: equityPath, body: equityCsv, mime: "text/csv" },
      { path: pdfPath, body: pdfBuffer, mime: "application/pdf" },
    ]);

    if (!upload.ok) {
      await cleanupStorage(supabase, upload.uploaded);
      return NextResponse.json(
        { error: "Storage upload failed", details: upload.error },
        { status: 500 },
      );
    }

    const allPaths: StoragePath[] = [tradesPath, positionsPath, equityPath, pdfPath];

    // 6. Insert evidence row pointing to PDF (manifest in report_text).
    const manifest = {
      archive_uuid: archiveUuid,
      agent_id: agent.id,
      agent_name: agent.name ?? "PolyArb",
      summary,
      paths: {
        pdf: pdfPath,
        trades_csv: tradesPath,
        positions_csv: positionsPath,
        equity_csv: equityPath,
      },
    };

    const periodEndDate = summary.periodEnd.slice(0, 10);
    const evidenceTitle = `PolyArb 500x archive — ${periodEndDate}`;

    const evidenceInsert = await supabase
      .from("trade_evidence")
      .insert({
        user_id: user.id,
        title: evidenceTitle,
        report_text: JSON.stringify(manifest),
        file_path: pdfPath,
        mime_type: "application/pdf",
        size_bytes: pdfBuffer.length,
        trade_id: null,
        account_id: null,
      })
      .select("id")
      .single();

    if (evidenceInsert.error || !evidenceInsert.data) {
      await cleanupStorage(supabase, allPaths);
      return NextResponse.json(
        {
          error: "Failed to register evidence",
          details: evidenceInsert.error?.message ?? "unknown",
        },
        { status: 500 },
      );
    }

    const evidenceId = evidenceInsert.data.id as string;

    // 7. Mark trades / equity / positions archived.
    const archiveTs = new Date().toISOString();

    const tradesUpd = await supabase
      .from("polyarb_trades")
      .update({ archived_at: archiveTs })
      .eq("user_id", user.id)
      .eq("agent_id", agent.id)
      .is("archived_at", null);

    if (tradesUpd.error) {
      await cleanupStorage(supabase, allPaths);
      await supabase.from("trade_evidence").delete().eq("id", evidenceId);
      return NextResponse.json(
        { error: "Failed to archive trades", details: tradesUpd.error.message },
        { status: 500 },
      );
    }

    const equityUpd = await supabase
      .from("polyarb_equity_snapshots")
      .update({ archived_at: archiveTs })
      .eq("user_id", user.id)
      .eq("agent_id", agent.id)
      .is("archived_at", null);

    if (equityUpd.error) {
      await cleanupStorage(supabase, allPaths);
      await supabase.from("trade_evidence").delete().eq("id", evidenceId);
      return NextResponse.json(
        { error: "Failed to archive equity snapshots", details: equityUpd.error.message },
        { status: 500 },
      );
    }

    const positionsUpd = await supabase
      .from("polyarb_positions")
      .update({ deleted_at: archiveTs })
      .eq("user_id", user.id)
      .eq("agent_id", agent.id)
      .is("deleted_at", null)
      .in("status", ["CLOSED", "LIQUIDATED"]);

    if (positionsUpd.error) {
      await cleanupStorage(supabase, allPaths);
      await supabase.from("trade_evidence").delete().eq("id", evidenceId);
      return NextResponse.json(
        { error: "Failed to archive positions", details: positionsUpd.error.message },
        { status: 500 },
      );
    }

    // 8. Reset cumulative telemetry counters (preserve live state).
    await supabase
      .from("polyarb_telemetry")
      .update({
        total_pnl_usd: 0,
        win_rate: null,
        profit_factor: null,
        sharpe_ratio: null,
        max_drawdown_pct: null,
        consecutive_wins: 0,
        consecutive_losses: 0,
        error_count_1h: 0,
      })
      .eq("user_id", user.id)
      .eq("agent_id", agent.id);

    // 9. Compliance audit row (CFTC-immutable trail).
    await supabase.from("polyarb_compliance_audit").insert({
      user_id: user.id,
      agent_id: agent.id,
      event_type: "CONFIG_CHANGE",
      entity_table: "polyarb_trades",
      after_state: {
        action: "ARCHIVE",
        archive_uuid: archiveUuid,
        evidence_id: evidenceId,
        counts: {
          trades: dataset.trades.length,
          positions: dataset.positions.length,
          equity_snapshots: dataset.equitySnapshots.length,
        },
        summary,
      },
    });

    // 10. App audit log.
    await logAuditFromRequest(
      {
        userId: user.id,
        action: "export",
        resourceType: "evidence",
        resourceId: evidenceId,
        status: "success",
        changes: {
          archive_uuid: archiveUuid,
          counts: {
            trades: dataset.trades.length,
            positions: dataset.positions.length,
            equity_snapshots: dataset.equitySnapshots.length,
          },
        },
      },
      request,
    );

    return NextResponse.json({
      archived: dataset.trades.length,
      evidenceId,
      archiveUuid,
      archivePaths: allPaths,
      counts: {
        trades: dataset.trades.length,
        positions: dataset.positions.length,
        equity_snapshots: dataset.equitySnapshots.length,
      },
      summary,
    });
  } catch (err) {
    await recordBugFromRequest(request, {
      userId: user.id,
      error: err,
      errorMessage: err instanceof Error ? err.message : String(err),
      errorStack: err instanceof Error ? err.stack ?? null : null,
      status: 500,
    });
    return NextResponse.json(
      {
        error: "Archive failed",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
