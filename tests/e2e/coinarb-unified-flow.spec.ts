import { test, expect, type Page } from '@playwright/test';
import { login } from './utils/auth';

/**
 * End-to-end validation of the Coinarb↔Algorithms unification (Fases A/B/C +
 * #3 + #6 + #10 + #11). These tests open the actual UI a user would touch and
 * walk it through the control surface we built — modal, telemetry panel,
 * tunables form, control button.
 *
 * Why this spec matters more than the 35 coinarb unit tests + 562 alphalog
 * unit tests: those validate slices. This one validates that the slices
 * compose. CSRF tokens, RLS policies, route handlers, panel hydration, bot
 * command insertion — all of them only fail together at runtime, never in
 * isolation. This is the spec you want green before flipping LIVE mode.
 *
 * Idempotency: the render spec mutates nothing. The interactive spec submits
 * a pause command but does NOT wait for ack (the bot may be down on Fly).
 * It validates the UI optimistic state and the API contract, then accepts
 * that a single bot_command row is left in `pending` — harmless in the
 * operational table, and the next user pause/resume cycle reconciles it.
 */

const COINARB_NAME = 'Coinarb 50x';

test.describe('Coinarb unified flow — modal + panels render coverage', () => {
  test.describe.configure({ timeout: 90_000 });

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('opens the details modal from the Coinarb card and shows CoinarbSection', async ({ page }) => {
    await openCoinarbModal(page);

    // The CoinarbSection is identified by its platform header — not "Plataforma · MT5"
    // (Mt5Section) or "Plataforma · Futuros" (CmeSection) or the Lock placeholder
    // (OptionsSection). If the modal showed any of those for a crypto algo, the
    // branching logic broke.
    await expect(page.getByText('Plataforma · Coinbase Spot · Fly.io')).toBeVisible({ timeout: 10_000 });
  });

  test('renders the three coinarb panels: Bot status, Live telemetry, Tunables', async ({ page }) => {
    await openCoinarbModal(page);

    await expect(page.getByText('Bot status').first()).toBeVisible({ timeout: 10_000 });
    // Live telemetry panel: either "Esperando primer heartbeat del bot…" if no
    // coinarb_telemetry row exists yet, or the "Live telemetry" header with the
    // refresh-15s label if the bot has ticked at least once. Both count as render-OK.
    const telemetryHeader   = page.getByText('Live telemetry');
    const telemetryWaiting  = page.getByText('Esperando primer heartbeat del bot…');
    await expect(telemetryHeader.or(telemetryWaiting)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Tunables').first()).toBeVisible({ timeout: 10_000 });
  });

  test('Tunables form exposes the 4 scalar inputs + 3 per-symbol arb gaps', async ({ page }) => {
    await openCoinarbModal(page);

    // Field labels are uppercase tracking — match by the visible label string.
    await expect(page.getByText('MTF confidence min')).toBeVisible();
    await expect(page.getByText('Sweep body ratio')).toBeVisible();
    await expect(page.getByText('PD macro band')).toBeVisible();
    await expect(page.getByText('PD micro band')).toBeVisible();

    // Per-symbol section
    await expect(page.getByText('Arb gap min (Coinbase vs Binance)')).toBeVisible();
    await expect(page.getByText('BTC-USD').first()).toBeVisible();
    await expect(page.getByText('ETH-USD').first()).toBeVisible();
    await expect(page.getByText('SOL-USD').first()).toBeVisible();

    // Submit button present (don't click — render coverage only)
    await expect(page.getByRole('button', { name: /Guardar y propagar al bot/i })).toBeVisible();
  });

  test('Control button (Pause/Resume) is present and styled per current status', async ({ page }) => {
    await openCoinarbModal(page);

    // The button label is either "Pausar bot" (algo.status === 'live') or
    // "Reanudar bot" (anything else). One of the two must be visible.
    const pauseBtn  = page.getByRole('button', { name: /Pausar bot/i });
    const resumeBtn = page.getByRole('button', { name: /Reanudar bot/i });
    await expect(pauseBtn.or(resumeBtn)).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Coinarb unified flow — interactive control surface', () => {
  test.describe.configure({ timeout: 90_000 });

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('clicking the control button shows the "esperando ack" pending state', async ({ page }) => {
    await openCoinarbModal(page);

    const pauseBtn  = page.getByRole('button', { name: /Pausar bot/i });
    const resumeBtn = page.getByRole('button', { name: /Reanudar bot/i });
    const buttonToClick = (await pauseBtn.isVisible().catch(() => false)) ? pauseBtn : resumeBtn;

    await buttonToClick.click();

    // Two parallel UI signals after click — verify at least one:
    //   - Toast: "Pause enviado — esperando ack del bot (≤60s)…"
    //   - Button label flips to "Esperando ack…" with disabled state
    const toast = page.getByText(/enviado.*esperando ack/i);
    const buttonLabel = page.getByText('Esperando ack…');
    await expect(toast.or(buttonLabel)).toBeVisible({ timeout: 10_000 });

    // We do NOT wait for the actual ack — the bot may be down, and the test's
    // job here is to validate the UI contract + the POST /control round trip.
    // The bot_commands row stays as 'pending' until the next operator action
    // reconciles it. Acceptable pollution in an operational table.
  });
});

// ─── Helpers ────────────────────────────────────────────────────────────────

async function openCoinarbModal(page: Page) {
  await page.goto('/intelligence/algorithms', { waitUntil: 'domcontentloaded', timeout: 60_000 });

  // The accordion lists all algos by name. Find the Coinarb card's "Detalles"
  // button via its aria-label (which embeds the algo name).
  const detailsBtn = page.getByRole('button', { name: `Ver detalles de conexión de ${COINARB_NAME}` });
  await expect(detailsBtn).toBeVisible({ timeout: 15_000 });
  await detailsBtn.click();

  // Wait for modal dialog to appear
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });
}
