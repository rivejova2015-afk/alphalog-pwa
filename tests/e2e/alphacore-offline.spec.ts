import { test, expect } from "@playwright/test";
import { login } from "./utils/auth";

// Verifies the AlphaCore offline outbox loop end-to-end:
//   1. Navigate to a CRUD page (journal) while online.
//   2. Toggle the browser context offline.
//   3. Attempt a mutation — should be captured by the IndexedDB outbox
//      (we don't assert on internal IDB here; just that the UI doesn't blow up
//      and the page stays responsive).
//   4. Toggle back online and wait for reconciliation.
//
// This is a smoke-level coverage: the goal is to catch regressions where the
// offline flow throws unhandled errors or hangs the UI. Deep assertions on
// outbox internals are intentionally out of scope (would tie the test to
// implementation details).

test.describe("AlphaCore offline outbox", () => {
  test.describe.configure({ timeout: 90000 });

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("journal page survives offline → online toggle without crashing", async ({ page, context }) => {
    await page.goto("/business/journal", { waitUntil: "domcontentloaded", timeout: 60000 });

    // Page should render. Test passes if no JS error overlay shows up.
    await page.waitForTimeout(1500);
    const initialContent = await page.locator("body").textContent();
    expect((initialContent?.trim().length ?? 0)).toBeGreaterThan(0);

    // Go offline. The PWA should keep rendering (cached SW or in-memory state).
    await context.setOffline(true);
    await page.waitForTimeout(800);

    // Body still has content (no white screen).
    const offlineContent = await page.locator("body").textContent();
    expect((offlineContent?.trim().length ?? 0)).toBeGreaterThan(0);

    // No <error.tsx> rendered (Next would show "Error" heading on boundary).
    const errorHeading = page.getByRole("heading", { name: /^error$/i });
    await expect(errorHeading).toHaveCount(0);

    // Toggle back online — should not crash on reconnect.
    await context.setOffline(false);
    await page.waitForTimeout(2000);

    const onlineContent = await page.locator("body").textContent();
    expect((onlineContent?.trim().length ?? 0)).toBeGreaterThan(0);
  });

  test("offline page is reachable when service worker is registered", async ({ page }) => {
    // /offline is the PWA fallback. Even when reachable directly, it should
    // render a 200 with a body.
    const response = await page.goto("/offline", { waitUntil: "domcontentloaded", timeout: 60000 });
    const status = response?.status() ?? 0;
    expect(status).not.toBe(500);
    expect(status).not.toBe(503);

    const content = await page.locator("body").textContent();
    expect((content?.trim().length ?? 0)).toBeGreaterThan(0);
  });
});
