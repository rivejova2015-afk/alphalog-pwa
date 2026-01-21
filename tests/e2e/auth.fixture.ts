import { test as base, expect } from '@playwright/test';

/**
 * Auth fixture for E2E tests
 * Handles login before each test
 */
export const test = base.extend({
  authenticatedPage: async ({ page }, use) => {
    // Get credentials from environment
    const email = process.env.E2E_EMAIL || 'test@alphalog.local';
    const password = process.env.E2E_PASSWORD || 'Test@123456';

    // Navigate to login page
    await page.goto('/auth/login');

    // Fill in login form
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);

    // Submit login form
    await page.click('button[type="submit"]');

    // Wait for navigation to dashboard
    await page.waitForURL('/dashboard');

    // Verify we're logged in
    await expect(page).toHaveURL(/.*\/dashboard/);

    // Use the authenticated page
    await use(page);
  },
});

export { expect };
