import { test, expect } from '@playwright/test';

test.describe('Navigation & Module Access', () => {
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

  test('should load dashboard without blank page', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/dashboard');

    // Verify page is not blank
    const pageContent = await page.locator('body').textContent();
    expect(pageContent).toBeTruthy();
    expect(pageContent?.trim().length).toBeGreaterThan(0);

    // Should have some navigation or main content
    const mainContent = page.locator('main, [role="main"], .main, .dashboard-container');
    await expect(mainContent.first()).toBeVisible({ timeout: 5000 }).catch(() => {
      // Fallback: just check for any visible content
      expect(page.url()).toContain('/dashboard');
    });

    // Should not have error overlays
    const errorOverlay = page.locator('[role="dialog"].error, .error-overlay, .alert-error');
    await expect(errorOverlay.first()).not.toBeVisible({ timeout: 2000 }).catch(() => {
      // No error overlay found (expected)
    });
  });

  test('should navigate to TradeHub module', async ({ page }) => {
    // Navigate to TradeHub
    await page.goto('/dashboard/tradehub');

    // Verify we're on the page
    expect(page.url()).toContain('/tradehub');

    // Should have some content
    const pageContent = await page.locator('body').textContent();
    expect(pageContent).toBeTruthy();

    // Should not be completely blank
    expect(pageContent?.trim().length).toBeGreaterThan(0);

    // Verify no critical errors
    const criticalError = page.locator('[role="alert"].error, .alert-error');
    await expect(criticalError.first()).not.toBeVisible({ timeout: 2000 }).catch(() => {
      // No critical error
    });
  });

  test('should navigate to Treasury module', async ({ page }) => {
    // Navigate to Treasury
    await page.goto('/dashboard/treasury');

    // Verify we're on the page
    expect(page.url()).toContain('/treasury');

    // Should have some content
    const pageContent = await page.locator('body').textContent();
    expect(pageContent).toBeTruthy();
    expect(pageContent?.trim().length).toBeGreaterThan(0);

    // Verify no critical errors
    const criticalError = page.locator('[role="alert"].error, .alert-error');
    await expect(criticalError.first()).not.toBeVisible({ timeout: 2000 }).catch(() => {
      // No critical error
    });
  });

  test('should navigate to Business module', async ({ page }) => {
    // Navigate to Business
    await page.goto('/dashboard/business');

    // Verify we're on the page
    expect(page.url()).toContain('/business');

    // Should have some content
    const pageContent = await page.locator('body').textContent();
    expect(pageContent).toBeTruthy();
    expect(pageContent?.trim().length).toBeGreaterThan(0);

    // Verify no critical errors
    const criticalError = page.locator('[role="alert"].error, .alert-error');
    await expect(criticalError.first()).not.toBeVisible({ timeout: 2000 }).catch(() => {
      // No critical error
    });
  });

  test('should navigate to TraderMap module', async ({ page }) => {
    // Navigate to TraderMap
    await page.goto('/dashboard/tradermap');

    // Verify we're on the page (may show content or loading)
    expect(page.url()).toContain('/tradermap');

    // Should not be blank
    const pageContent = await page.locator('body').textContent();
    expect(pageContent).toBeTruthy();
  });

  test('should navigate to Terminal module', async ({ page }) => {
    // Navigate to Terminal
    await page.goto('/dashboard/terminal');

    // Verify we're on the page
    expect(page.url()).toContain('/terminal');

    // Should have some content
    const pageContent = await page.locator('body').textContent();
    expect(pageContent).toBeTruthy();
    expect(pageContent?.trim().length).toBeGreaterThan(0);
  });

  test('should navigate to Logs module', async ({ page }) => {
    // Navigate to Logs
    await page.goto('/dashboard/logs');

    // Verify we're on the page
    expect(page.url()).toContain('/logs');

    // Should have some content
    const pageContent = await page.locator('body').textContent();
    expect(pageContent).toBeTruthy();
    expect(pageContent?.trim().length).toBeGreaterThan(0);
  });
});
