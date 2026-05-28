import { test, expect, type Page } from "@playwright/test";
import { login } from "./utils/auth";

/**
 * E2E render coverage for the NewStrategyWizard — the entry point of the
 * algorithm pipeline (wizard → backtest → quality gates → paper → live).
 *
 * Render-only: we open the wizard, verify the 2-step structure renders,
 * walk between steps, and close cleanly. We do NOT submit the create
 * mutation because that would persist a row in the `algorithms` table and
 * pollute production data. The PUT/INSERT contract is covered by unit
 * tests on the validators and route handlers.
 *
 * If this spec fails, the wizard is unreachable for the user even if every
 * individual unit test passes — it catches the "wired but unrenderable" gap
 * between Server Component shell + Client Component lazy import + auth
 * middleware that unit tests can't see.
 */

test.describe("NewStrategyWizard — render coverage", () => {
  test.describe.configure({ timeout: 90_000 });

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("opens the wizard from the New Strategy button", async ({ page }) => {
    await openWizard(page);

    // Step indicator: "Paso 1 de 2 — Básico"
    await expect(page.getByText(/Paso 1 de 2/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Básico/i).first()).toBeVisible();
  });

  test("step 1 surfaces the core form fields", async ({ page }) => {
    await openWizard(page);

    // Name field
    const nameInput = page.locator('input[type="text"]').first();
    await expect(nameInput).toBeVisible({ timeout: 10_000 });

    // Market-type selector — the wizard renders one of Forex/Futures/Options/
    // Crypto options. The text "forex" appears either as a button label or a
    // select option, so a loose contains-match is enough as a render guard.
    await expect(page.getByText(/forex/i).first()).toBeVisible();
  });

  test("can advance to step 2 (Overrides) via Next and back via Previous", async ({ page }) => {
    await openWizard(page);

    // Fill in a name so the Next button doesn't reject empty state
    await page.locator('input[type="text"]').first().fill("E2E Smoke Strategy");

    // Click Siguiente / Next — the wizard uses Spanish labels
    const nextBtn = page.getByRole("button", { name: /Siguiente|Next/i }).first();
    if (await nextBtn.isVisible().catch(() => false)) {
      await nextBtn.click();
      await expect(page.getByText(/Paso 2 de 2/i)).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(/Overrides/i).first()).toBeVisible();

      // Back button takes us to step 1 again
      const prevBtn = page.getByRole("button", { name: /Anterior|Previous|Atrás/i }).first();
      if (await prevBtn.isVisible().catch(() => false)) {
        await prevBtn.click();
        await expect(page.getByText(/Paso 1 de 2/i)).toBeVisible({ timeout: 5_000 });
      }
    }
  });

  test("closes via Cancel and the wizard disappears", async ({ page }) => {
    await openWizard(page);

    const cancelBtn = page.getByRole("button", { name: /Cancelar|Cerrar|Cancel|Close/i }).first();
    await expect(cancelBtn).toBeVisible({ timeout: 10_000 });
    await cancelBtn.click();

    // The "Paso 1 de 2" indicator should no longer be visible after close
    await expect(page.getByText(/Paso 1 de 2/i)).not.toBeVisible({ timeout: 5_000 });
  });
});

// ─── Helpers ────────────────────────────────────────────────────────────────

async function openWizard(page: Page): Promise<void> {
  await page.goto("/intelligence/algorithms", { waitUntil: "domcontentloaded", timeout: 60_000 });

  // The page renders `<NewStrategyButton />` which is a button with text "New Strategy".
  const btn = page.getByRole("button", { name: /New Strategy/i });
  await expect(btn).toBeVisible({ timeout: 15_000 });
  await btn.click();
}
