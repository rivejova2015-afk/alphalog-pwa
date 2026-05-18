// Smoke tests for the Sprint A-C dispatcher infrastructure:
//   - /api/cron/algorithms/tradovate-poll       (server-side dispatcher cron)
//   - /api/cron/bars/cme-settle-fetch           (CME settlement auto-fetch)
//   - /api/algorithms/[id]/engine-backtest/runs (bulk delete)
//
// These tests are intentionally minimal — they verify the routes exist,
// auth works, and the disabled/empty paths return the expected shape.
// Full end-to-end (creating an algo, polling, asserting orders) requires
// real Tradovate sandbox credentials and is out of scope for the smoke
// suite.
//
// Run with:
//   E2E_EMAIL=... E2E_PASSWORD=... CRON_SECRET=... PLAYWRIGHT_BASE_URL=... \
//   npx playwright test tests/e2e/dispatcher-smoke.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Dispatcher cron — auth + shape", () => {
  test("tradovate-poll rejects requests without CRON_SECRET", async ({ request }) => {
    const res = await request.get("/api/cron/algorithms/tradovate-poll");
    expect(res.status()).toBe(401);
    const body = await res.json().catch(() => ({}));
    expect(body).toMatchObject({ error: "Unauthorized" });
  });

  test("tradovate-poll with valid CRON_SECRET returns ok + counts", async ({ request }) => {
    const secret = process.env.CRON_SECRET;
    test.skip(!secret, "CRON_SECRET not set in env — cannot exercise auth path");

    const res = await request.get("/api/cron/algorithms/tradovate-poll", {
      headers: { "x-cron-secret": secret! },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toMatchObject({
      ok:           true,
      mode:         expect.stringMatching(/^(shadow|live)$/),
      duration_ms:  expect.any(Number),
      counts: {
        algosScanned: expect.any(Number),
        placed:       expect.any(Number),
        shadowLogged: expect.any(Number),
        skipped:      expect.any(Number),
        failed:       expect.any(Number),
      },
      per_algo: expect.any(Array),
    });
  });

  test("cme-settle-fetch rejects without CRON_SECRET", async ({ request }) => {
    const res = await request.get("/api/cron/bars/cme-settle-fetch");
    expect(res.status()).toBe(401);
  });

  test("cme-settle-fetch returns disabled when CME_AUTO_FETCH_ENABLED is unset", async ({ request }) => {
    const secret = process.env.CRON_SECRET;
    test.skip(!secret, "CRON_SECRET not set in env");

    const res = await request.get("/api/cron/bars/cme-settle-fetch", {
      headers: { "x-cron-secret": secret! },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    // Default is disabled; if the env happens to be true we still expect ok.
    expect(body).toMatchObject({ ok: true });
    if (body.enabled === false) {
      expect(body).toMatchObject({ enabled: false, reason: expect.stringContaining("CME_AUTO_FETCH_ENABLED") });
    } else {
      expect(body).toMatchObject({ enabled: true, tradeDate: expect.any(String), totals: expect.any(Object) });
    }
  });
});

test.describe("Bulk delete backtests — auth guard", () => {
  test("requires an authenticated session", async ({ request }) => {
    // Without a logged-in cookie, the route should 401. Using a bogus
    // algorithm id is fine — auth check fires before the algo lookup.
    const res = await request.delete("/api/algorithms/00000000-0000-0000-0000-000000000000/engine-backtest/runs");
    expect(res.status()).toBe(401);
  });
});
