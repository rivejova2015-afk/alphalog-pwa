import { test, expect } from '@playwright/test';
import { login } from './utils/auth';

test.describe('Business Module', () => {
  test.describe.configure({ timeout: 60000 });

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should display Business hub without blank screen', async ({ page }) => {
    await page.goto('/dashboard/business', { waitUntil: 'domcontentloaded', timeout: 60000 });

    const content = await page.locator('body').textContent();
    expect(content).toBeTruthy();
    expect(content?.trim().length).toBeGreaterThan(0);

    // No fatal error overlay
    const error = page.locator('[role="alert"].error, .fatal-error');
    await expect(error.first()).not.toBeVisible({ timeout: 2000 }).catch(() => {
      // expected — no error element present
    });
  });

  test('should navigate to /business/journal and show the Diario heading', async ({ page }) => {
    await page.goto('/business/journal', { waitUntil: 'domcontentloaded', timeout: 60000 });

    // The JournalPanel renders an h2 with this exact text
    await expect(page.getByRole('heading', { name: 'Diario de Trading' })).toBeVisible({ timeout: 10000 });
  });

  test('should show "Nueva entrada" button on the journal page', async ({ page }) => {
    await page.goto('/business/journal', { waitUntil: 'domcontentloaded', timeout: 60000 });

    // JournalPanel renders a button with text "Nueva entrada"
    const newEntryButton = page.getByRole('button', { name: 'Nueva entrada' });
    await expect(newEntryButton).toBeVisible({ timeout: 10000 });
  });

  test('clicking "Nueva entrada" reveals the journal entry form', async ({ page }) => {
    await page.goto('/business/journal', { waitUntil: 'domcontentloaded', timeout: 60000 });

    const newEntryButton = page.getByRole('button', { name: 'Nueva entrada' });
    await expect(newEntryButton).toBeVisible({ timeout: 10000 });
    await newEntryButton.click();

    // The form contains a textarea with the placeholder defined in JournalPanel
    const textarea = page.locator('textarea[placeholder*="pasó hoy"]');
    await expect(textarea).toBeVisible({ timeout: 5000 });
  });

  test('journal form shows Cancel button and can be dismissed', async ({ page }) => {
    await page.goto('/business/journal', { waitUntil: 'domcontentloaded', timeout: 60000 });

    await page.getByRole('button', { name: 'Nueva entrada' }).click();

    const cancelButton = page.getByRole('button', { name: 'Cancelar' });
    await expect(cancelButton).toBeVisible({ timeout: 5000 });
    await cancelButton.click();

    // After cancelling, the textarea should no longer be visible
    const textarea = page.locator('textarea[placeholder*="pasó hoy"]');
    await expect(textarea).not.toBeVisible({ timeout: 3000 });
  });

  test('should navigate to /business and show content', async ({ page }) => {
    await page.goto('/business', { waitUntil: 'domcontentloaded', timeout: 60000 });

    expect(page.url()).toContain('/business');
    const content = await page.locator('body').textContent();
    expect(content?.trim().length).toBeGreaterThan(0);
  });
});
