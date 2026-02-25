import { expect, test } from "@playwright/test";
import { login } from "./utils/auth";

test.describe("Bot Control Selector", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("dashboard selector routes forex and futuros", async ({ page }) => {
    await page.goto("/dashboard/bot-control", { waitUntil: "domcontentloaded", timeout: 60000 });

    await expect(page.getByRole("heading", { name: "Bot Forex" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Bot Futuros" })).toBeVisible();

    await page.getByRole("link", { name: /Bot Forex/i }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/bot-control\/forex$/);
    await expect(page.getByRole("link", { name: "Atrás al selector" })).toBeVisible();
    await expect(page.getByText("LotsFixed")).toBeVisible();

    await page.getByRole("link", { name: "Atrás al selector" }).click();
    await expect(page).toHaveURL(/\/dashboard\/bot-control$/);

    await page.getByRole("link", { name: /Bot Futuros/i }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/bot-control\/futuros$/);
    await expect(page.getByText("ContractsFixed")).toBeVisible();
  });

  test("trading tab selector routes forex and futuros", async ({ page }) => {
    await page.goto("/trading/tabs/bot-control", { waitUntil: "domcontentloaded", timeout: 60000 });

    await expect(page.getByRole("heading", { name: "Bot Forex" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Bot Futuros" })).toBeVisible();

    await page.getByRole("link", { name: /Bot Futuros/i }).first().click();
    await expect(page).toHaveURL(/\/trading\/tabs\/bot-control\/futuros$/);
    await expect(page.getByRole("link", { name: "Atrás al selector" })).toBeVisible();
  });
});
