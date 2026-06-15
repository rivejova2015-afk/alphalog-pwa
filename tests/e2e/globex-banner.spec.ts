import { test, expect } from "@playwright/test";
import { login } from "./utils/auth";
import { isGlobexOpen } from "@/lib/cme/market-hours";

/**
 * Sprint EE — E2E smoke for the GlobexStatusBanner (Sprint BB).
 *
 * The banner is a server component that reads isGlobexOpen() at render
 * time. We can't override the server's clock from Playwright, so this
 * spec exercises both branches dynamically based on when the test runs:
 *
 *   - If Globex is OPEN at test time → banner must NOT appear.
 *   - If Globex is CLOSED at test time → banner MUST appear with the
 *     expected explanatory text.
 *
 * isGlobexOpen is a pure function on a Date — we compute the truth in the
 * test runner and assert the matching UI. Both branches are valid passes;
 * the spec catches regressions like "banner stuck rendering forever" or
 * "banner crashes the page" without depending on time-of-day.
 *
 * Unit coverage in src/components/intelligence/algorithms/__tests__/
 * GlobexStatusBanner.test.tsx covers the conditional render with the
 * helper mocked; this spec covers the server-component → real-helper
 * → page-render integration.
 */

test.describe("GlobexStatusBanner — /intelligence/algorithms integration", () => {
  test.describe.configure({ timeout: 60_000 });

  test("page renders cleanly; banner matches isGlobexOpen() at request time", async ({ page }) => {
    await login(page);
    await page.goto("/intelligence/algorithms", { waitUntil: "domcontentloaded", timeout: 30_000 });

    // The page header should always render — proves the server component
    // didn't crash even if the banner threw.
    await expect(page.getByText(/Algorithmic Trading|Algorithms|estrategias/i).first())
      .toBeVisible({ timeout: 15_000 });

    const isOpen = isGlobexOpen();
    const banner = page.getByText(/CME Globex cerrado/i);

    if (isOpen) {
      // Globex open right now → banner should NOT be in the DOM.
      await expect(banner).toBeHidden();
    } else {
      // Globex closed → banner visible with the explanatory hint about
      // forex/crypto being unaffected.
      await expect(banner).toBeVisible({ timeout: 5_000 });
      await expect(page.getByText(/Dom 18:00 ET → Vie 17:00 ET/i)).toBeVisible();
      await expect(page.getByText(/forex.*MT4\/MT5.*y crypto.*Coinarb.*no se ven afectados/i))
        .toBeVisible();
    }
  });
});
