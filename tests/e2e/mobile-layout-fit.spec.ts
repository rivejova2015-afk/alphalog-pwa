import { test, expect, devices } from "@playwright/test";
import { login } from "./utils/auth";

const mobileRoutes = [
  "/auth",
  "/dashboard/tradehub",
  "/dashboard/treasury",
  "/dashboard/terminal",
  "/dashboard/tradermap",
  "/dashboard/business",
  "/dashboard/logs",
];

test.describe("Mobile layout fit", () => {
  test.skip(({ browserName }) => browserName !== "webkit", "iPhone Safari checks run only on WebKit");
  const iphone = devices["iPhone 12"];
  test.use({
    viewport: iphone.viewport,
    userAgent: iphone.userAgent,
    deviceScaleFactor: iphone.deviceScaleFactor,
    isMobile: iphone.isMobile,
    hasTouch: iphone.hasTouch,
  });

  test("auth inputs use at least 16px on iPhone", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/auth", { waitUntil: "domcontentloaded" });

    const emailInput = page.locator('input[type="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    const emailSize = await emailInput.evaluate((node) => {
      return Number.parseFloat(window.getComputedStyle(node).fontSize);
    });
    const passwordSize = await passwordInput.evaluate((node) => {
      return Number.parseFloat(window.getComputedStyle(node).fontSize);
    });

    expect(emailSize).toBeGreaterThanOrEqual(16);
    expect(passwordSize).toBeGreaterThanOrEqual(16);
  });

  for (const route of mobileRoutes.filter((route) => route !== "/auth")) {
    test(`${route} has no horizontal overflow`, async ({ page }) => {
      await login(page);
      await page.goto(route, { waitUntil: "domcontentloaded", timeout: 60000 });

      const viewport = page.viewportSize();
      const width = viewport?.width ?? 390;

      const metrics = await page.evaluate(() => {
        return {
          htmlWidth: document.documentElement.scrollWidth,
          bodyWidth: document.body.scrollWidth,
          innerWidth: window.innerWidth,
        };
      });

      expect(metrics.innerWidth).toBe(width);
      expect(metrics.htmlWidth).toBeLessThanOrEqual(metrics.innerWidth + 1);
      expect(metrics.bodyWidth).toBeLessThanOrEqual(metrics.innerWidth + 1);
    });
  }
});
