import { test, expect } from "@playwright/test";

test.describe("API auth guards (unauthenticated)", () => {
  test("account categories require auth", async ({ request }) => {
    const response = await request.get("/api/account-categories");
    expect(response.status()).toBe(401);
  });

  test("tradehub setups require auth", async ({ request }) => {
    const response = await request.get("/api/tradehub/setups");
    expect(response.status()).toBe(401);
  });

  test("tradehub trades require auth", async ({ request }) => {
    const response = await request.get("/api/tradehub/trades");
    expect(response.status()).toBe(401);
  });

  test("tradermap level requires auth", async ({ request }) => {
    const response = await request.get("/api/tradermap/level");
    expect(response.status()).toBe(401);
  });

  test("treasury payout preview requires auth", async ({ request }) => {
    const response = await request.post("/api/treasury/payouts/preview", {
      data: {},
    });
    expect(response.status()).toBe(401);
  });

  test("alphashield audit requires auth", async ({ request }) => {
    const response = await request.post("/api/alphashield/audit", {
      data: {},
    });
    expect(response.status()).toBe(401);
  });

  test("pwa clear-force-refresh requires auth", async ({ request }) => {
    const response = await request.post("/api/pwa/clear-force-refresh", {
      data: {},
    });
    expect(response.status()).toBe(401);
  });
});
