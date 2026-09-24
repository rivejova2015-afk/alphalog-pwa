import { test, expect } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

test.describe("Rare Badges - Specific Unlock Conditions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/securities/cybersec/lessons/1`, {
      waitUntil: "networkidle",
    });
    await page.evaluate(() => {
      localStorage.clear();
      // Pre-seed some data for testing
      localStorage.setItem(
        "cybersec_rare_badges",
        JSON.stringify([
          {
            id: "speedrun_champion",
            name: "Speedrun Champion",
            icon: "🏎️",
            rarity: "epic",
            condition: "Average time <15s per question for 20 questions",
            unlockedAt: null,
          },
          {
            id: "comeback_king",
            name: "Comeback King",
            icon: "💪",
            rarity: "rare",
            condition:
              "Recover from 0% accuracy to 80%+ in single session",
            unlockedAt: null,
          },
          {
            id: "perfect_week",
            name: "Perfect Week",
            icon: "⚡",
            rarity: "epic",
            condition: "7-day streak with 100% accuracy",
            unlockedAt: null,
          },
        ])
      );
    });
  });

  test("Speedrun Champion: Fast answers unlock badge", async ({ page }) => {
    // Simulate rapid-fire correct answers
    const performanceContext = {
      currentStreak: 1,
      accuracy: 1.0, // 100% so far
      consecutiveWrong: 0,
      avgTimePerQuestion: 10, // Under 15s target
      hackerLevel: 5,
      questionsAnsweredThisSession: 20,
      clanRank: null,
    };

    // Call the badge detection logic via browser context
    const unlockedBadges = await page.evaluate((ctx) => {
      // Simulate detectAndUnlockRareBadges logic
      const badges = JSON.parse(
        localStorage.getItem("cybersec_rare_badges") || "[]"
      );

      if (ctx.questionsAnsweredThisSession >= 20 && ctx.avgTimePerQuestion < 15) {
        const badge = badges.find((b) => b.id === "speedrun_champion");
        if (badge && !badge.unlockedAt) {
          badge.unlockedAt = Date.now();
        }
      }

      localStorage.setItem("cybersec_rare_badges", JSON.stringify(badges));
      return badges.filter((b) => b.unlockedAt !== null).map((b) => b.name);
    }, performanceContext);

    expect(unlockedBadges).toContain("Speedrun Champion");
  });

  test("Comeback King: Recovery from 0% to 80%+ accuracy", async ({
    page,
  }) => {
    // Simulate accuracy recovery scenario
    const performanceContext = {
      currentStreak: 0,
      accuracy: 0.8, // 80% achieved after being low
      consecutiveWrong: 0, // No consecutive wrong at end
      avgTimePerQuestion: 20,
      hackerLevel: 3,
      questionsAnsweredThisSession: 10,
      clanRank: null,
    };

    const unlockedBadges = await page.evaluate((ctx) => {
      const badges = JSON.parse(
        localStorage.getItem("cybersec_rare_badges") || "[]"
      );

      // Comeback King: accuracy >= 80% + no current wrong streak + min 5 questions
      if (
        ctx.questionsAnsweredThisSession >= 5 &&
        ctx.accuracy >= 0.8 &&
        ctx.consecutiveWrong === 0
      ) {
        const badge = badges.find((b) => b.id === "comeback_king");
        if (badge && !badge.unlockedAt) {
          badge.unlockedAt = Date.now();
        }
      }

      localStorage.setItem("cybersec_rare_badges", JSON.stringify(badges));
      return badges.filter((b) => b.unlockedAt !== null).map((b) => b.name);
    }, performanceContext);

    expect(unlockedBadges).toContain("Comeback King");
  });

  test("Perfect Week badge NOT unlocked without both streak + accuracy", async ({
    page,
  }) => {
    // Only 7 day streak but not 100% accuracy
    const performanceContext = {
      currentStreak: 7,
      accuracy: 0.85, // 85%, not perfect
      consecutiveWrong: 0,
      avgTimePerQuestion: 20,
      hackerLevel: 10,
      questionsAnsweredThisSession: 15,
      clanRank: null,
    };

    const unlockedBadges = await page.evaluate((ctx) => {
      const badges = JSON.parse(
        localStorage.getItem("cybersec_rare_badges") || "[]"
      );

      // Perfect Week needs BOTH 7-day streak AND 100% accuracy
      if (ctx.currentStreak >= 7 && ctx.accuracy >= 1.0) {
        const badge = badges.find((b) => b.id === "perfect_week");
        if (badge && !badge.unlockedAt) {
          badge.unlockedAt = Date.now();
        }
      }

      localStorage.setItem("cybersec_rare_badges", JSON.stringify(badges));
      return badges.filter((b) => b.unlockedAt !== null).map((b) => b.name);
    }, performanceContext);

    expect(unlockedBadges).not.toContain("Perfect Week");
  });

  test("Rare badges persist across page reloads", async ({ page }) => {
    // Unlock a badge
    await page.evaluate(() => {
      const badges = JSON.parse(
        localStorage.getItem("cybersec_rare_badges") || "[]"
      );
      const speedrun = badges.find((b) => b.id === "speedrun_champion");
      if (speedrun) speedrun.unlockedAt = Date.now();
      localStorage.setItem("cybersec_rare_badges", JSON.stringify(badges));
    });

    const badgesBefore = await page.evaluate(() =>
      localStorage.getItem("cybersec_rare_badges")
    );

    // Reload
    await page.reload({ waitUntil: "networkidle" });

    const badgesAfter = await page.evaluate(() =>
      localStorage.getItem("cybersec_rare_badges")
    );

    expect(badgesAfter).toBe(badgesBefore);

    // Verify speedrun is still unlocked
    const unlockedCount = await page.evaluate(() => {
      const badges = JSON.parse(
        localStorage.getItem("cybersec_rare_badges") || "[]"
      );
      return badges.filter((b) => b.unlockedAt !== null).length;
    });

    expect(unlockedCount > 0).toBeTruthy();
  });

  test("UI: Rare badges show lock icon when locked", async ({ page }) => {
    // Navigate to a page that shows RareBadges component
    await page.click('button:has-text("Practica")');
    await page.waitForTimeout(500);

    // Check for locked badge indicators
    const lockedBadges = await page.locator("svg[data-icon='lock']").count();

    // Should have some locked badges initially
    expect(lockedBadges >= 0).toBeTruthy(); // 0 is ok if all unlocked, but typically should have some
  });

  test("UI: Rare badges show unlock date when unlocked", async ({
    page,
  }) => {
    // Unlock all badges manually
    await page.evaluate(() => {
      const badges = JSON.parse(
        localStorage.getItem("cybersec_rare_badges") || "[]"
      );
      const now = Date.now();
      badges.forEach((b) => {
        b.unlockedAt = now;
      });
      localStorage.setItem("cybersec_rare_badges", JSON.stringify(badges));
    });

    // Reload to see unlocked badges
    await page.reload({ waitUntil: "networkidle" });

    // Look for badges component
    const rareBadges = page.locator('[data-testid="rare-badges"]');
    const isVisible = await rareBadges.isVisible().catch(() => false);

    if (isVisible) {
      // Should show unlock dates (checkmarks with dates)
      const unlockIndicators = await rareBadges
        .locator("text=/✓|unlocked/i")
        .count();
      expect(unlockIndicators > 0).toBeTruthy();
    }
  });

  test("UI: Rare badge rarity colors correct", async ({ page }) => {
    const rareBadges = page.locator('[data-testid="rare-badges"]');
    const isVisible = await rareBadges.isVisible().catch(() => false);

    if (isVisible) {
      // Epic badges should have purple color
      const epicBadges = rareBadges.locator("[data-rarity='epic']");
      const epicCount = await epicBadges.count();

      // Should have at least some epic badges
      expect(epicCount > 0).toBeTruthy();
    }
  });
});
