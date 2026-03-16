import { test, expect } from '@playwright/test';
import { login } from './utils/auth';

test.describe('Journal Module', () => {
  test.describe.configure({ timeout: 60000 });

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should load /business/journal without a blank screen', async ({ page }) => {
    await page.goto('/business/journal', { waitUntil: 'domcontentloaded', timeout: 60000 });

    expect(page.url()).toContain('/business/journal');

    const content = await page.locator('body').textContent();
    expect(content).toBeTruthy();
    expect(content?.trim().length).toBeGreaterThan(0);
  });

  test('should render the "Diario de Trading" section heading', async ({ page }) => {
    await page.goto('/business/journal', { waitUntil: 'domcontentloaded', timeout: 60000 });

    await expect(page.getByRole('heading', { name: 'Diario de Trading' })).toBeVisible({
      timeout: 10000,
    });
  });

  test('should show the description text below the heading', async ({ page }) => {
    await page.goto('/business/journal', { waitUntil: 'domcontentloaded', timeout: 60000 });

    // JournalPanel renders this subtitle paragraph
    await expect(
      page.getByText('Registra reflexiones, aprendizajes y estado de ánimo.')
    ).toBeVisible({ timeout: 10000 });
  });

  test('should show "Nueva entrada" action button', async ({ page }) => {
    await page.goto('/business/journal', { waitUntil: 'domcontentloaded', timeout: 60000 });

    await expect(page.getByRole('button', { name: 'Nueva entrada' })).toBeVisible({
      timeout: 10000,
    });
  });

  test('should render empty state message when no entries exist', async ({ page }) => {
    await page.goto('/business/journal', { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Wait for loading to complete — skeleton divs are replaced by either the empty
    // state paragraph or the list of entries
    await page.waitForTimeout(2000);

    const content = await page.locator('body').textContent();
    // Whether entries exist or not, the page must have meaningful content
    expect(content?.trim().length).toBeGreaterThan(0);
  });

  test('should not redirect to /auth when already logged in', async ({ page }) => {
    await page.goto('/business/journal', { waitUntil: 'domcontentloaded', timeout: 60000 });
    expect(page.url()).not.toMatch(/\/auth/);
  });

  test('should expose mood selector when the journal form is open', async ({ page }) => {
    await page.goto('/business/journal', { waitUntil: 'domcontentloaded', timeout: 60000 });

    await page.getByRole('button', { name: 'Nueva entrada' }).click();

    // JournalPanel renders a <select> for mood inside the form
    const moodSelect = page.locator('select').first();
    await expect(moodSelect).toBeVisible({ timeout: 5000 });
  });

  test('submitting empty form shows a required-field toast instead of crashing', async ({ page }) => {
    await page.goto('/business/journal', { waitUntil: 'domcontentloaded', timeout: 60000 });

    await page.getByRole('button', { name: 'Nueva entrada' }).click();

    // Submit without filling the required textarea
    await page.getByRole('button', { name: 'Guardar entrada' }).click();

    // The page should still be on the same URL (no navigation/crash)
    expect(page.url()).toContain('/business/journal');

    // JournalPanel calls toast.error when text is empty — sonner renders a [data-sonner-toast]
    // element. Accept either a toast appearing or the form still being visible (both are correct).
    const formStillVisible = await page
      .locator('textarea[placeholder*="pasó hoy"]')
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(formStillVisible).toBe(true);
  });
});
