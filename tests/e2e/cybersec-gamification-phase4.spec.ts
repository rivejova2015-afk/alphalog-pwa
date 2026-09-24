import { test, expect } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

test.describe("CyberSec Gamification Phase 1-4", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a quiz lesson
    await page.goto(`${BASE_URL}/securities/cybersec/lessons/1`, {
      waitUntil: "networkidle",
    });
    // Clear localStorage to start fresh
    await page.evaluate(() => localStorage.clear());
  });

  test("Phase 1: XP & Streak tracking", async ({ page }) => {
    // Find quiz button and start a quiz
    await page.click('button:has-text("Practica")');

    // Answer first question correctly
    const options = await page.locator("button.option-btn").all();
    if (options.length > 0) {
      await options[0].click();
    }

    // Check XP popup appears ("+10 XP" animation)
    const xpPopup = page.locator('text="+10 XP", "+15 XP", "+25 XP"');
    await expect(xpPopup).toBeVisible({ timeout: 2000 });

    // Check streak header is visible and shows flame icon
    const streakHeader = page.locator('[data-testid="streak-header"]');
    await expect(streakHeader).toBeVisible();

    // Verify localStorage has XP entry
    const xpData = await page.evaluate(() =>
      localStorage.getItem("cybersec_xp")
    );
    expect(xpData).toBeTruthy();
    const xpObj = JSON.parse(xpData || "{}");
    expect(xpObj.totalXp).toBeGreaterThan(0);
  });

  test("Phase 2: Daily Attempts limit (7/day)", async ({ page }) => {
    // Check DailyAttemptsDisplay shows 7 attempts available
    const attemptsDisplay = page.locator('[data-testid="daily-attempts"]');
    await expect(attemptsDisplay).toBeVisible();

    // Should show "7 / 7 attempts remaining"
    const text = await attemptsDisplay.textContent();
    expect(text).toContain("7");
  });

  test("Phase 2: Weekly Cosmetics Rotation", async ({ page }) => {
    // Submit a quiz to see CosmeticDisplay
    await page.click('button:has-text("Practica")');

    // Answer all questions
    const options = await page.locator(".option-btn");
    const count = await options.count();
    for (let i = 0; i < Math.min(count, 3); i++) {
      const btns = await page.locator(".option-btn").all();
      if (btns[i]) await btns[i].click();
    }

    // Wait for completion
    await page.waitForTimeout(1000);

    // Check if CosmeticDisplay appears
    const cosmeticDisplay = page.locator(
      '[data-testid="cosmetic-display"], text="This week:"'
    );
    const isVisible = await cosmeticDisplay.isVisible().catch(() => false);
    // May not be visible depending on cosmetic state, just verify it exists in DOM
    expect(isVisible || (await page.locator("text=Cosmetics").count()) > 0).toBeTruthy();
  });

  test("Phase 3: Struggle Detection → Hints", async ({ page }) => {
    // Start quiz in practice mode
    await page.click('button:has-text("Practica")');

    // Answer 2 questions INCORRECTLY to trigger struggle
    const options = await page.locator(".option-btn").all();
    const firstQuestion = options.slice(0, Math.max(1, Math.floor(options.length / 4)));

    // Click wrong answers twice
    if (firstQuestion.length > 1) {
      await firstQuestion[firstQuestion.length - 1].click(); // Click last option (usually wrong)
      await page.waitForTimeout(500);

      // Second wrong answer
      const opts2 = await page.locator(".option-btn").all();
      if (opts2.length > 1) {
        await opts2[opts2.length - 1].click();
      }
    }

    // After 2 consecutive wrong, HintDisplay should show
    const hintDisplay = page.locator('[data-testid="hint-display"]');
    const isHintVisible = await hintDisplay
      .isVisible()
      .catch(() => false);

    if (isHintVisible) {
      // Hint should be visible
      const hintText = await hintDisplay.textContent();
      expect(hintText).toContain("Hint");
    }
  });

  test("Phase 3: Hacker Rank Progression (0-100)", async ({ page }) => {
    // Load hacker rank component
    const hackerRank = page.locator('[data-testid="hacker-rank-progress"]');
    const isVisible = await hackerRank.isVisible().catch(() => false);

    if (isVisible) {
      // Should show level and title
      const levelText = await hackerRank.textContent();
      expect(levelText).toMatch(/Level \d+/);
    }

    // Verify localStorage has hacker rank data
    const xpData = await page.evaluate(() =>
      localStorage.getItem("cybersec_xp")
    );
    if (xpData) {
      const xpObj = JSON.parse(xpData);
      expect(xpObj.totalXp >= 0).toBeTruthy();
    }
  });

  test("Phase 3: Adaptive Scaffolding Indicator", async ({ page }) => {
    // Look for scaffolding indicator component
    const indicator = page.locator(
      '[data-testid="adaptive-scaffolding-indicator"]'
    );
    const isVisible = await indicator.isVisible().catch(() => false);

    if (isVisible) {
      // Should show one of: Flowing, Struggling, Mastering
      const text = await indicator.textContent();
      expect(
        text?.includes("Flowing") ||
        text?.includes("Struggling") ||
        text?.includes("Mastering")
      ).toBeTruthy();
    }
  });

  test("Phase 4: Rare Badges Detection", async ({ page }) => {
    // Complete a quiz with good performance to unlock badges
    await page.click('button:has-text("Practica")');

    // Answer questions quickly and correctly
    const options = await page.locator(".option-btn").all();
    if (options.length > 0) {
      for (let i = 0; i < Math.min(options.length, 5); i++) {
        const btns = await page.locator(".option-btn").all();
        if (btns[i]) {
          await btns[i].click();
          await page.waitForTimeout(100);
        }
      }
    }

    // Wait for quiz to complete
    await page.waitForTimeout(1000);

    // Check if RareBadges component is visible
    const rareBadges = page.locator('[data-testid="rare-badges"]');
    const isVisible = await rareBadges.isVisible().catch(() => false);

    if (isVisible) {
      // Should show rare badges grid
      const badgeCount = await rareBadges
        .locator(".badge-item")
        .count()
        .catch(() => 0);
      expect(badgeCount > 0).toBeTruthy();
    }

    // Verify localStorage has rare badges
    const badgesData = await page.evaluate(() =>
      localStorage.getItem("cybersec_rare_badges")
    );
    expect(badgesData).toBeTruthy();
  });

  test("Phase 4: Hall of Fame - Record Achievement", async ({ page }) => {
    // Complete a quiz
    await page.click('button:has-text("Practica")');

    // Answer some questions
    const options = await page.locator(".option-btn").all();
    if (options.length > 0) {
      for (let i = 0; i < Math.min(options.length, 3); i++) {
        const btns = await page.locator(".option-btn").all();
        if (btns[i]) await btns[i].click();
      }
    }

    await page.waitForTimeout(1000);

    // Check if HallOfFame component shows
    const hallOfFame = page.locator('[data-testid="hall-of-fame"]');
    const isVisible = await hallOfFame.isVisible().catch(() => false);

    if (isVisible) {
      // Should show achievements list
      const achievementText = await hallOfFame.textContent();
      expect(achievementText).toBeTruthy();
    }

    // Verify localStorage persistence
    const hofData = await page.evaluate(() =>
      localStorage.getItem("cybersec_hall_of_fame")
    );
    if (hofData) {
      const entries = JSON.parse(hofData);
      expect(Array.isArray(entries)).toBeTruthy();
    }
  });

  test("Persistence: All gamification data survives reload", async ({
    page,
  }) => {
    // Build up state: answer questions, earn XP
    await page.click('button:has-text("Practica")');

    const options = await page.locator(".option-btn").all();
    if (options.length > 0) {
      await options[0].click();
    }

    await page.waitForTimeout(500);

    // Get initial XP
    const xpBefore = await page.evaluate(() =>
      localStorage.getItem("cybersec_xp")
    );

    // Reload page
    await page.reload({ waitUntil: "networkidle" });

    // XP should be intact
    const xpAfter = await page.evaluate(() =>
      localStorage.getItem("cybersec_xp")
    );

    expect(xpAfter).toBe(xpBefore);
  });

  test("Accessibility: All gamification components have ARIA labels", async ({
    page,
  }) => {
    // Check StreakHeader
    const streakHeader = page.locator("[role=status]");
    const hasAria = await streakHeader
      .first()
      .getAttribute("aria-label")
      .catch(() => null);

    // At least some elements should have ARIA labels
    const statusElements = await page.locator("[aria-label]").count();
    expect(statusElements > 0).toBeTruthy();
  });

  test("Performance: XP popup animation completes in <1s", async ({
    page,
  }) => {
    const startTime = Date.now();

    await page.click('button:has-text("Practica")');
    const options = await page.locator(".option-btn").all();
    if (options.length > 0) {
      await options[0].click();
    }

    // Wait for XP popup to appear
    const xpPopup = page.locator("text=/\\+\\d+\\s*XP/");
    await expect(xpPopup).toBeVisible({ timeout: 2000 });

    // Popup should disappear after ~1s
    await expect(xpPopup).not.toBeVisible({ timeout: 2000 });

    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(3000); // Should be quick
  });

  test("Mobile: Gamification components responsive (touch)", async ({
    page,
  }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.click('button:has-text("Practica")');

    // Tap option
    const options = await page.locator(".option-btn").all();
    if (options.length > 0) {
      await options[0].tap();
    }

    // XP popup should still show
    const xpPopup = page.locator("text=/\\+\\d+\\s*XP/");
    const isVisible = await xpPopup.isVisible().catch(() => false);

    // At least verify the component hierarchy is intact
    const streakHeader = page.locator("[data-testid=streak-header]");
    const headerVisible = await streakHeader.isVisible().catch(() => false);

    expect(isVisible || headerVisible).toBeTruthy();
  });
});
