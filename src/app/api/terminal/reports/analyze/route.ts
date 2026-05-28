import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import type { Asset } from "@/lib/news/sources";
import { ingestNewsForAsset } from "@/lib/news/ingest";
import { dedupeNews } from "@/lib/news/dedupe";
import { scoreImpact } from "@/lib/news/impactScore";
import { analyzeNewsWithAI } from "@/lib/terminal-ia/analyzeWithAI";
import type { ScoredNewsItem } from "@/lib/reports/buildBase";
import { logError } from "@/lib/log";

const ALLOWED_ASSETS: Asset[] = ["XAUUSD"];

const verifyToken = (request: NextRequest): boolean => {
  const secret = process.env.LATTICE_API_TOKEN;
  if (!secret) return false;

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return false;

  try {
    const a = Buffer.from(token);
    const b = Buffer.from(secret);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
};

/**
 * POST /api/terminal/reports/analyze
 *
 * AI-powered market analysis endpoint for Lattice agents.
 * Ingests news, scores impact, and runs Claude analysis for XAUUSD.
 *
 * Auth: Bearer token via LATTICE_API_TOKEN env var.
 *
 * Request body: { "asset": "XAUUSD", "lookback_days": 7 }
 * Response: { "ok": true, "asset": "XAUUSD", "analysis": { ...AIAnalysis }, "items_analyzed": 12 }
 */
export async function POST(request: NextRequest) {
  if (!verifyToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const asset = (body.asset ?? "XAUUSD") as Asset;
    const lookbackDays = typeof body.lookback_days === "number" ? body.lookback_days : 7;

    if (!ALLOWED_ASSETS.includes(asset)) {
      return NextResponse.json(
        { error: `Asset not supported. Allowed: ${ALLOWED_ASSETS.join(", ")}` },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY not configured" },
        { status: 503 }
      );
    }

    // 1. Ingest news from official sources
    const { items, failures } = await ingestNewsForAsset(asset);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - lookbackDays);
    const filtered = items.filter((item) => item.publishedAt >= cutoff);
    const deduped = dedupeNews(filtered);
    const scored: ScoredNewsItem[] = deduped.map((item) => ({
      ...item,
      impact: scoreImpact(asset, item).label,
    }));

    const relevant = scored.filter((i) => i.impact !== "low");

    // 2. Run Claude analysis
    const analysis = await analyzeNewsWithAI(asset, scored);

    if (!analysis) {
      return NextResponse.json({
        ok: false,
        error: "AI analysis returned empty. Check ANTHROPIC_API_KEY and news availability.",
        asset,
        items_total: items.length,
        items_relevant: relevant.length,
        source_failures: failures.map((f) => `${f.source.name}: ${f.reason}`),
      }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      asset,
      analysis,
      items_total: items.length,
      items_relevant: relevant.length,
      items_analyzed: Math.min(relevant.length, 20),
      lookback_days: lookbackDays,
      source_failures: failures.length > 0
        ? failures.map((f) => `${f.source.name}: ${f.reason}`)
        : undefined,
    });
  } catch (err) {
    logError("Terminal", { component: "terminal.reports.analyze", message: "Analyze error:", error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
