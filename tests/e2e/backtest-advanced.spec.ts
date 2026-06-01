import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { login } from "./utils/auth";

/**
 * Smoke E2E for the advanced backtest pipeline (Plan v2 — Gaps #1-#4).
 *
 * Flow under test:
 *  1. /intelligence/algorithms loads with at least 1 algorithm.
 *  2. The user expands an accordion, opens the "Nuevo backtest" form.
 *  3. Activates ML + Multi-TF + Portfolio toggles.
 *  4. Submits — POST + GET /api/backtest/jobs are mocked to return a
 *     completed job with `advanced` populated for all three blocks.
 *  5. The completed job appears in the list, the user clicks it.
 *  6. The "Advanced" tab appears (conditional on advanced != null) and
 *     the three blocks render (ML acc, Multi-TF status, Portfolio metrics).
 *
 * Why mock: a real backtest takes 1–3 minutes (bar loading + Monte Carlo
 * + walk-forward + portfolio multi-symbol). For a CI smoke we only need
 * to verify the wiring: clicks reach the right handlers, the body shape
 * matches the route's Zod schema, and the conditional render switches
 * on the advanced payload. A unit jsdom test already covers the inner
 * render details; this spec covers the browser-only gaps (server
 * component shell + auth middleware + client component lazy import).
 *
 * Seed: the page is a Server Component that selects from `algorithms`
 * with the authenticated user_id. To make the test self-sufficient
 * across environments, we insert a single seed row via the service-role
 * Supabase client in beforeAll and hard-delete it in afterAll.
 */

const SEED_NAME = "E2E Advanced Pipeline Smoke";

async function seedAlgorithm(userEmail: string): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("E2E backtest-advanced needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY");
  }
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const userId = users?.users?.find((u) => u.email?.toLowerCase() === userEmail.toLowerCase())?.id;
  if (!userId) throw new Error(`No Supabase user matches ${userEmail}`);

  const { data, error } = await admin
    .from("algorithms")
    .insert({ user_id: userId, name: SEED_NAME, instrument: "XAUUSD" })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Failed to seed algorithm: ${error?.message ?? "no row"}`);
  return data.id as string;
}

async function deleteAlgorithm(algoId: string): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await admin.from("algorithms").delete().eq("id", algoId);
}

const E2E_EMAIL = process.env.E2E_EMAIL ?? "test@alphalog.local";

let seededAlgoId: string | null = null;

test.describe("Backtest advanced pipeline — render smoke", () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeAll(async () => {
    seededAlgoId = await seedAlgorithm(E2E_EMAIL);
  });

  test.afterAll(async () => {
    if (seededAlgoId) await deleteAlgorithm(seededAlgoId);
  });

  test.beforeEach(async ({ page }) => {
    await login(page);

    // Mock the three endpoints BacktestPanel touches. The page is a Server
    // Component so we cannot mock its initial render, but every job
    // interaction goes through these three routes from the client.
    const mockJob = {
      id: "mock-job-id",
      status: "completed",
      progress_pct: 100,
      current_phase: "done",
      error: null,
      created_at: new Date().toISOString(),
      started_at: new Date(Date.now() - 30_000).toISOString(),
      finished_at: new Date().toISOString(),
    };
    const mockAdvanced = {
      ml: { used: true, trainAcc: 0.72, validAcc: 0.61, featureNames: ["rsi", "atr", "ema_spread"] },
      multiTf: {
        used: true,
        status: "completed",
        higherTimeframes: ["H4", "D1"],
        tradesFilteredCount: 7,
        alignment: {
          byTf: { H4: { bull: 80, bear: 20, neutral: 0 }, D1: { bull: 50, bear: 50, neutral: 0 } },
          totalPrimaryBars: 100,
        },
      },
      portfolio: {
        used: true,
        status: "completed",
        legCount: 2,
        metrics: {
          totalPnl: 199,
          totalReturnPct: 1.99,
          sharpe: 2.1,
          maxDrawdown: 8,
          maxDrawdownPct: 0.08,
          legCorrelations: [{ a: "leg-a", b: "leg-b", rho: 0.45 }],
        },
        equityPreviewLast50: [],
      },
    };
    const mockResults = {
      metrics: { totalTrades: 10, winRate: 0.6, totalPnl: 500, sharpe: 1.2 },
      equity_curve: [],
      trades: [],
      monte_carlo: null,
      walk_forward: null,
      stress_tests: null,
      advanced: mockAdvanced,
    };

    await page.route(/\/api\/backtest\/jobs\?algorithm_id=/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ jobs: [mockJob] }),
      });
    });
    await page.route(/\/api\/backtest\/jobs\/mock-job-id$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ job: mockJob, results: mockResults }),
      });
    });
    await page.route(/\/api\/backtest\/jobs$/, async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ id: "mock-job-id" }),
        });
      } else {
        await route.fallback();
      }
    });
  });

  test("advanced pipeline: toggles + portfolio editor + advanced tab + 3 result blocks", async ({ page }) => {
    await page.goto("/intelligence/algorithms", { waitUntil: "domcontentloaded", timeout: 30_000 });

    // Expand the seeded algorithm's accordion. AlgoAccordion's header is a
    // div[role="button"][aria-expanded]; locating by the seed name avoids
    // collisions with any pre-existing algorithms in the test environment.
    const seedHeader = page.getByText(SEED_NAME, { exact: false }).first();
    await expect(seedHeader).toBeVisible({ timeout: 15_000 });
    await seedHeader.click();

    // BacktestPanel renders its "Nuevo backtest" toggle once the accordion
    // expands. There can be multiple matching buttons if other accordions
    // expanded too — first() targets the seed's panel.
    const newBtn = page.getByRole("button", { name: /Nuevo backtest/i }).first();
    await expect(newBtn).toBeVisible({ timeout: 10_000 });
    await newBtn.click();

    // Form fields appear. Activate the three advanced toggles.
    await page.getByTestId("jobs-toggle-use-ml").check();
    await page.getByTestId("jobs-toggle-use-multi-tf").check();
    await page.getByTestId("jobs-toggle-use-portfolio").check();

    // Portfolio toggle reveals the legs editor with two default rows.
    const legsEditor = page.getByTestId("portfolio-legs-editor");
    await expect(legsEditor).toBeVisible();
    await expect(legsEditor.locator('input[placeholder="SYMBOL"]')).toHaveCount(2);

    // Submit. The mocked POST returns id="mock-job-id"; the mocked GET
    // for the jobs list returns the same completed job; clicking it opens
    // the results panel.
    await page.getByRole("button", { name: /^Run$/ }).click();

    // Completed job badge appears in the jobs list.
    await expect(page.getByText(/completed/i).first()).toBeVisible({ timeout: 10_000 });
    await page.getByText(/completed/i).first().click();

    // Advanced tab is conditional on results.advanced != null.
    const advancedTab = page.getByTestId("advanced-tab-label");
    await expect(advancedTab).toBeVisible({ timeout: 10_000 });
    await advancedTab.click();

    // Each block renders.
    await expect(page.getByTestId("advanced-results-panel")).toBeVisible();
    await expect(page.getByTestId("advanced-ml-block")).toBeVisible();
    await expect(page.getByTestId("advanced-multitf-block")).toBeVisible();
    await expect(page.getByTestId("advanced-portfolio-completed")).toBeVisible();

    // Smoke text assertions confirm the right shape made it through.
    await expect(page.getByText(/ML Signal/i)).toBeVisible();
    await expect(page.getByText(/H4/)).toBeVisible();
    await expect(page.getByText(/2 legs/i)).toBeVisible();
  });
});
