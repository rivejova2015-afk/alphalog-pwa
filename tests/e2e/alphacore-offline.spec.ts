import { test, expect, type APIRequestContext, type BrowserContext } from "@playwright/test";
import { login } from "./utils/auth";

// Cubre el ciclo offline-first de AlphaCore en dos capas:
//
// 1) Smoke UI — la página de journal sobrevive el toggle offline ↔ online
//    sin romper el render (regresiones del shell de la PWA).
//
// 2) Contrato server-side del outbox — los endpoints genéricos
//    `/api/alphacore/[table]/...` son el destino al que el OutboxManager
//    drena las mutations encoladas cuando vuelve la conexión. Si esos
//    endpoints rompen, todas las mutations offline se pierden en silencio
//    (entran a `conflict` tras agotar retries). Probarlos directamente vía
//    HTTP es lo más cercano que tenemos a un cycle completo sin reproducir
//    la inicialización del OutboxManager dentro del browser context.

const ALPHACORE_PATH = "/api/alphacore/journal_entries";
const JOURNAL_PATH = "/api/journal";

async function getCsrfToken(context: BrowserContext, baseURL: string): Promise<string> {
  const url = new URL(baseURL);
  const cookies = await context.cookies(url.origin);
  const csrf = cookies.find((c) => c.name === "al_csrf");
  return csrf?.value ?? "";
}

async function createEntryViaAlphacore(
  request: APIRequestContext,
  csrf: string,
  payload: Record<string, unknown>,
  outboxId?: string
) {
  return request.post(`${ALPHACORE_PATH}/create`, {
    headers: { "x-csrf-token": csrf, "Content-Type": "application/json" },
    data: { payload, ...(outboxId ? { outboxId } : {}) },
  });
}

async function findJournalEntry(
  request: APIRequestContext,
  matcher: (entry: { id: string; title?: string | null; content?: string | null }) => boolean
) {
  const res = await request.get(JOURNAL_PATH);
  if (!res.ok()) return null;
  const body = await res.json().catch(() => null);
  const list: Array<{ id: string; title?: string | null; content?: string | null }> =
    Array.isArray(body)
      ? body
      : Array.isArray(body?.entries)
        ? body.entries
        : Array.isArray(body?.data)
          ? body.data
          : [];
  return list.find(matcher) ?? null;
}

async function softDeleteViaJournalApi(
  request: APIRequestContext,
  csrf: string,
  id: string
) {
  await request
    .delete(JOURNAL_PATH, {
      headers: { "x-csrf-token": csrf, "Content-Type": "application/json" },
      data: { id },
    })
    .catch(() => undefined);
}

test.describe("AlphaCore offline outbox", () => {
  test.describe.configure({ timeout: 90000 });

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("journal page survives offline → online toggle without crashing", async ({ page, context }) => {
    await page.goto("/business/journal", { waitUntil: "domcontentloaded", timeout: 60000 });

    await page.waitForTimeout(1500);
    const initialContent = await page.locator("body").textContent();
    expect((initialContent?.trim().length ?? 0)).toBeGreaterThan(0);

    await context.setOffline(true);
    await page.waitForTimeout(800);

    const offlineContent = await page.locator("body").textContent();
    expect((offlineContent?.trim().length ?? 0)).toBeGreaterThan(0);

    const errorHeading = page.getByRole("heading", { name: /^error$/i });
    await expect(errorHeading).toHaveCount(0);

    await context.setOffline(false);
    await page.waitForTimeout(2000);

    const onlineContent = await page.locator("body").textContent();
    expect((onlineContent?.trim().length ?? 0)).toBeGreaterThan(0);
  });

  test("offline page is reachable when service worker is registered", async ({ page }) => {
    const response = await page.goto("/offline", { waitUntil: "domcontentloaded", timeout: 60000 });
    const status = response?.status() ?? 0;
    expect(status).not.toBe(500);
    expect(status).not.toBe(503);

    const content = await page.locator("body").textContent();
    expect((content?.trim().length ?? 0)).toBeGreaterThan(0);
  });

  test("outbox create endpoint persists a journal entry and it appears in GET /api/journal", async ({ page, context, baseURL }) => {
    const request = context.request;
    const csrf = await getCsrfToken(context, baseURL ?? page.url());

    const marker = `e2e-outbox-create-${Date.now()}`;
    const titlePayload = `T-${marker}`;
    const contentPayload = JSON.stringify({ text: `Body-${marker}`, mood_score: 7 });

    const createRes = await createEntryViaAlphacore(
      request,
      csrf,
      {
        title: titlePayload,
        content: contentPayload,
        mood: "good",
        date: new Date().toISOString().slice(0, 10),
      },
      `e2e-${marker}`
    );

    expect(createRes.status(), `expected 2xx from outbox create, got ${createRes.status()}`).toBeLessThan(300);
    const createBody = await createRes.json();
    expect(createBody?.success).toBe(true);
    expect(createBody?.data?.id).toBeTruthy();
    const createdId = createBody.data.id as string;

    // The entry should be visible via the regular GET /api/journal route.
    // Title is AES-encrypted in DB but decrypted on the way out, so we can
    // match against the plaintext marker.
    const found = await findJournalEntry(request, (entry) =>
      typeof entry.title === "string" && entry.title.includes(marker)
    );
    expect(found, `entry with marker "${marker}" should be returned by /api/journal`).toBeTruthy();
    expect(found?.id).toBe(createdId);

    await softDeleteViaJournalApi(request, csrf, createdId);
  });

  test("outbox create endpoint is idempotent when retried with the same outboxId", async ({ page, context, baseURL }) => {
    const request = context.request;
    const csrf = await getCsrfToken(context, baseURL ?? page.url());

    const marker = `e2e-outbox-idem-${Date.now()}`;
    const payload = {
      title: `T-${marker}`,
      content: JSON.stringify({ text: `Body-${marker}` }),
      mood: "neutral",
      date: new Date().toISOString().slice(0, 10),
    };
    const outboxId = `e2e-idem-${marker}`;

    const first = await createEntryViaAlphacore(request, csrf, payload, outboxId);
    expect(first.status()).toBeLessThan(300);
    const firstBody = await first.json();
    const firstId = firstBody?.data?.id as string;
    expect(firstId).toBeTruthy();

    // The OutboxManager retries on transient failures. If the first POST
    // actually succeeded on the server but the response never reached the
    // client (network blip), the retry must NOT create a duplicate row.
    // The endpoint short-circuits when `outboxId` is provided AND the
    // payload's `id` matches an existing row, so we send the server-issued
    // id on the retry to simulate a real retry-after-success scenario.
    const second = await createEntryViaAlphacore(
      request,
      csrf,
      { ...payload, id: firstId },
      outboxId
    );
    expect(second.status()).toBeLessThan(300);
    const secondBody = await second.json();
    expect(secondBody?.idempotent).toBe(true);
    expect(secondBody?.data?.id).toBe(firstId);

    // Only one row should exist for this marker.
    const matches: Array<{ id: string }> = [];
    const list = await request.get(JOURNAL_PATH);
    const listJson = await list.json().catch(() => null);
    const entries: Array<{ id: string; title?: string | null }> = Array.isArray(listJson)
      ? listJson
      : Array.isArray(listJson?.entries)
        ? listJson.entries
        : Array.isArray(listJson?.data)
          ? listJson.data
          : [];
    for (const e of entries) {
      if (typeof e.title === "string" && e.title.includes(marker)) matches.push({ id: e.id });
    }
    expect(matches.length, `expected exactly 1 entry for marker "${marker}", got ${matches.length}`).toBe(1);

    await softDeleteViaJournalApi(request, csrf, firstId);
  });

  test("journal form falls back to outbox when offline and drains on reconnect (full cycle)", async ({ page, context, baseURL }) => {
    // Go online to /business/journal so the CsrfBridge bootstrap runs and
    // the OutboxManager singleton is alive with its `online` listener.
    await page.goto("/business/journal", { waitUntil: "domcontentloaded", timeout: 60000 });
    // Allow the React effect that calls bootstrapOutbox() to run.
    await page.waitForTimeout(1200);

    const marker = `e2e-cycle-${Date.now()}`;
    const text = `Reflexión offline ${marker} con detalle suficiente para validar`;

    // Snapshot existing entry ids so we can assert the new one is brand new.
    const requestCtx = context.request;
    const csrf = await getCsrfToken(context, baseURL ?? page.url());

    // Go offline — POST /api/journal will throw TypeError "Failed to fetch".
    await context.setOffline(true);
    await page.waitForTimeout(400);

    // Open the form and submit. The panel should catch the network error,
    // enqueue to the outbox, close the form and render the entry as pending.
    await page.getByRole("button", { name: /nueva entrada/i }).click();
    await page.locator("textarea").first().fill(text);
    await page.getByRole("button", { name: /guardar entrada/i }).click();

    // The "Sincronizando" pill should appear on the new row.
    await expect(page.getByText(/sincronizando/i).first()).toBeVisible({ timeout: 8000 });
    // And the entry text should be present (optimistic render).
    await expect(page.getByText(marker).first()).toBeVisible({ timeout: 4000 });

    // Reconnect — the OutboxManager's `online` listener fires syncAll().
    await context.setOffline(false);

    // Wait for the panel's post-reconnect refresh (3.5s) + a margin for the
    // POST round-trip + the outbox-pending poll (every 7s).
    await page.waitForTimeout(12000);

    // The "Sincronizando" pill should be gone after the entry persists.
    // (We don't assert .toHaveCount(0) because other tests running in
    // parallel could leave unrelated pending rows; instead we re-query
    // the server and assert the entry exists with a real id.)
    const list = await requestCtx.get(JOURNAL_PATH);
    expect(list.ok()).toBe(true);
    const body = await list.json().catch(() => null);
    const entries: Array<{ id: string; text?: string | null }> = Array.isArray(body)
      ? body
      : Array.isArray(body?.entries)
        ? body.entries
        : Array.isArray(body?.data)
          ? body.data
          : [];

    const found = entries.find((e) => typeof e.text === "string" && e.text.includes(marker));
    expect(found, `entry with marker "${marker}" should have synced to the server`).toBeTruthy();

    if (found?.id) {
      await softDeleteViaJournalApi(requestCtx, csrf, found.id);
    }
  });

  test("outbox update + delete endpoints round-trip a journal entry", async ({ page, context, baseURL }) => {
    const request = context.request;
    const csrf = await getCsrfToken(context, baseURL ?? page.url());

    const marker = `e2e-outbox-cycle-${Date.now()}`;
    const createRes = await createEntryViaAlphacore(request, csrf, {
      title: `T-${marker}`,
      content: JSON.stringify({ text: `Body-${marker}` }),
      mood: "good",
      date: new Date().toISOString().slice(0, 10),
    });
    expect(createRes.status()).toBeLessThan(300);
    const createBody = await createRes.json();
    const id = createBody?.data?.id as string;
    expect(id).toBeTruthy();

    // Update via alphacore PATCH
    const updatedTitle = `T-${marker}-updated`;
    const updateRes = await request.patch(`${ALPHACORE_PATH}/${id}/update`, {
      headers: { "x-csrf-token": csrf, "Content-Type": "application/json" },
      data: {
        payload: { title: updatedTitle, mood: "excellent" },
        outboxId: `e2e-cycle-update-${marker}`,
      },
    });
    expect(updateRes.status(), `expected 2xx from outbox update, got ${updateRes.status()}`).toBeLessThan(300);

    // Verify update is reflected via the regular GET route
    const afterUpdate = await findJournalEntry(request, (entry) => entry.id === id);
    expect(afterUpdate, "entry should still exist after update").toBeTruthy();
    expect(
      typeof afterUpdate?.title === "string" && afterUpdate.title.includes(`${marker}-updated`),
      "updated title should be visible after PATCH"
    ).toBe(true);

    // Delete via alphacore DELETE
    const deleteRes = await request.delete(`${ALPHACORE_PATH}/${id}/delete`, {
      headers: { "x-csrf-token": csrf },
    });
    expect(deleteRes.status(), `expected 2xx from outbox delete, got ${deleteRes.status()}`).toBeLessThan(300);

    // Entry should no longer be returned by /api/journal (soft-deleted)
    const afterDelete = await findJournalEntry(request, (entry) => entry.id === id);
    expect(afterDelete, "soft-deleted entry should be hidden from GET /api/journal").toBeFalsy();
  });
});
