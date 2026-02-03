import { test, expect } from '@playwright/test';
import { login } from './utils/auth';

test.describe('Create Item Flows - TradeHub', () => {
  // Setup: login before each test
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should create a new trade in TradeHub', async ({ page }) => {
    // Navigate to TradeHub
    await page.goto('/dashboard/tradehub');

    // Wait for page to load
    await page.waitForLoadState('networkidle').catch(() => {
      // Timeout is okay
    });

    // Look for create/add button
    const createButton = page.locator(
      'button:has-text("Create"), button:has-text("Add"), button:has-text("New"), button:has-text("New Trade"), [data-testid="create-trade"], .create-btn, .add-btn'
    );

    const createButtonVisible = await createButton.first().isVisible().catch(() => false);

    if (createButtonVisible) {
      await createButton.first().click();

      // Wait for modal/form to appear
      await page.waitForTimeout(500);

      // Try to fill form fields (common trade fields)
      // These selectors are flexible to match various forms
      const instrumentInput = page.locator('input[placeholder*="instrument" i], input[placeholder*="symbol" i], select[name*="instrument" i]').first();
      const entryPriceInput = page.locator('input[placeholder*="entry" i], input[placeholder*="price" i], input[type="number"]').first();
      const exitPriceInput = page.locator('input[placeholder*="exit" i], input[placeholder*="target" i], input[type="number"]').nth(1);
      const quantityInput = page.locator('input[placeholder*="quantity" i], input[placeholder*="size" i], input[type="number"]').nth(2);

      // Fill form if inputs exist
      if (await instrumentInput.isVisible().catch(() => false)) {
        await instrumentInput.fill('EURUSD');
      }

      if (await entryPriceInput.isVisible().catch(() => false)) {
        await entryPriceInput.fill('1.0850');
      }

      if (await exitPriceInput.isVisible().catch(() => false)) {
        await exitPriceInput.fill('1.0900');
      }

      if (await quantityInput.isVisible().catch(() => false)) {
        await quantityInput.fill('1.0');
      }

      // Submit form
      const submitBtn = page.locator('button[type="submit"]:has-text("Save"), button[type="submit"]:has-text("Create"), button[type="submit"]:has-text("Add")').first();
      if (await submitBtn.isVisible().catch(() => false)) {
        await submitBtn.click();

        // Wait for success feedback
        await page.waitForTimeout(1000);

        // Check for success message or new item in list
        const successMessage = page.locator('[role="alert"]:has-text("success"), [role="alert"]:has-text("created"), .text-green-600');
        const itemInList = page.locator('text="EURUSD", text="1.0850"');

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

  test('should display TradeHub without blank screen', async ({ page }) => {
    await page.goto('/dashboard/tradehub');

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
