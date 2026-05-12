// Train a logistic-regression model on historical bars for the algorithm's
// primary symbol/M15. Features come from src/lib/backtest/ml-signal.ts.
// Persists weights to ml_models so the engine overlay can load + predict at
// signal time.
//
// Body: { symbol?, timeframe?, lookback_days?, horizon?, threshold?, epochs? }
// Defaults: symbol=instrument[0], timeframe=M15, lookback=180d, horizon=10,
//           threshold=0.001, epochs=200.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { loadHistoricalBars } from "@/lib/backtest/bars-loader";
import { extractFeatures, buildLabels, trainModel } from "@/lib/backtest/ml-signal";
import { logError, logInfo } from "@/lib/log";
import type { Timeframe } from "@/types/backtest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  symbol:         z.string().min(1).max(20).optional(),
  timeframe:      z.enum(["M5","M15","M30","H1","H4","D1"]).optional(),
  lookback_days:  z.number().int().min(30).max(365).optional(),
  horizon:        z.number().int().min(1).max(50).optional(),
  threshold:      z.number().min(0).max(0.05).optional(),
  epochs:         z.number().int().min(20).max(1000).optional(),
});

export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: unknown = {};
    try { body = await request.json(); } catch { /* allow empty */ }
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
    }

    const { data: algo, error: algoErr } = await supabase
      .from("algorithms")
      .select("id, instrument")
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (algoErr || !algo) return NextResponse.json({ error: "Algorithm not found" }, { status: 404 });

    const instruments = Array.isArray(algo.instrument)
      ? (algo.instrument as string[])
      : algo.instrument ? [algo.instrument as string] : [];
    const symbol = parsed.data.symbol ?? instruments[0];
    if (!symbol) return NextResponse.json({ error: "No symbol available" }, { status: 400 });

    const timeframe = (parsed.data.timeframe ?? "M15") as Timeframe;
    const lookbackDays = parsed.data.lookback_days ?? 180;
    const horizon = parsed.data.horizon ?? 10;
    const threshold = parsed.data.threshold ?? 0.001;
    const epochs = parsed.data.epochs ?? 200;

    const to = new Date().toISOString();
    const from = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();

    const bars = await loadHistoricalBars(supabase, symbol, timeframe, from, to);
    if (bars.length < 300) {
      return NextResponse.json({
        error: `Not enough bars to train: ${bars.length} (need ≥ 300)`,
      }, { status: 400 });
    }

    const features = extractFeatures(bars);
    const labels = buildLabels(bars, horizon, threshold);
    const model = trainModel(features, labels, { epochs });

    const { data: row, error: insErr } = await supabase
      .from("ml_models")
      .insert({
        user_id:       user.id,
        algorithm_id:  id,
        kind:          "logreg",
        symbol,
        timeframe,
        feature_names: model.featureNames,
        weights: {
          weights:       model.weights,
          bias:          model.bias,
          featureMeans:  model.featureMeans,
          featureStds:   model.featureStds,
          featureNames:  model.featureNames,
          horizon,
          threshold,
        },
        train_acc: model.trainAcc,
        valid_acc: model.validAcc,
      })
      .select("id, trained_at")
      .single();

    if (insErr) {
      logError("MLTrain", { component: "insert ml_models", message: insErr.message });
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    logInfo("MLTrain", `Trained logreg for algo ${id}`, {
      component: "ml-train",
      meta: { algorithm_id: id, symbol, timeframe, bars: bars.length, trainAcc: model.trainAcc, validAcc: model.validAcc },
    });

    return NextResponse.json({
      ok: true,
      model_id:  row.id,
      symbol,
      timeframe,
      bars_used: bars.length,
      train_acc: model.trainAcc,
      valid_acc: model.validAcc,
      trained_at: row.trained_at,
    }, { status: 201 });
  } catch (err) {
    logError("MLTrain", { component: "POST", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
