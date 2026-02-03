import { test as base, expect } from '@playwright/test';
import { login } from './utils/auth';

/**
 * Auth fixture for E2E tests
 * Handles login before each test
 */
export const test = base.extend({
  authenticatedPage: async ({ page }, use) => {
    await login(page);
    await expect(page).toHaveURL(/.*\/dashboard/);

    // Use the authenticated page
    await use(page);
  },
});

export { expect };
