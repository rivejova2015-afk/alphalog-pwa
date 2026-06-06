import { test, expect } from "@playwright/test";
import { login } from "./utils/auth";

// Map Hot E2E coverage.
//
// 1. Module smoke (unauthenticated): the routes resolve and the API guards
//    respond with 401/307 — no surprise 500s and no broken redirects.
// 2. Authenticated CRUD: a real Supabase session creates → edits → deletes
//    one goal and one milestone, exercising the same API paths the user hits
//    in production. Each test cleans up after itself by going through the
//    UI's own delete flow so we never leave junk rows in the test database.

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

test.describe("Map Hot — authenticated CRUD", () => {
  // Logged-in flows. login() reuses a cached Supabase session across tests in
  // the same worker so the auth round-trip only happens once.
  test.describe.configure({ timeout: 90_000 });

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("goals: create → edit → delete a goal end-to-end", async ({ page }) => {
    const stamp = Date.now().toString().slice(-8);
    const initialName = `E2E Goal ${stamp}`;
    const editedName = `${initialName} (edited)`;

    await page.goto("/map-hot/goals", { waitUntil: "domcontentloaded", timeout: 60_000 });

    // The empty state and the header both expose a "New Goal" button. Either one
    // opens the modal; the header version is always present once the page is
    // rendered, so we wait on that one specifically.
    await expect(
      page.getByRole("button", { name: "New Goal" }).first()
    ).toBeVisible({ timeout: 15_000 });

    // ── CREATE ──────────────────────────────────────────────────────────────
    await page.getByRole("button", { name: "New Goal" }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("New Goal", { exact: true })).toBeVisible();

    await page.getByPlaceholder("e.g. Annual Revenue Target").fill(initialName);
    await page.getByPlaceholder("120000").fill("10000");
    await page.getByPlaceholder("0").fill("2500");
    await page.getByRole("button", { name: "Save Goal" }).click();

    // The dialog dismisses itself on success and the goal appears in the grid.
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 10_000 });
    await expect(page.getByText(initialName, { exact: true })).toBeVisible({ timeout: 10_000 });

    // ── EDIT ────────────────────────────────────────────────────────────────
    // Open the edit modal via the per-card "Edit goal" aria-label button.
    const goalCard = page.locator(":text-is('" + initialName + "')").locator("..").locator("..");
    await goalCard.getByRole("button", { name: "Edit goal" }).click();
    await expect(page.getByText("Edit Goal", { exact: true })).toBeVisible({ timeout: 5_000 });

    const nameInput = page.getByPlaceholder("e.g. Annual Revenue Target");
    await nameInput.fill(editedName);
    await page.getByRole("button", { name: "Save Goal" }).click();

    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 10_000 });
    await expect(page.getByText(editedName, { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(initialName, { exact: true })).toHaveCount(0);

    // ── DELETE ──────────────────────────────────────────────────────────────
    const editedCard = page.locator(":text-is('" + editedName + "')").locator("..").locator("..");
    await editedCard.getByRole("button", { name: "Delete goal" }).click();

    // ConfirmDialog from @/components/ui exposes a "Delete" confirm button.
    await expect(page.getByText("Delete goal?", { exact: true })).toBeVisible({ timeout: 5_000 });
    await page.getByRole("button", { name: "Delete", exact: true }).click();

    await expect(page.getByText(editedName, { exact: true })).toHaveCount(0, { timeout: 10_000 });
  });

  test("milestones: create → delete a milestone in /planning", async ({ page }) => {
    const stamp = Date.now().toString().slice(-8);
    const label = `E2E Milestone ${stamp}`;

    await page.goto("/map-hot/planning", { waitUntil: "domcontentloaded", timeout: 60_000 });

    await expect(
      page.getByRole("button", { name: "New Milestone" }).first()
    ).toBeVisible({ timeout: 15_000 });

    // ── CREATE ──────────────────────────────────────────────────────────────
    await page.getByRole("button", { name: "New Milestone" }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("New Milestone", { exact: true })).toBeVisible();

    await page.getByPlaceholder("e.g. Q1 Foundation").fill(label);
    await page.getByPlaceholder("25000").fill("5000");

    // The form forces a year/quarter via segmented buttons; defaults (current
    // year + Q1) are fine for this test. Submit.
    await page.getByRole("button", { name: "Save Milestone" }).click();

    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 10_000 });
    await expect(page.getByText(label, { exact: true })).toBeVisible({ timeout: 10_000 });

    // ── DELETE ──────────────────────────────────────────────────────────────
    // The milestone row exposes a per-row "Delete milestone" button by aria.
    const milestoneCard = page.locator(":text-is('" + label + "')").locator("..").locator("..");
    await milestoneCard.getByRole("button", { name: "Delete milestone" }).click();

    await expect(page.getByText("Delete milestone?", { exact: true })).toBeVisible({ timeout: 5_000 });
    await page.getByRole("button", { name: "Delete", exact: true }).click();

    await expect(page.getByText(label, { exact: true })).toHaveCount(0, { timeout: 10_000 });
  });

  test("progress: page renders the three widgets when authenticated", async ({ page }) => {
    await page.goto("/map-hot/progress", { waitUntil: "domcontentloaded", timeout: 60_000 });

    // The page should resolve (not redirect to /auth) and render headings.
    expect(page.url()).toContain("/map-hot/progress");
    await expect(
      page.getByRole("heading", { name: "Progress Map" })
    ).toBeVisible({ timeout: 10_000 });

    // The three server-rendered widgets each contribute one of these section
    // titles. Empty state renders the donut placeholder text instead of the
    // table, so we accept either-or for that block.
    await expect(
      page.getByText("Distribution by status", { exact: true })
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText("Breakdown by timeframe", { exact: true })
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText("At-risk goals", { exact: true })
    ).toBeVisible({ timeout: 10_000 });
  });
});
