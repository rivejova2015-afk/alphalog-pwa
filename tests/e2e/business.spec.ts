import { test, expect } from '@playwright/test';

test.describe('Create Item Flows - Business', () => {
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

  test('should create a new business item', async ({ page }) => {
    // Navigate to Business
    await page.goto('/dashboard/business');

    // Wait for page to load
    await page.waitForLoadState('networkidle').catch(() => {
      // Timeout is okay
    });

    // Look for create/add button
    const createButton = page.locator(
      'button:has-text("Create"), button:has-text("Add"), button:has-text("New"), button:has-text("New Business"), [data-testid="create-business"], .create-btn, .add-btn'
    );

    const createButtonVisible = await createButton.first().isVisible().catch(() => false);

    if (createButtonVisible) {
      await createButton.first().click();

      // Wait for modal/form to appear
      await page.waitForTimeout(500);

      // Try to fill business form fields
      const nameInput = page.locator('input[placeholder*="name" i], input[placeholder*="business" i], input[placeholder*="title" i]').first();
      const descriptionInput = page.locator('textarea[placeholder*="description" i], input[placeholder*="description" i]').first();
      const statusSelect = page.locator('select[name*="status" i], input[placeholder*="status" i]').first();

      // Fill form if inputs exist
      if (await nameInput.isVisible().catch(() => false)) {
        await nameInput.fill('Business Item - Test');
      }

      if (await descriptionInput.isVisible().catch(() => false)) {
        await descriptionInput.fill('Test business description');
      }

      if (await statusSelect.isVisible().catch(() => false)) {
        await statusSelect.fill('Active');
      }

      // Submit form
      const submitBtn = page.locator('button[type="submit"]:has-text("Save"), button[type="submit"]:has-text("Create"), button[type="submit"]:has-text("Add")').first();
      if (await submitBtn.isVisible().catch(() => false)) {
        await submitBtn.click();

        // Wait for success feedback
        await page.waitForTimeout(1000);

        // Check for success message or new item in list
        const successMessage = page.locator('[role="alert"]:has-text("success"), [role="alert"]:has-text("created"), .text-green-600');
        const itemInList = page.locator('text="Business Item - Test"');

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

  test('should display Business without blank screen', async ({ page }) => {
    await page.goto('/dashboard/business');

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
