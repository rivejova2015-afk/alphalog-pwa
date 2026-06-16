// E2E for TradovateConnectModal flow.
//
// Seeds a futures Tradovate algo + an algo_cme_accounts row so the modal can
// be reached from the UI, then mocks /api/cme/connect with page.route() so we
// don't depend on a real Tradovate sandbox. Covers:
//   1. Happy path: fill creds → submit → success callback fires → modal closes.
//   2. Auth failure: invalid creds → modal stays open with error visible.
//
// Why mocked: hitting the real Tradovate API in CI would require live demo
// credentials and would be flaky against their rate limits. The unit tests
// added in PR #23 (TradovateConnectModal.test.tsx + route.test.ts) cover the
// internal contract; this spec verifies the UI wiring works against a real
// browser through real navigation + DOM.

import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { login } from "./utils/auth";

const SEED_NAME = "E2E Tradovate Connect Smoke";

interface SeedRow { id: string }
interface CmeAccountSeed { id: string }

async function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("tradovate-connect E2E needs Supabase admin env vars");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function resolveUserId(email: string): Promise<string> {
  const admin = await adminClient();
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const id = data?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
  if (!id) throw new Error(`No Supabase user matches ${email}`);
  return id;
}

async function seedFuturesAlgoWithCmeAccount(userEmail: string): Promise<{ algoId: string; cmeAccountId: string }> {
  const admin = await adminClient();
  const userId = await resolveUserId(userEmail);

  // 1. Create the CME account row first (referenced by the algo via parameters)
  const { data: cmeAcc, error: cmeErr } = await admin
    .from("algo_cme_accounts")
    .insert({
      user_id: userId,
      provider_name: "TopstepX",
      account_number: "TS-E2E-TEST",
      is_paper: true,
      type: "propfirm",
    })
    .select("id")
    .single<CmeAccountSeed>();
  if (cmeErr || !cmeAcc) throw new Error(`Failed to seed CME account: ${cmeErr?.message}`);

  // 2. Create the algorithm pointing to it
  const { data: algo, error: algoErr } = await admin
    .from("algorithms")
    .insert({
      user_id:     userId,
      name:        SEED_NAME,
      instrument:  "ES",
      market_type: "futures",
      platform:    "Tradovate",
      status:      "paused",
      parameters:  { contract: "ESM5", cme_account_id: cmeAcc.id },
    })
    .select("id")
    .single<SeedRow>();
  if (algoErr || !algo) {
    await admin.from("algo_cme_accounts").delete().eq("id", cmeAcc.id);
    throw new Error(`Failed to seed futures algo: ${algoErr?.message}`);
  }
  return { algoId: algo.id, cmeAccountId: cmeAcc.id };
}

async function cleanup(algoId: string, cmeAccountId: string): Promise<void> {
  const admin = await adminClient();
  await admin.from("algorithms").delete().eq("id", algoId);
  await admin.from("algo_cme_accounts").delete().eq("id", cmeAccountId);
}

const E2E_EMAIL = process.env.E2E_EMAIL ?? "test@alphalog.local";
let seedAlgo: string | null = null;
let seedCme: string | null = null;

test.describe("TradovateConnectModal — submit flow", () => {
  test.describe.configure({ timeout: 60_000 });

  const hasSupabaseAdmin =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  test.skip(!hasSupabaseAdmin, "Supabase admin creds required to seed the rows");

  test.beforeAll(async () => {
    const { algoId, cmeAccountId } = await seedFuturesAlgoWithCmeAccount(E2E_EMAIL);
    seedAlgo = algoId;
    seedCme  = cmeAccountId;
  });

  test.afterAll(async () => {
    if (seedAlgo && seedCme) await cleanup(seedAlgo, seedCme);
  });

  test("happy path: submit valid creds → modal closes via onSuccess", async ({ page }) => {
    await login(page);

    // Mock the connect endpoint to return success without hitting Tradovate.
    let connectCalled = false;
    let receivedBody: Record<string, unknown> | null = null;
    await page.route("**/api/cme/connect", async (route) => {
      connectCalled = true;
      try { receivedBody = JSON.parse(route.request().postData() ?? "{}"); } catch { /* noop */ }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          connectionId: "conn-mock-1",
          tradovateAccountId: 42,
          tradovateAccountName: "TS-E2E-TEST",
        }),
      });
    });

    await page.goto("/intelligence/algorithms", { waitUntil: "domcontentloaded", timeout: 30_000 });

    // Find and open the seeded algo's modal via "Detalles".
    const detailsBtn = page.getByLabel(new RegExp(`Ver detalles de conexión de ${SEED_NAME}`, "i"));
    await expect(detailsBtn).toBeVisible({ timeout: 15_000 });
    await detailsBtn.click();

    // The Tradovate connect button only renders when there's no active
    // connection. We seeded without one, so it should be visible.
    const connectBtn = page.getByRole("button", { name: /Conectar.*Tradovate/i }).first();
    await expect(connectBtn).toBeVisible({ timeout: 10_000 });
    await connectBtn.click();

    // Modal should be open now
    const dialog = page.getByRole("dialog", { name: /Conectar a Tradovate/i });
    await expect(dialog).toBeVisible();

    // Fill the form
    await dialog.getByPlaceholder("tu-usuario-tradovate").fill("alice@example.com");
    await dialog.getByPlaceholder("••••••••").fill("mock-password");

    // Submit
    await dialog.getByRole("button", { name: /Conectar/i }).click();

    // Wait for the mocked /api/cme/connect call to land
    await expect.poll(() => connectCalled, { timeout: 10_000 }).toBe(true);
    expect(receivedBody).toMatchObject({
      cmeAccountId: seedCme,
      tradovateUsername: "alice@example.com",
      tradovatePassword: "mock-password",
    });

    // Modal closes via onSuccess + onClose
    await expect(dialog).toBeHidden({ timeout: 10_000 });
  });

  test("auth failure: invalid creds → modal stays open with error visible", async ({ page }) => {
    await login(page);

    await page.route("**/api/cme/connect", async (route) => {
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ error: "Tradovate auth failed: Invalid credentials" }),
      });
    });

    await page.goto("/intelligence/algorithms", { waitUntil: "domcontentloaded", timeout: 30_000 });

    const detailsBtn = page.getByLabel(new RegExp(`Ver detalles de conexión de ${SEED_NAME}`, "i"));
    await expect(detailsBtn).toBeVisible({ timeout: 15_000 });
    await detailsBtn.click();

    const connectBtn = page.getByRole("button", { name: /Conectar.*Tradovate/i }).first();
    await expect(connectBtn).toBeVisible({ timeout: 10_000 });
    await connectBtn.click();

    const dialog = page.getByRole("dialog", { name: /Conectar a Tradovate/i });
    await expect(dialog).toBeVisible();

    await dialog.getByPlaceholder("tu-usuario-tradovate").fill("alice@example.com");
    await dialog.getByPlaceholder("••••••••").fill("wrong");
    await dialog.getByRole("button", { name: /Conectar/i }).click();

    // Modal stays open, error message renders inside
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/Tradovate auth failed/)).toBeVisible({ timeout: 10_000 });
  });
});
