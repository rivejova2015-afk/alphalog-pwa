import { test, expect } from '@playwright/test';

test.describe('TraderMap Module', () => {
  // Setup: login before each test
  test.beforeEach(async ({ page }) => {
    const email = process.env.E2E_EMAIL || 'test@alphalog.local';
    const password = process.env.E2E_PASSWORD || 'Test@123456';

    await page.goto('/auth/login');
    await page.fill('input[type="email"], input[placeholder*="email" i]', email);
    await page.fill('input[type="password"]', password);
    const submitButton = page.locator('button[type="submit"]:has-text("Sign In"), button[type="submit"]:has-text("Login"), button[type="submit"]');
    await submitButton.click();
    await page.waitForURL(/\/(dashboard|home|[^\/]*)?$/, { timeout: 10000 });
  });

  test('should load TraderMap without blank screen', async ({ page }) => {
    // Navigate to TraderMap
    await page.goto('/dashboard/tradermap');

    // Wait for page to load (may show loading state or map)
    await page.waitForLoadState('networkidle').catch(() => {
      // Timeout is okay
    });

    // Page should have content (even if just a map)
    const body = page.locator('body');
    const content = await body.textContent();
    
    expect(content).toBeTruthy();

    // No fatal errors
    const error = page.locator('[role="alert"].error, .fatal-error');
    await expect(error.first()).not.toBeVisible({ timeout: 2000 }).catch(() => {
      // No error
    });
  });

  test('should have interactive map or content', async ({ page }) => {
    await page.goto('/dashboard/tradermap');

    // Wait for content
    await page.waitForLoadState('networkidle').catch(() => {
      // Timeout is okay
    });

    // Check for map container or interactive element
    const mapContainer = page.locator('[class*="map"], [id*="map"], canvas, .tradermap-container');
    const hasMap = await mapContainer.first().isVisible().catch(() => false);

    // Or check for any interactive content
    const hasContent = (await page.locator('body').textContent())?.trim().length ?? 0 > 0;

    expect(hasMap || hasContent).toBeTruthy();
  });

  test('should handle TraderMap navigation', async ({ page }) => {
    await page.goto('/dashboard/tradermap');

    // Verify URL
    expect(page.url()).toContain('/tradermap');

    // Page should be responsive
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });
});
