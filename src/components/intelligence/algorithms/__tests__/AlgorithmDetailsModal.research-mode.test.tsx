// @vitest-environment jsdom
//
// Research-mode banner extension to futures + options in the algorithm
// details modal. Validates:
//   - Futures with no cuenta CME vinculada → banner appears with CTA to wizard.
//   - Futures WITH a cuenta CME vinculada  → banner does NOT appear.
//   - Options                              → banner always appears (informational).
//
// We mock everything beyond the network fetch — the modal pulls heavy children
// (Coinarb section, dispatcher panel, quality gates, etc.) we don't care about
// here, so they get replaced with cheap stubs.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import AlgorithmDetailsModal from "../AlgorithmDetailsModal.client";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), message: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("../QualityGatesPanel.client", () => ({ default: () => null }));
vi.mock("../AlgorithmShadowInbox.client", () => ({ AlgorithmShadowInbox: () => null }));
vi.mock("../TradovateConnectModal.client", () => ({ default: () => null }));
vi.mock("@/components/tradehub/PairingInstructionsModal.client", () => ({ default: () => null }));
vi.mock("@/lib/supabase/browser", () => ({
  createClient: () => ({ from: () => ({ select: async () => ({ data: [] }) }) }),
}));

type AlgoOverrides = Partial<{
  market_type: "forex" | "futures" | "options";
  status: string;
  linked_bot_account_id: string | null;
}>;

const cmeLinked = {
  cme_account_id: "cme-acc-1",
  provider_name: "Tradovate",
  account_number: "TV-12345",
  account_type: "broker" as const,
  broker_type: "tradovate",
  connection_status: "connected",
  token_expires_at: null,
  last_connected_at: null,
  funded_amount: 50000,
  max_daily_loss: 1000,
  max_trailing_dd: 2500,
  is_paper: false,
};

const cmeUnlinked = {
  cme_account_id: null,
  provider_name: null,
  account_number: null,
  account_type: null,
  broker_type: null,
  connection_status: null,
  token_expires_at: null,
  last_connected_at: null,
  funded_amount: null,
  max_daily_loss: null,
  max_trailing_dd: null,
  is_paper: null,
};

function buildFetchMock(opts: {
  marketType: "forex" | "futures" | "options";
  cme?: typeof cmeLinked | typeof cmeUnlinked | null;
  algoOverrides?: AlgoOverrides;
}) {
  return vi.fn(async (url: string) => {
    if (url.includes("/connections")) {
      return {
        ok: true,
        json: async () => ({
          algorithm: { id: "algo-1", name: "Test algo", market_type: opts.marketType, instrument: "X", platform: "MT5" },
          mt5: null,
          cme: opts.cme ?? null,
          options: opts.marketType === "options" ? { available: false } : null,
        }),
      } as Response;
    }
    if (url === "/api/algorithms/algo-1") {
      return {
        ok: true,
        json: async () => ({
          algorithm: {
            id: "algo-1",
            name: "Test algo",
            market_type: opts.marketType,
            platform: opts.marketType === "futures" ? "Tradovate" : "MT5",
            status: "paper",
            parameters: {},
            engine_config: {},
            linked_bot_account_id: null,
            ...opts.algoOverrides,
          },
        }),
      } as Response;
    }
    return { ok: true, json: async () => ({}) } as Response;
  });
}

describe("AlgorithmDetailsModal — research-mode banner (futures + options)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the research banner for a futures algo with NO cuenta CME vinculada", async () => {
    globalThis.fetch = buildFetchMock({ marketType: "futures", cme: cmeUnlinked }) as unknown as typeof fetch;
    render(<AlgorithmDetailsModal algorithmId="algo-1" algorithmName="Test algo" onClose={vi.fn()} />);

    const banner = await screen.findByText(/Modo research — sin cuenta vinculada/i);
    expect(banner).toBeDefined();
    // CTA reuses the existing CME wizard flow.
    const cta = screen.getByText(/Crear cuenta CME en el wizard/i);
    expect(cta).toBeDefined();
    expect(cta.closest("a")?.getAttribute("href")).toBe("/intelligence/algorithms");
  });

  it("does NOT show the research banner for a futures algo WITH a cuenta CME vinculada", async () => {
    globalThis.fetch = buildFetchMock({ marketType: "futures", cme: cmeLinked }) as unknown as typeof fetch;
    render(<AlgorithmDetailsModal algorithmId="algo-1" algorithmName="Test algo" onClose={vi.fn()} />);

    // Wait for the CME section to render (the linked account number is shown).
    await screen.findByText(/TV-12345/);
    expect(screen.queryByText(/Modo research — sin cuenta vinculada/i)).toBeNull();
  });

  it("shows the informational research banner for an options algo", async () => {
    globalThis.fetch = buildFetchMock({ marketType: "options" }) as unknown as typeof fetch;
    render(<AlgorithmDetailsModal algorithmId="algo-1" algorithmName="Test algo" onClose={vi.fn()} />);

    const banner = await screen.findByText(/Modo research — ejecución vía IBKR próximamente/i);
    expect(banner).toBeDefined();
    // Options banner is purely informational — no "wizard" CTA.
    await waitFor(() => {
      expect(screen.queryByText(/Crear cuenta CME en el wizard/i)).toBeNull();
    });
  });
});
