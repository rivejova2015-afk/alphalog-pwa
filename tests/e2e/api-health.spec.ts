import { test, expect } from "@playwright/test";

test.describe("API & PWA smoke", () => {
  test("health endpoint responds ok", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body).toMatchObject({ ok: true });
    expect(typeof body.ts).toBe("number");
  });

  test("manifest is served", async ({ request }) => {
    const response = await request.get("/manifest.webmanifest");
    expect(response.ok()).toBeTruthy();

    const manifest = await response.json();
    expect(manifest.name).toBe("AlphaLog");
    expect(Array.isArray(manifest.icons)).toBeTruthy();
  });

  test("service worker is served", async ({ request }) => {
    const response = await request.get("/sw.js");
    expect(response.ok()).toBeTruthy();

    const body = await response.text();
    expect(body.length).toBeGreaterThan(0);
  });
});
