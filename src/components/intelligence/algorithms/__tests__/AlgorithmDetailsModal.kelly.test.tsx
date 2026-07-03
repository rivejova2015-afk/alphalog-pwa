// @vitest-environment jsdom
//
// KellySection inside AlgorithmDetailsModal — validates that the Sprint O
// position-sizing panel:
//   1. Renders for futures algos.
//   2. Shows auto-populated stats when present in algorithm.parameters.
//   3. Shows the "Sin datos" hint when stats are absent.
//   4. PUTs the merged parameters when Save is clicked.
//   5. Refuses to enable Kelly when stats are missing.
//
// Heavy children (Coinarb, dispatcher panel, shadow inbox) are stubbed so the
// tree renders without unrelated network calls.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AlgorithmDetailsModal from "../AlgorithmDetailsModal.client";

const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError:   vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: toastError, success: toastSuccess, message: vi.fn(), info: vi.fn(), warning: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("../QualityGatesPanel.client", () => ({ default: () => null }));
vi.mock("../AuditTrailTimeline.client", () => ({ default: () => null }));
vi.mock("../AlgorithmShadowInbox", () => ({ AlgorithmShadowInbox: () => null }));
vi.mock("../TradovateConnectModal.client", () => ({ default: () => null }));
vi.mock("@/components/tradehub/PairingInstructionsModal.client", () => ({ default: () => null }));
vi.mock("@/lib/supabase/browser", () => ({
  createClient: () => ({
    from: () => {
      const chain: Record<string, unknown> = {};
      chain.is = () => chain;
      chain.eq = () => chain;
      chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: [] }).then(resolve);
      return { select: () => chain };
    },
  }),
}));

interface AlgoParams {
  kelly_win_rate?: number;
  kelly_avg_win_usd?: number;
  kelly_avg_loss_usd?: number;
  kelly_inputs_sample_size?: number;
  kelly_inputs_updated_at?: string;
  kelly_inputs_source?: string;
  kelly_enabled?: boolean;
  kelly_fraction?: number;
  kelly_min_contracts?: number;
  kelly_max_contracts?: number;
  contracts_per_trade?: number;
}

function buildFetchMock(
  params: AlgoParams,
  captures: Array<{ url: string; method: string; body?: unknown }>,
) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    captures.push({ url, method: init?.method ?? "GET", body });

    if (url === "/api/algorithms/algo-fut") {
      return {
        ok: true,
        json: async () => ({
          algorithm: {
            id:                    "algo-fut",
            name:                  "ES strategy",
            market_type:           "futures",
            platform:              "Tradovate",
            status:                "paper",
            parameters:            params,
            engine_config:         { market_type: "futures" },
            linked_bot_account_id: null,
          },
        }),
      } as Response;
    }
    if (url.includes("/connections")) {
      return {
        ok: true,
        json: async () => ({
          algorithm: { id: "algo-fut", name: "ES strategy", market_type: "futures", instrument: "ES", platform: "Tradovate" },
          mt5: null,
          cme: { cme_account_id: null, provider_name: null, account_number: null, is_paper: true },
          options: null,
        }),
      } as Response;
    }
    return { ok: true, json: async () => ({ ok: true }) } as Response;
  });
}

describe("AlgorithmDetailsModal — KellySection", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("renders the Kelly section for futures algos with auto-populated stats", async () => {
    const params: AlgoParams = {
      kelly_win_rate:           0.62,
      kelly_avg_win_usd:        125.5,
      kelly_avg_loss_usd:       80,
      kelly_inputs_sample_size: 48,
      kelly_inputs_updated_at:  "2026-06-01T10:00:00Z",
      kelly_inputs_source:      "engine_backtest:abc-123",
    };
    globalThis.fetch = buildFetchMock(params, []) as unknown as typeof fetch;
    render(<AlgorithmDetailsModal algorithmId="algo-fut" algorithmName="ES strategy" onClose={vi.fn()} />);

    expect(await screen.findByText(/Position Sizing — Kelly Criterion/i)).toBeDefined();
    // Stats badge says "Auto-poblado"
    expect(await screen.findByText(/Auto-poblado/i)).toBeDefined();
    // Win rate rendered as percent
    expect(await screen.findByText(/62\.0%/)).toBeDefined();
    // Avg win as dollars
    expect(await screen.findByText(/\$125\.50/)).toBeDefined();
    // Sample size
    expect(await screen.findByText(/48 trades/i)).toBeDefined();
  });

  it("shows the empty hint when stats are missing", async () => {
    globalThis.fetch = buildFetchMock({}, []) as unknown as typeof fetch;
    render(<AlgorithmDetailsModal algorithmId="algo-fut" algorithmName="ES strategy" onClose={vi.fn()} />);

    expect(await screen.findByText(/Sin datos/i)).toBeDefined();
    expect(await screen.findByText(/engine-backtest.*≥30 trades/i)).toBeDefined();
  });

  it("PUTs the merged parameters when Save is clicked", async () => {
    const params: AlgoParams = {
      kelly_win_rate:     0.55,
      kelly_avg_win_usd:  100,
      kelly_avg_loss_usd: 50,
      contracts_per_trade: 2,
    };
    const captures: Array<{ url: string; method: string; body?: unknown }> = [];
    globalThis.fetch = buildFetchMock(params, captures) as unknown as typeof fetch;
    render(<AlgorithmDetailsModal algorithmId="algo-fut" algorithmName="ES strategy" onClose={vi.fn()} />);

    const checkbox = await screen.findByLabelText(/Activar Kelly sizing/i);
    fireEvent.click(checkbox);

    const saveBtn = await screen.findByRole("button", { name: /Guardar Kelly config/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      const put = captures.find((c) => c.url === "/api/algorithms/algo-fut" && c.method === "PUT");
      expect(put).toBeDefined();
      const body = put!.body as { parameters: Record<string, unknown> };
      expect(body.parameters.kelly_enabled).toBe(true);
      expect(body.parameters.kelly_fraction).toBe(0.5);
      expect(body.parameters.kelly_min_contracts).toBe(1);
      expect(body.parameters.kelly_max_contracts).toBe(10);
      // Existing keys preserved
      expect(body.parameters.contracts_per_trade).toBe(2);
      expect(body.parameters.kelly_win_rate).toBe(0.55);
    });
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("refuses to enable Kelly when stats are missing", async () => {
    const captures: Array<{ url: string; method: string; body?: unknown }> = [];
    globalThis.fetch = buildFetchMock({}, captures) as unknown as typeof fetch;
    render(<AlgorithmDetailsModal algorithmId="algo-fut" algorithmName="ES strategy" onClose={vi.fn()} />);

    const checkbox = await screen.findByLabelText(/Activar Kelly sizing/i);
    fireEvent.click(checkbox);

    const saveBtn = await screen.findByRole("button", { name: /Guardar Kelly config/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/stats del backtest/i));
    });
    const put = captures.find((c) => c.method === "PUT");
    expect(put).toBeUndefined();
  });
});
