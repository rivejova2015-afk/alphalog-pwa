import { test, expect } from "@playwright/test";
import { login } from "./utils/auth";

test.describe("PolyArb Dashboard", () => {
  test.describe.configure({ timeout: 60000 });

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("loads /intelligence/agents/polyarb without server error", async ({ page }) => {
    const response = await page.goto("/intelligence/agents/polyarb", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    const status = response?.status() ?? 0;
    expect(status).not.toBe(500);
    expect(status).not.toBe(503);
  });

  test("renders the polyarb dashboard shell", async ({ page }) => {
    await page.goto("/intelligence/agents/polyarb", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    // Big async dashboard — give the initial fetch time.
    await page.waitForTimeout(2500);
    const content = await page.locator("body").textContent();
    expect(content?.trim().length ?? 0).toBeGreaterThan(0);
  });

  test("loads /dashboard/polyarb (alt route)", async ({ page }) => {
    const response = await page.goto("/dashboard/polyarb", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    const status = response?.status() ?? 0;
    expect(status).not.toBe(500);
  });
});
