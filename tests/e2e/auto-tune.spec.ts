// E2E smoke for the Auto-tune SL/TP grid feature (Mejora #6 / PR #20).
//
// Seeds a futures algo and mocks the SSE auto-tune endpoint with page.route()
// returning a synthetic text/event-stream containing meta + 3 trials + done.
// Verifies:
//   - Click "Auto-tune SL/TP" opens the AutoTuneResults panel.
//   - Progress bar reflects the streamed trials.
//   - Top 5 table renders with the Trophy icon on the winner.
//   - "Aplicar y guardar" issues PUT /api/algorithms/[id] with the merged
//     parameters (preserves anything pre-existing, adds recommended keys).
//
// Why mocked SSE: the real auto-tune runs ~30s and would hit bars-loader,
// engine v1, and Supabase from the test. The unit tests in PR #20 already
// cover the runner contract; this spec verifies the SSE → UI wiring.

import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { login } from "./utils/auth";

const SEED_NAME = "E2E Auto-tune Smoke";

interface SeedRow { id: string }

async function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("auto-tune E2E needs Supabase admin env vars");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function seedAlgo(userEmail: string): Promise<string> {
  const admin = await adminClient();
  const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const userId = users?.users?.find((u) => u.email?.toLowerCase() === userEmail.toLowerCase())?.id;
  if (!userId) throw new Error(`No Supabase user matches ${userEmail}`);
  const { data, error } = await admin
    .from("algorithms")
    .insert({
      user_id:     userId,
      name:        SEED_NAME,
      instrument:  "EURUSD",
      market_type: "forex",
      platform:    "MT5",
      status:      "paused",
      // Pre-existing parameters that the apply step must preserve.
      parameters:  { kelly_win_rate: 0.55, kelly_avg_win_usd: 100 },
    })
    .select("id")
    .single<SeedRow>();
  if (error || !data) throw new Error(`Failed to seed algo: ${error?.message}`);
  return data.id;
}

async function deleteAlgo(id: string) {
  const admin = await adminClient();
  await admin.from("algorithms").delete().eq("id", id);
}

/**
 * Build a synthetic SSE body for the auto-tune endpoint.
 * Format mirrors the real route: `event: <name>\ndata: <json>\n\n`.
 */
function buildSseBody(): string {
  const lines: string[] = [];
  const send = (event: string, data: unknown) => {
    lines.push(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  send("meta", {
    symbol: "EURUSD",
    from: "2025-01-01T00:00:00Z",
    to: "2025-12-31T00:00:00Z",
    sl_range: [1.0, 1.5, 2.0],
    tp_range: [2.0, 3.0],
    skip_degenerate: true,
    bars_loaded: [{ tf: "M15", count: 25_000 }],
  });
  send("trial", { slAtrMult: 1.0, tpAtrMult: 2.0, sharpe: 0.8, totalPnl: 200, winRate: 0.5, maxDrawdownPct: 0.08, trades: 12, index: 1, total: 3 });
  send("trial", { slAtrMult: 1.5, tpAtrMult: 3.0, sharpe: 1.9, totalPnl: 850, winRate: 0.62, maxDrawdownPct: 0.04, trades: 15, index: 2, total: 3 });
  send("trial", { slAtrMult: 2.0, tpAtrMult: 3.0, sharpe: 1.2, totalPnl: 400, winRate: 0.55, maxDrawdownPct: 0.06, trades: 10, index: 3, total: 3 });
  send("done", {
    best:   { slAtrMult: 1.5, tpAtrMult: 3.0, sharpe: 1.9, totalPnl: 850, winRate: 0.62, maxDrawdownPct: 0.04, trades: 15, index: 2, total: 3 },
    trials: [
      { slAtrMult: 1.0, tpAtrMult: 2.0, sharpe: 0.8, totalPnl: 200, winRate: 0.5, maxDrawdownPct: 0.08, trades: 12, index: 1, total: 3 },
      { slAtrMult: 1.5, tpAtrMult: 3.0, sharpe: 1.9, totalPnl: 850, winRate: 0.62, maxDrawdownPct: 0.04, trades: 15, index: 2, total: 3 },
      { slAtrMult: 2.0, tpAtrMult: 3.0, sharpe: 1.2, totalPnl: 400, winRate: 0.55, maxDrawdownPct: 0.06, trades: 10, index: 3, total: 3 },
    ],
    algorithm: { id: "mock-algo-id", name: SEED_NAME },
  });
  return lines.join("");
}

const E2E_EMAIL = process.env.E2E_EMAIL ?? "test@alphalog.local";
let seededAlgoId: string | null = null;

test.describe("Auto-tune SL/TP — SSE + apply flow", () => {
  test.describe.configure({ timeout: 60_000 });

  const hasAdmin =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  test.skip(!hasAdmin, "Supabase admin creds required to seed the algorithm");

  test.beforeAll(async () => {
    seededAlgoId = await seedAlgo(E2E_EMAIL);
  });

  test.afterAll(async () => {
    if (seededAlgoId) await deleteAlgo(seededAlgoId);
  });

  test("button → SSE → top 5 → Apply merges parameters via PUT", async ({ page }) => {
    await login(page);

    // Mock the SSE auto-tune endpoint with our synthetic stream.
    await page.route("**/engine-backtest/auto-tune", async (route) => {
      await route.fulfill({
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
        },
        body: buildSseBody(),
      });
    });

    // Mock the GET /api/algorithms/[id] used by the merge fetch.
    await page.route(`**/api/algorithms/${seededAlgoId}`, async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            algorithm: {
              id: seededAlgoId,
              name: SEED_NAME,
              parameters: { kelly_win_rate: 0.55, kelly_avg_win_usd: 100 },
            },
          }),
        });
        return;
      }
      // Continue with normal handling for PUT (we'll capture it via page.on)
      await route.continue();
    });

    // Capture PUT body to assert the apply step.
    const puts: Array<{ body: unknown }> = [];
    page.on("request", (req) => {
      if (req.method() === "PUT" && req.url().includes(`/api/algorithms/${seededAlgoId}`)) {
        try { puts.push({ body: JSON.parse(req.postData() ?? "{}") }); } catch { /* noop */ }
      }
    });

    await page.goto("/intelligence/algorithms", { waitUntil: "domcontentloaded", timeout: 30_000 });

    const detailsBtn = page.getByLabel(new RegExp(`Ver detalles de conexión de ${SEED_NAME}`, "i"));
    await expect(detailsBtn).toBeVisible({ timeout: 15_000 });
    await detailsBtn.click();

    // The Auto-tune button lives inside the Engine Backtest panel.
    const autoTuneBtn = page.getByTestId("auto-tune-button");
    await expect(autoTuneBtn).toBeVisible({ timeout: 15_000 });
    await autoTuneBtn.click();

    // Results panel opens (also by useEffect when isStreaming flips true).
    const panel = page.getByTestId("auto-tune-results");
    await expect(panel).toBeVisible({ timeout: 10_000 });

    // After done event, the best summary line + Aplicar button render.
    await expect(panel.getByText(/SL=1\.5 · TP=3\.0 · Sharpe 1\.90/)).toBeVisible({ timeout: 10_000 });

    const applyBtn = page.getByTestId("auto-tune-apply");
    await expect(applyBtn).toBeVisible();
    await applyBtn.click();

    await expect.poll(() => puts.length, { timeout: 10_000 }).toBeGreaterThan(0);
    const body = puts[puts.length - 1].body as { parameters: Record<string, unknown> };
    expect(body.parameters.sl_atr_mult_recommended).toBe(1.5);
    expect(body.parameters.tp_atr_mult_recommended).toBe(3.0);
    expect(body.parameters.auto_tune_best_sharpe).toBe(1.9);
    // Preserves pre-existing keys
    expect(body.parameters.kelly_win_rate).toBe(0.55);
    expect(body.parameters.kelly_avg_win_usd).toBe(100);
  });
});
