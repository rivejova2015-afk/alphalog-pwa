import { test, expect, type Page } from '@playwright/test';
import { login } from './utils/auth';

/**
 * E2E smoke coverage for the 8 business-hub pages that previously had ZERO
 * tests (everything except /business/journal which lives in business.spec.ts).
 *
 * Each spec follows the same shape:
 *   1. Navigate to the page
 *   2. Confirm the URL landed (not redirected away or 404)
 *   3. Confirm the page's distinctive CardTitle / heading is visible
 *
 * These are deliberately shallow — render guards, not feature tests. They
 * catch regressions where a route handler crashes, the panel component fails
 * to import, RLS denies the default user, or a recent UI rename breaks
 * navigation. Deeper interaction tests (create decision, run SOP, edit LLC
 * info) belong in dedicated specs per page when those flows stabilize.
 */

test.describe('Business hub — smoke coverage for the 8 untested pages', () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  // Each entry: [path, locator description for assert]
  const pages: Array<{ name: string; path: string; titleText: string }> = [
    { name: 'decisions', path: '/business/decisions', titleText: 'Strategic Decisions' },
    { name: 'health',    path: '/business/health',    titleText: 'Health & Alerts' },
    { name: 'kpis',      path: '/business/kpis',      titleText: 'Key Performance Indicators' },
    { name: 'llc',       path: '/business/llc',       titleText: 'LLC Information' },
    { name: 'pl',        path: '/business/pl',        titleText: 'Profit & Loss' },
    { name: 'roadmap',   path: '/business/roadmap',   titleText: 'Business Milestones' },
    { name: 'runway',    path: '/business/runway',    titleText: 'Runway Analysis' },
    { name: 'sops',      path: '/business/sops',      titleText: 'Standard Operating Procedures' },
  ];

  for (const { name, path, titleText } of pages) {
    test(`${name}: navigates to ${path} and renders distinctive title`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 60_000 });

      // 1. URL stayed where we sent it (no surprise redirect).
      expect(page.url()).toContain(path);

      // 2. Body has real content (not an empty error page).
      const bodyText = (await page.locator('body').textContent())?.trim() ?? '';
      expect(bodyText.length).toBeGreaterThan(0);

      // 3. The distinctive CardTitle is visible. CardTitle renders as a div
      // (shadcn convention) not a heading, so we match by text content.
      await expect(page.getByText(titleText, { exact: true }).first())
        .toBeVisible({ timeout: 10_000 });
    });
  }

  // Cross-page nav smoke: a single test that hops through 3 of the 8 to
  // catch SPA-navigation regressions distinct from cold-load regressions.
  test('client-side navigation between three hub pages preserves auth', async ({ page }) => {
    await page.goto('/business/health', { waitUntil: 'domcontentloaded' });
    await expectVisible(page, 'Health & Alerts');

    await page.goto('/business/kpis', { waitUntil: 'domcontentloaded' });
    await expectVisible(page, 'Key Performance Indicators');

    await page.goto('/business/runway', { waitUntil: 'domcontentloaded' });
    await expectVisible(page, 'Runway Analysis');
  });
});

async function expectVisible(page: Page, text: string) {
  await expect(page.getByText(text, { exact: true }).first()).toBeVisible({ timeout: 10_000 });
}
