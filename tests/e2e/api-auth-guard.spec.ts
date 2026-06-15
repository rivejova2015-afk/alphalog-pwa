import { test, expect, type APIRequestContext, request as apiRequest } from "@playwright/test";

test.describe("API auth guards (unauthenticated)", () => {
  let unauthRequest: APIRequestContext;

  test.beforeAll(async ({ request }) => {
    void request;
    unauthRequest = await apiRequest.newContext({
      baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
      storageState: { cookies: [], origins: [] },
    });
  });

  test.afterAll(async () => {
    await unauthRequest.dispose();
  });

  test("account categories require auth", async () => {
    const response = await unauthRequest.get("/api/account-categories");
    expect(response.status()).toBe(401);
  });

  test("tradehub setups require auth", async () => {
    const response = await unauthRequest.get("/api/tradehub/setups");
    expect(response.status()).toBe(401);
  });

  test("tradehub trades require auth", async () => {
    const response = await unauthRequest.get("/api/tradehub/trades");
    expect(response.status()).toBe(401);
  });

  test("treasury payout preview requires auth", async () => {
    const response = await unauthRequest.post("/api/treasury/payouts/preview", {
      data: {},
    });
    expect(response.status()).toBe(401);
  });

  test("alphashield audit requires auth", async () => {
    const response = await unauthRequest.post("/api/alphashield/audit", {
      data: {},
    });
    expect(response.status()).toBe(401);
  });

  test("pwa clear-force-refresh requires auth", async () => {
    const response = await unauthRequest.post("/api/pwa/clear-force-refresh", {
      data: {},
    });
    expect(response.status()).toBe(401);
  });
});
