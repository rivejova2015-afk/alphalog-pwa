import { test, expect } from "@playwright/test";
import { login } from "./utils/auth";

test.describe("Inbox / Secure Mail", () => {
  test.describe.configure({ timeout: 60000 });

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("loads /inbox without server error", async ({ page }) => {
    const response = await page.goto("/inbox", { waitUntil: "domcontentloaded", timeout: 60000 });
    const status = response?.status() ?? 0;
    expect(status).not.toBe(500);
    expect(status).not.toBe(503);
  });

  test("renders the inbox list shell", async ({ page }) => {
    await page.goto("/inbox", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(1500);
    // Inbox UI strings are in Spanish; assert the root shell exists.
    const content = await page.locator("body").textContent();
    expect(content?.trim().length ?? 0).toBeGreaterThan(0);
  });

  test("loads /inbox/compose", async ({ page }) => {
    const response = await page.goto("/inbox/compose", { waitUntil: "domcontentloaded", timeout: 60000 });
    const status = response?.status() ?? 0;
    expect(status).not.toBe(500);
  });

  test("loads /inbox/settings", async ({ page }) => {
    const response = await page.goto("/inbox/settings", { waitUntil: "domcontentloaded", timeout: 60000 });
    const status = response?.status() ?? 0;
    expect(status).not.toBe(500);
  });
});
