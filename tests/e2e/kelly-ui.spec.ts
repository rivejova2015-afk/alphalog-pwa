import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { login } from "./utils/auth";

/**
 * Sprint Q — E2E smoke for the Kelly position-sizing UI (Sprint O).
 *
 * Flow under test:
 *  1. Seed a `futures` algorithm with Tradovate platform + auto-populated
 *     Kelly stats already in `parameters` (mimics what engine-backtest
 *     would persist after a real run).
 *  2. Login, navigate to /intelligence/algorithms.
 *  3. Click "Detalles" on the seeded algo to open AlgorithmDetailsModal.
 *  4. Verify the KellySection renders with the stats panel showing the
 *     auto-populated values + "Auto-poblado" badge.
 *  5. Toggle the "Activar Kelly sizing" checkbox + click Save.
 *  6. Verify the PUT call lands with the merged parameters including
 *     kelly_enabled: true.
 *
 * Why a smoke and not a deep test: the unit jsdom test
 * (AlgorithmDetailsModal.kelly.test.tsx) already covers the internal
 * render branches + the rejection path when stats are missing. This spec
 * covers what jsdom can't: server middleware, the real GET endpoints
 * roundtrip, and the dispatcher between AlgoAccordion and the modal.
 *
 * Seed/cleanup matches the pattern from backtest-advanced.spec.ts.
 */

const SEED_NAME = "E2E Kelly UI Smoke (Tradovate)";

interface SeedRow {
  id: string;
}

async function seedFuturesAlgo(userEmail: string): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("kelly-ui E2E needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY");
  }
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const userId = users?.users?.find((u) => u.email?.toLowerCase() === userEmail.toLowerCase())?.id;
  if (!userId) throw new Error(`No Supabase user matches ${userEmail}`);

  const parameters = {
    contract:                "ESM5",
    contracts_per_trade:     1,
    kelly_win_rate:          0.58,
    kelly_avg_win_usd:       140,
    kelly_avg_loss_usd:      70,
    kelly_inputs_sample_size: 42,
    kelly_inputs_updated_at:  new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    kelly_inputs_source:      "engine_backtest:e2e-smoke",
  };

  const { data, error } = await admin
    .from("algorithms")
    .insert({
      user_id:      userId,
      name:         SEED_NAME,
      instrument:   "ES",
      market_type:  "futures",
      platform:     "Tradovate",
      status:       "paper",
      parameters,
    })
    .select("id")
    .single<SeedRow>();
  if (error || !data) throw new Error(`Failed to seed futures algo: ${error?.message ?? "no row"}`);
  return data.id;
}

async function deleteAlgo(algoId: string): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await admin.from("algorithms").delete().eq("id", algoId);
}

const E2E_EMAIL = process.env.E2E_EMAIL ?? "test@alphalog.local";
let seededAlgoId: string | null = null;

test.describe("Kelly UI — futures algorithm details modal", () => {
  test.describe.configure({ timeout: 60_000 });

  const hasSupabaseAdmin =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  test.skip(!hasSupabaseAdmin, "Supabase admin creds required to seed a futures algorithm");

  test.beforeAll(async () => {
    seededAlgoId = await seedFuturesAlgo(E2E_EMAIL);
  });

  test.afterAll(async () => {
    if (seededAlgoId) await deleteAlgo(seededAlgoId);
  });

  test("renders KellySection with auto-populated stats and PUTs on save", async ({ page }) => {
    await login(page);

    // Capture PUT calls so we can assert on the merged params body.
    const putCalls: Array<{ url: string; body: unknown }> = [];
    page.on("request", (req) => {
      if (req.method() === "PUT" && req.url().includes(`/api/algorithms/${seededAlgoId}`)) {
        try { putCalls.push({ url: req.url(), body: JSON.parse(req.postData() ?? "{}") }); }
        catch { /* ignore non-JSON bodies */ }
      }
    });

    await page.goto("/intelligence/algorithms", { waitUntil: "domcontentloaded", timeout: 30_000 });

    // Open the modal via the "Detalles" action button (aria-label includes
    // the seeded algo name to disambiguate from other rows).
    const detailsBtn = page.getByLabel(new RegExp(`Ver detalles de conexión de ${SEED_NAME}`, "i"));
    await expect(detailsBtn).toBeVisible({ timeout: 15_000 });
    await detailsBtn.click();

    // KellySection renders for futures algos.
    await expect(page.getByText(/Position Sizing — Kelly Criterion/i)).toBeVisible({ timeout: 10_000 });
    // Stats badge = "Auto-poblado" because parameters has the 3 stat fields.
    await expect(page.getByText(/Auto-poblado/i)).toBeVisible();
    // Win rate rendered as percent (0.58 → 58.0%).
    await expect(page.getByText(/58\.0%/)).toBeVisible();
    // Avg win + avg loss as USD.
    await expect(page.getByText(/\$140\.00/)).toBeVisible();
    await expect(page.getByText(/\$70\.00/)).toBeVisible();
    // Sample size readout.
    await expect(page.getByText(/42 trades/i)).toBeVisible();

    // Toggle enabled + save.
    const enableBox = page.getByLabel(/Activar Kelly sizing/i);
    await enableBox.check();
    await page.getByRole("button", { name: /Guardar Kelly config/i }).click();

    // PUT body should preserve existing params + add kelly_enabled.
    await page.waitForResponse((res) =>
      res.url().includes(`/api/algorithms/${seededAlgoId}`) && res.request().method() === "PUT",
      { timeout: 10_000 },
    );

    expect(putCalls.length).toBeGreaterThan(0);
    const lastPut = putCalls[putCalls.length - 1].body as { parameters: Record<string, unknown> };
    expect(lastPut.parameters.kelly_enabled).toBe(true);
    expect(lastPut.parameters.kelly_fraction).toBe(0.5);
    expect(lastPut.parameters.kelly_min_contracts).toBe(1);
    expect(lastPut.parameters.kelly_max_contracts).toBe(10);
    // Stats preserved (NOT overwritten by the user save).
    expect(lastPut.parameters.kelly_win_rate).toBe(0.58);
    expect(lastPut.parameters.kelly_avg_win_usd).toBe(140);
    // Unrelated existing keys preserved.
    expect(lastPut.parameters.contract).toBe("ESM5");
    expect(lastPut.parameters.contracts_per_trade).toBe(1);
  });
});
