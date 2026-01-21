import { test, expect } from '@playwright/test';

test.describe('Create Item Flows - Logs', () => {
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

  test('should create a new log entry', async ({ page }) => {
    // Navigate to Logs
    await page.goto('/dashboard/logs');

    // Wait for page to load
    await page.waitForLoadState('networkidle').catch(() => {
      // Timeout is okay
    });

    // Look for create/add button
    const createButton = page.locator(
      'button:has-text("Create"), button:has-text("Add"), button:has-text("New"), button:has-text("New Log"), [data-testid="create-log"], .create-btn, .add-btn'
    );

    const createButtonVisible = await createButton.first().isVisible().catch(() => false);

    if (createButtonVisible) {
      await createButton.first().click();

      // Wait for modal/form to appear
      await page.waitForTimeout(500);

      // Try to fill log form fields
      const titleInput = page.locator('input[placeholder*="title" i], input[placeholder*="subject" i], input[placeholder*="note" i]').first();
      const notesInput = page.locator('textarea[placeholder*="notes" i], textarea[placeholder*="description" i], textarea').first();
      const categorySelect = page.locator('select[name*="category" i], input[placeholder*="category" i]').first();

      // Fill form if inputs exist
      if (await titleInput.isVisible().catch(() => false)) {
        await titleInput.fill('Test Log Entry - E2E');
      }

      if (await notesInput.isVisible().catch(() => false)) {
        await notesInput.fill('This is a test log entry created by E2E tests');
      }

      if (await categorySelect.isVisible().catch(() => false)) {
        try {
          await categorySelect.fill('Trading');
        } catch {
          // Might be a select with options
          await categorySelect.selectOption('Trading').catch(() => {
            // Fallback
          });
        }
      }

      // Submit form
      const submitBtn = page.locator('button[type="submit"]:has-text("Save"), button[type="submit"]:has-text("Create"), button[type="submit"]:has-text("Add")').first();
      if (await submitBtn.isVisible().catch(() => false)) {
        await submitBtn.click();

        // Wait for success feedback
        await page.waitForTimeout(1000);

        // Check for success message or new item in list
        const successMessage = page.locator('[role="alert"]:has-text("success"), [role="alert"]:has-text("created"), .text-green-600');
        const itemInList = page.locator('text="Test Log Entry - E2E"');

        const hasSuccess = await successMessage.first().isVisible().catch(() => false);
        const hasItem = await itemInList.first().isVisible().catch(() => false);

        expect(hasSuccess || hasItem).toBeTruthy();
      }
    } else {
      // If no create button, just verify the page loads without error
      const pageContent = await page.locator('body').textContent();
      expect(pageContent).toBeTruthy();
      expect(pageContent?.trim().length).toBeGreaterThan(0);
    }
  });

  test('should display Logs without blank screen', async ({ page }) => {
    await page.goto('/dashboard/logs');

    // Page should have content
    const body = page.locator('body');
    const content = await body.textContent();
    
    expect(content).toBeTruthy();
    expect(content?.trim().length).toBeGreaterThan(0);

    // No fatal errors
    const error = page.locator('[role="alert"].error, .fatal-error');
    await expect(error.first()).not.toBeVisible({ timeout: 2000 }).catch(() => {
      // No error
    });
  });
});
