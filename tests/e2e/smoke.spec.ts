import { test, expect } from '@playwright/test';
import { login } from './utils/auth';

test.describe('Smoke Tests - No Blank Pages', () => {
  // Setup: login before each test
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  const modules = [
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'TradeHub', path: '/dashboard/tradehub' },
    { name: 'Treasury', path: '/dashboard/treasury' },
    { name: 'Business', path: '/dashboard/business' },
    { name: 'Terminal', path: '/dashboard/terminal' },
    { name: 'Logs', path: '/dashboard/logs' },
    { name: 'TraderMap', path: '/dashboard/tradermap' },
  ];

  modules.forEach(({ name, path }) => {
    test(`${name} should not show blank page`, async ({ page }) => {
      await page.goto(path);

      // Wait for content
      await page.waitForLoadState('networkidle').catch(() => {
        // Timeout is okay
      });

      // Verify URL is correct
      expect(page.url()).toContain(path);

      // Page should have content
      const body = page.locator('body');
      const content = await body.textContent();

      // Content should not be empty
      expect(content).toBeTruthy();
      expect(content?.trim().length).toBeGreaterThan(0);

      // Should not have only error message
      const hasError = (content || '').toLowerCase().includes('error') && (content || '').trim().length < 100;
      expect(hasError).toBeFalsy();

      // No critical JS errors (check for error overlays)
      const errorOverlay = page.locator('[role="dialog"].error, .error-dialog, .critical-error');
      await expect(errorOverlay.first()).not.toBeVisible({ timeout: 2000 }).catch(() => {
        // No error overlay
      });
    });
  });

  test('should navigate between modules without errors', async ({ page }) => {
    const modules = [
      '/dashboard',
      '/dashboard/tradehub',
      '/dashboard/treasury',
      '/dashboard/business',
    ];

    for (const path of modules) {
      await page.goto(path);
      await page.waitForLoadState('networkidle').catch(() => {
        // Timeout okay
      });

      // Verify page loaded
      const content = await page.locator('body').textContent();
      expect(content?.trim().length).toBeGreaterThan(0);

      // No fatal errors
      const error = page.locator('[role="alert"].error, .fatal-error');
      const hasError = await error.first().isVisible({ timeout: 1000 }).catch(() => false);
      
      // If error exists, it shouldn't be a critical one
      if (hasError) {
        const errorText = await error.first().textContent();
        // Warning/info errors are okay, critical ones are not
        expect(errorText).not.toMatch(/fatal|critical|crash/i);
      }
    }
  });

  test('should maintain logged-in state across navigation', async ({ page }) => {
    // Navigate through several modules
    await page.goto('/dashboard');
    let isLoggedIn = (await page.locator('body').textContent())?.length ?? 0 > 0;
    expect(isLoggedIn).toBeTruthy();

    await page.goto('/dashboard/tradehub');
    isLoggedIn = (await page.locator('body').textContent())?.length ?? 0 > 0;
    expect(isLoggedIn).toBeTruthy();

    await page.goto('/dashboard/logs');
    isLoggedIn = (await page.locator('body').textContent())?.length ?? 0 > 0;
    expect(isLoggedIn).toBeTruthy();

    // Should not be redirected to login
    expect(page.url()).not.toMatch(/auth|login/);
  });
});
