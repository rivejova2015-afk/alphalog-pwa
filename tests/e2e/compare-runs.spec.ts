// E2E for Compare 3 runs (Mejora #5, PR #19) + params snapshot (Mejora #7, PR #21).
//
// Seeds a forex algo + 3 rows in engine_backtest_runs with distinct params
// (SL varied, TP equal) and non-empty equity_curve. Verifies:
//   - History panel renders the 3 badges
//   - Clicking 3 badges activates the CompareView
//   - Metrics table shows A/B/C columns
//   - Equity overlap chart (data-testid="equity-curve-multi") renders
//   - Params section (data-testid="compare-params") appears with 8 rows
//   - SL row has 3 distinct accent colors (purple/cyan/yellow)
//   - TP row (all equal in seed) renders neutral gray

import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { login } from "./utils/auth";

const SEED_NAME = "E2E Compare Runs Smoke";

interface SeedRow { id: string }

async function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("compare-runs E2E needs Supabase admin env vars");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function resolveUserId(email: string): Promise<string> {
  const admin = await adminClient();
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const id = data?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
  if (!id) throw new Error(`No Supabase user matches ${email}`);
  return id;
}

interface SeedContext {
  algoId: string;
  runIds: string[];
}

function makeEquityCurve(growthMultiplier = 1): Array<{ ts: string; equity: number }> {
  const now = Date.now();
  return Array.from({ length: 30 }, (_, i) => ({
    ts: new Date(now - (30 - i) * 24 * 60 * 60_000).toISOString(),
    equity: 10_000 + i * 50 * growthMultiplier,
  }));
}

async function seedAlgoAndRuns(userEmail: string): Promise<SeedContext> {
  const admin = await adminClient();
  const userId = await resolveUserId(userEmail);

  const { data: algo, error: algoErr } = await admin
    .from("algorithms")
    .insert({
      user_id:     userId,
      name:        SEED_NAME,
      instrument:  "EURUSD",
      market_type: "forex",
      platform:    "MT5",
      status:      "paused",
      parameters:  {},
    })
    .select("id")
    .single<SeedRow>();
  if (algoErr || !algo) throw new Error(`Failed to seed algo: ${algoErr?.message}`);

  // 3 runs with SL varied (1.5, 2.0, 2.5), TP constant (3.0).
  // Params shape mirrors what /engine-backtest/route.ts persists.
  const runs = [
    {
      sl: 1.5,
      mult: 1,
      metrics: { totalTrades: 20, winRate: 0.55, totalPnl: 500, sharpe: 1.2, sortino: 1.4, profitFactor: 1.6, maxDrawdownPct: 0.05, expectancy: 25 },
    },
    {
      sl: 2.0,
      mult: 2,
      metrics: { totalTrades: 18, winRate: 0.58, totalPnl: 900, sharpe: 1.7, sortino: 2.0, profitFactor: 1.9, maxDrawdownPct: 0.04, expectancy: 50 },
    },
    {
      sl: 2.5,
      mult: 0.5,
      metrics: { totalTrades: 22, winRate: 0.50, totalPnl: 250, sharpe: 0.8, sortino: 1.0, profitFactor: 1.3, maxDrawdownPct: 0.07, expectancy: 11 },
    },
  ];

  const runIds: string[] = [];
  for (const r of runs) {
    const { data, error } = await admin
      .from("engine_backtest_runs")
      .insert({
        user_id:          userId,
        algorithm_id:     algo.id,
        symbol:           "EURUSD",
        range_from:       "2025-01-01T00:00:00Z",
        range_to:         "2025-12-31T00:00:00Z",
        params: {
          starting_equity:         10_000,
          sl_atr_mult:             r.sl,
          tp_atr_mult:             3.0,
          monte_carlo_iterations:  1000,
          walk_forward_windows:    4,
          use_ml:                  false,
          use_multi_tf_requested:  false,
          use_portfolio_requested: false,
        },
        baseline_metrics: r.metrics,
        equity_curve:     makeEquityCurve(r.mult),
        final_balance:    10_000 + r.metrics.totalPnl,
        total_trades:     r.metrics.totalTrades,
        duration_ms:      3000,
        bars_loaded:      [{ tf: "M15", count: 25_000 }],
      })
      .select("id")
      .single<SeedRow>();
    if (error || !data) throw new Error(`Failed to seed run: ${error?.message}`);
    runIds.push(data.id);
  }

  return { algoId: algo.id, runIds };
}

async function cleanup(ctx: SeedContext) {
  const admin = await adminClient();
  for (const id of ctx.runIds) await admin.from("engine_backtest_runs").delete().eq("id", id);
  await admin.from("algorithms").delete().eq("id", ctx.algoId);
}

const E2E_EMAIL = process.env.E2E_EMAIL ?? "test@alphalog.local";
let seeded: SeedContext | null = null;

test.describe("Compare 3 runs + params snapshot", () => {
  test.describe.configure({ timeout: 60_000 });

  const hasAdmin =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  test.skip(!hasAdmin, "Supabase admin creds required");

  test.beforeAll(async () => {
    seeded = await seedAlgoAndRuns(E2E_EMAIL);
  });

  test.afterAll(async () => {
    if (seeded) await cleanup(seeded);
  });

  test("select 3 runs → CompareView + equity overlap + params section", async ({ page }) => {
    await login(page);

    await page.goto("/intelligence/algorithms", { waitUntil: "domcontentloaded", timeout: 30_000 });

    const detailsBtn = page.getByLabel(new RegExp(`Ver detalles de conexión de ${SEED_NAME}`, "i"));
    await expect(detailsBtn).toBeVisible({ timeout: 15_000 });
    await detailsBtn.click();

    // The history compare list only renders when history.length >= 2.
    // 3 seeded runs should put 3 badges in view.
    const compareHeader = page.getByText(/Comparar runs/);
    await expect(compareHeader).toBeVisible({ timeout: 15_000 });

    // Click 3 history badges. They live inside the compare list.
    const badges = page.locator("button").filter({ hasText: /EURUSD · \$/ });
    await expect(badges).toHaveCount(3, { timeout: 5_000 });
    await badges.nth(0).click();
    await badges.nth(1).click();
    await badges.nth(2).click();

    // CompareView appears once compareRuns.length >= 2 (we have 3 here).
    await expect(page.getByText(/Comparación A vs B vs C/)).toBeVisible({ timeout: 10_000 });

    // Equity overlap chart (Mejora #5)
    await expect(page.getByTestId("equity-curve-multi")).toBeVisible();

    // Params section (Mejora #7)
    const paramsSection = page.getByTestId("compare-params");
    await expect(paramsSection).toBeVisible();

    // Verify the 8 param labels render
    const expectedLabels = [
      "Starting Equity", "SL × ATR", "TP × ATR", "Monte Carlo",
      "Walk-Forward", "ML overlay", "Multi-TF req.", "Portfolio req.",
    ];
    for (const label of expectedLabels) {
      await expect(paramsSection.getByText(label)).toBeVisible();
    }

    // SL row: 3 cells with distinct accent colors
    const slCellA = page.getByTestId("param-cell-sl_atr_mult-0");
    const slCellB = page.getByTestId("param-cell-sl_atr_mult-1");
    const slCellC = page.getByTestId("param-cell-sl_atr_mult-2");
    const slColorA = await slCellA.evaluate((el) => (el as HTMLElement).style.color);
    const slColorB = await slCellB.evaluate((el) => (el as HTMLElement).style.color);
    const slColorC = await slCellC.evaluate((el) => (el as HTMLElement).style.color);
    expect(slColorA).not.toBe(slColorB);
    expect(slColorB).not.toBe(slColorC);
    expect(slColorA).not.toBe(slColorC);

    // TP row: all equal in seed → all neutral gray rgb(71, 85, 105)
    const tpColor0 = await page.getByTestId("param-cell-tp_atr_mult-0").evaluate((el) => (el as HTMLElement).style.color);
    const tpColor1 = await page.getByTestId("param-cell-tp_atr_mult-1").evaluate((el) => (el as HTMLElement).style.color);
    const tpColor2 = await page.getByTestId("param-cell-tp_atr_mult-2").evaluate((el) => (el as HTMLElement).style.color);
    expect(tpColor0).toBe("rgb(71, 85, 105)");
    expect(tpColor1).toBe("rgb(71, 85, 105)");
    expect(tpColor2).toBe("rgb(71, 85, 105)");
  });
});
