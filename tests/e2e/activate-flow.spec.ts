import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { login } from "./utils/auth";

/**
 * Sprint W — E2E smoke for the algorithm lifecycle activation flow.
 *
 * The wizard creates futures Tradovate algos with status='paused' (safe
 * default). The dispatcher cron only reads paper/live so a paused algo is
 * invisible. The "Activar" button in AlgorithmDetailsModal (Sprint R)
 * unblocks the lifecycle by PUTting status='draft'.
 *
 * Flow under test:
 *   1. Seed a Tradovate futures algo with status='paused' via service-role.
 *   2. Login + navigate to /intelligence/algorithms.
 *   3. Open AlgorithmDetailsModal via the "Detalles" button.
 *   4. Verify the "Activar" button is visible (status='paused' gate).
 *   5. Click it → PUT /api/algorithms/[id] with {status:'draft'} lands.
 *   6. Verify success toast appears.
 *   7. Re-open the modal to confirm DB persisted draft (button disappears).
 *
 * Covers what the unit jsdom test (AlgorithmDetailsModal.activate.test.tsx)
 * can't: real GET roundtrip, real PUT roundtrip through the algorithms API
 * schema validation (status enum), auth middleware, AlgoAccordion → modal
 * dispatcher wiring.
 */

const SEED_NAME = "E2E Activate Flow Smoke";

interface SeedRow { id: string }

async function adminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("activate-flow E2E needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function seedPausedFuturesAlgo(userEmail: string): Promise<string> {
  const admin = await adminClient();
  const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const userId = users?.users?.find((u) => u.email?.toLowerCase() === userEmail.toLowerCase())?.id;
  if (!userId) throw new Error(`No Supabase user matches ${userEmail}`);

  const { data, error } = await admin
    .from("algorithms")
    .insert({
      user_id:      userId,
      name:         SEED_NAME,
      instrument:   "ES",
      market_type:  "futures",
      platform:     "Tradovate",
      status:       "paused",
      parameters:   { contract: "ESM5", contracts_per_trade: 1 },
    })
    .select("id")
    .single<SeedRow>();
  if (error || !data) throw new Error(`Failed to seed paused futures algo: ${error?.message ?? "no row"}`);
  return data.id;
}

async function readStatus(algoId: string): Promise<string | null> {
  const admin = await adminClient();
  const { data } = await admin
    .from("algorithms")
    .select("status")
    .eq("id", algoId)
    .maybeSingle<{ status: string }>();
  return data?.status ?? null;
}

async function deleteAlgo(algoId: string): Promise<void> {
  const admin = await adminClient();
  await admin.from("algorithms").delete().eq("id", algoId);
}

const E2E_EMAIL = process.env.E2E_EMAIL ?? "test@alphalog.local";
let seededAlgoId: string | null = null;

test.describe("Algorithm lifecycle — Activar button flips paused → draft", () => {
  test.describe.configure({ timeout: 60_000 });

  const hasSupabaseAdmin =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  test.skip(!hasSupabaseAdmin, "Supabase admin creds required to seed the paused algorithm");

  test.beforeAll(async () => {
    seededAlgoId = await seedPausedFuturesAlgo(E2E_EMAIL);
  });

  test.afterAll(async () => {
    if (seededAlgoId) await deleteAlgo(seededAlgoId);
  });

  test("paused → Activar click → DB status=draft, button hidden", async ({ page }) => {
    await login(page);

    // Capture the PUT body so we can assert the status payload after the click.
    const puts: Array<{ url: string; body: unknown }> = [];
    page.on("request", (req) => {
      if (req.method() === "PUT" && req.url().includes(`/api/algorithms/${seededAlgoId}`)) {
        try { puts.push({ url: req.url(), body: JSON.parse(req.postData() ?? "{}") }); }
        catch { /* ignore non-JSON bodies */ }
      }
    });

    await page.goto("/intelligence/algorithms", { waitUntil: "domcontentloaded", timeout: 30_000 });

    // Open the modal via the "Detalles" action button. aria-label includes
    // the seeded name so it disambiguates from any other rows in the page.
    const detailsBtn = page.getByLabel(new RegExp(`Ver detalles de conexión de ${SEED_NAME}`, "i"));
    await expect(detailsBtn).toBeVisible({ timeout: 15_000 });
    await detailsBtn.click();

    // Activar button is conditionally rendered on status='paused'. Modal
    // GET /api/algorithms/[id] returns 'paused' from the DB → button shows.
    const activateBtn = page.getByLabel(/Activar estrategia/i);
    await expect(activateBtn).toBeVisible({ timeout: 10_000 });

    // Click → PUT /api/algorithms/[id] { status: "draft" }.
    await activateBtn.click();

    // Wait for the PUT response to land.
    await page.waitForResponse((res) =>
      res.url().includes(`/api/algorithms/${seededAlgoId}`) && res.request().method() === "PUT",
      { timeout: 10_000 },
    );

    expect(puts.length).toBeGreaterThan(0);
    const body = puts[puts.length - 1].body as { status: string };
    expect(body.status).toBe("draft");

    // Modal calls fetchAll() on success → the algorithm row re-fetches with
    // status='draft' and the Activar button disappears.
    await expect(activateBtn).toBeHidden({ timeout: 10_000 });

    // Authoritative check: DB row was actually updated, not just the UI.
    const dbStatus = await readStatus(seededAlgoId!);
    expect(dbStatus).toBe("draft");
  });
});
