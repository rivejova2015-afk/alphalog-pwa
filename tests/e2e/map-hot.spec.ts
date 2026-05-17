import { test, expect } from "@playwright/test";

// Smoke tests for the Map Hot module. These verify the routes exist, the API
// guards work, and the pages don't crash on unauthenticated access (the
// expected behavior is a redirect to /auth and a 401 from the API).
//
// Full CRUD E2E for goals/milestones requires an authenticated session and
// belongs in a separate authenticated spec under tests/e2e/.auth/.

test.describe("Map Hot module smoke", () => {
  test("GET /api/map-hot/goals requires auth (401)", async ({ request }) => {
    const response = await request.get("/api/map-hot/goals");
    expect(response.status()).toBe(401);
  });

  test("GET /api/map-hot/milestones requires auth (401)", async ({ request }) => {
    const response = await request.get("/api/map-hot/milestones?year=2026");
    expect(response.status()).toBe(401);
  });

  test("GET /api/algorithms/lite requires auth (401)", async ({ request }) => {
    const response = await request.get("/api/algorithms/lite");
    expect(response.status()).toBe(401);
  });

  test("/map-hot redirects to /map-hot/goals", async ({ page }) => {
    const response = await page.goto("/map-hot", { waitUntil: "domcontentloaded" });
    // Either an auth redirect (no session) or the goals page (with session)
    expect([200, 307, 302]).toContain(response?.status() ?? 0);
    expect(page.url()).toMatch(/\/(auth|map-hot\/goals)/);
  });

  test("/map-hot/planning route is reachable", async ({ page }) => {
    const response = await page.goto("/map-hot/planning", { waitUntil: "domcontentloaded" });
    expect([200, 307, 302]).toContain(response?.status() ?? 0);
  });

  test("/map-hot/progress route is reachable", async ({ page }) => {
    const response = await page.goto("/map-hot/progress", { waitUntil: "domcontentloaded" });
    expect([200, 307, 302]).toContain(response?.status() ?? 0);
  });
});
