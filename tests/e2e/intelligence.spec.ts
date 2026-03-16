import { test, expect } from '@playwright/test';
import { login } from './utils/auth';

test.describe('Intelligence Module', () => {
  test.describe.configure({ timeout: 60000 });

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  // -------------------------------------------------------------------------
  // Top-level route
  // -------------------------------------------------------------------------

  test('should load /intelligence without a blank screen', async ({ page }) => {
    await page.goto('/intelligence', { waitUntil: 'domcontentloaded', timeout: 60000 });

    expect(page.url()).toContain('/intelligence');

    const content = await page.locator('body').textContent();
    expect(content).toBeTruthy();
    expect(content?.trim().length).toBeGreaterThan(0);
  });

  test('should not show a 500 error on /intelligence', async ({ page }) => {
    const response = await page.goto('/intelligence', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    // HTTP response must not be a server error
    const status = response?.status() ?? 0;
    expect(status).not.toBe(500);
    expect(status).not.toBe(503);
  });

  // -------------------------------------------------------------------------
  // Capital Levels tab
  // -------------------------------------------------------------------------

  test('should load /intelligence/tabs/capital-levels without error 500', async ({ page }) => {
    const response = await page.goto('/intelligence/tabs/capital-levels', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    const status = response?.status() ?? 0;
    expect(status).not.toBe(500);
    expect(status).not.toBe(503);

    const content = await page.locator('body').textContent();
    expect(content?.trim().length).toBeGreaterThan(0);
  });

  test('should render meaningful content on the capital-levels tab', async ({ page }) => {
    await page.goto('/intelligence/tabs/capital-levels', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    // Allow client-side rendering to complete
    await page.waitForTimeout(2000);

    const content = await page.locator('body').textContent();
    expect(content?.trim().length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Constraint Solver tab
  // -------------------------------------------------------------------------

  test('should load /intelligence/tabs/constraint-solver without error 500', async ({ page }) => {
    const response = await page.goto('/intelligence/tabs/constraint-solver', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    const status = response?.status() ?? 0;
    expect(status).not.toBe(500);
    expect(status).not.toBe(503);

    const content = await page.locator('body').textContent();
    expect(content?.trim().length).toBeGreaterThan(0);
  });

  test('should render meaningful content on the constraint-solver tab', async ({ page }) => {
    await page.goto('/intelligence/tabs/constraint-solver', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    await page.waitForTimeout(2000);

    const content = await page.locator('body').textContent();
    expect(content?.trim().length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Should not redirect to auth when logged in
  // -------------------------------------------------------------------------

  test('should not redirect to /auth from /intelligence when logged in', async ({ page }) => {
    await page.goto('/intelligence', { waitUntil: 'domcontentloaded', timeout: 60000 });
    expect(page.url()).not.toMatch(/\/auth/);
  });

  // -------------------------------------------------------------------------
  // Other known routes
  // -------------------------------------------------------------------------

  test('should load /intelligence/calendar without a server error', async ({ page }) => {
    const response = await page.goto('/intelligence/calendar', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    const status = response?.status() ?? 0;
    expect(status).not.toBe(500);
    expect(status).not.toBe(503);

    const content = await page.locator('body').textContent();
    expect(content?.trim().length).toBeGreaterThan(0);
  });

  test('should load /intelligence/news without a server error', async ({ page }) => {
    const response = await page.goto('/intelligence/news', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    const status = response?.status() ?? 0;
    expect(status).not.toBe(500);
    expect(status).not.toBe(503);

    const content = await page.locator('body').textContent();
    expect(content?.trim().length).toBeGreaterThan(0);
  });
});
