// @vitest-environment jsdom
//
// Research-mode banner extension to futures in the algorithm details modal.
// Validates:
//   - Futures with no cuenta CME vinculada → research banner + the new
//     CmeDeployToAccountSection (Wave 4 item 15) both appear, and linking an
//     account PUTs parameters.cme_account_id + calls /approve.
//   - Futures WITH a cuenta CME vinculada  → neither appears.
//   - Options is hidden entirely (Wave 4 item 16 — no real IBKR backend,
//     owner decision 2026-07): no market-specific section renders for it.
//
// We mock everything beyond the network fetch — the modal pulls heavy children
// (Coinarb section, dispatcher panel, quality gates, etc.) we don't care about
// here, so they get replaced with cheap stubs.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import AlgorithmDetailsModal from "../AlgorithmDetailsModal.client";

const { cmeAccountsMock, toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
  cmeAccountsMock: vi.fn(() => Promise.resolve({ data: [] as unknown[] })),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { error: toastErrorMock, success: toastSuccessMock, message: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("../QualityGatesPanel.client", () => ({ default: () => null }));
vi.mock("../AuditTrailTimeline.client", () => ({ default: () => null }));
vi.mock("../AlgorithmShadowInbox.client", () => ({ AlgorithmShadowInbox: () => null }));
vi.mock("../TradovateConnectModal.client", () => ({ default: () => null }));
vi.mock("@/components/tradehub/PairingInstructionsModal.client", () => ({ default: () => null }));
vi.mock("@/lib/supabase/browser", () => ({
  createClient: () => ({
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      chain.is = () => chain;
      chain.eq = () => chain;
      chain.then = (resolve: (v: unknown) => unknown) =>
        (table === "algo_cme_accounts" ? cmeAccountsMock() : Promise.resolve({ data: [] })).then(resolve);
      return { select: () => chain };
    },
  }),
}));

type AlgoOverrides = Partial<{
  market_type: "forex" | "futures";
  status: string;
  linked_bot_account_id: string | null;
  parameters: Record<string, unknown>;
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
  marketType: "forex" | "futures";
  cme?: typeof cmeLinked | typeof cmeUnlinked | null;
  algoOverrides?: AlgoOverrides;
}) {
  const calls: { url: string; method: string; body?: unknown }[] = [];
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    let body: unknown;
    if (init?.body) { try { body = JSON.parse(init.body as string); } catch { /* ignore */ } }
    calls.push({ url, method, body });

    if (url.includes("/connections")) {
      return {
        ok: true,
        json: async () => ({
          algorithm: { id: "algo-1", name: "Test algo", market_type: opts.marketType, instrument: "X", platform: "MT5" },
          mt5: null,
          cme: opts.cme ?? null,
          options: null,
        }),
      } as Response;
    }
    if (url === "/api/algorithms/algo-1" && method === "GET") {
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
    if (url === "/api/algorithms/algo-1" && method === "PUT") {
      return { ok: true, json: async () => ({ algorithm: { id: "algo-1" } }) } as Response;
    }
    if (url === "/api/algorithms/algo-1/approve" && method === "POST") {
      return { ok: true, json: async () => ({ algorithm: { id: "algo-1", status: "approved" } }) } as Response;
    }
    return { ok: true, json: async () => ({}) } as Response;
  });
  return Object.assign(fn, { calls });
}

describe("AlgorithmDetailsModal — research-mode banner + CME deploy-to-account (futures)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    cmeAccountsMock.mockReset();
    cmeAccountsMock.mockResolvedValue({ data: [] });
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
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
    globalThis.fetch = buildFetchMock({
      marketType: "futures", cme: cmeLinked, algoOverrides: { parameters: { cme_account_id: "cme-acc-1" } },
    }) as unknown as typeof fetch;
    render(<AlgorithmDetailsModal algorithmId="algo-1" algorithmName="Test algo" onClose={vi.fn()} />);

    // Wait for the CME section to render (the linked account number is shown).
    await screen.findByText(/TV-12345/);
    expect(screen.queryByText(/Modo research — sin cuenta vinculada/i)).toBeNull();
    // The deploy-to-account section only renders when parameters.cme_account_id is absent.
    expect(screen.queryByText(/Vincular cuenta CME/i)).toBeNull();
  });

  it("Wave 4 item 16: no options-specific section renders (hidden, no backend)", async () => {
    globalThis.fetch = buildFetchMock({ marketType: "futures", cme: cmeUnlinked }) as unknown as typeof fetch;
    render(<AlgorithmDetailsModal algorithmId="algo-1" algorithmName="Test algo" onClose={vi.fn()} />);
    await screen.findByText(/Modo research — sin cuenta vinculada/i);
    expect(screen.queryByText(/ejecución vía IBKR/i)).toBeNull();
  });

  it("Wave 4 item 15: shows CmeDeployToAccountSection with existing accounts and links one on submit", async () => {
    cmeAccountsMock.mockResolvedValue({
      data: [{ id: "cme-acc-9", account_type: "propfirm", provider_name: "TopstepX", account_number: "TSX-777", label: "Topstep 50K" }],
    });
    const fetchMock = buildFetchMock({ marketType: "futures", cme: cmeUnlinked, algoOverrides: { status: "paper" } });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    render(<AlgorithmDetailsModal algorithmId="algo-1" algorithmName="Test algo" onClose={vi.fn()} />);

    await screen.findByText(/Vincular cuenta CME/i);
    const select = await screen.findByDisplayValue(/Elegí una cuenta/i);
    fireEvent.change(select, { target: { value: "cme-acc-9" } });

    const linkBtn = screen.getByRole("button", { name: /Vincular cuenta/i });
    fireEvent.click(linkBtn);

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Cuenta CME vinculada");
    });

    const putCall = fetchMock.calls.find((c) => c.url === "/api/algorithms/algo-1" && c.method === "PUT");
    expect(putCall?.body).toMatchObject({
      parameters: { cme_account_id: "cme-acc-9", cme_provider: "TopstepX", cme_account_num: "TSX-777", cme_type: "propfirm" },
    });
    // status was 'paper' → approve should have been called too.
    const approveCall = fetchMock.calls.find((c) => c.url === "/api/algorithms/algo-1/approve" && c.method === "POST");
    expect(approveCall).toBeDefined();
  });

  it("Wave 4 item 15: shows the empty-state message when the user has no CME accounts yet", async () => {
    cmeAccountsMock.mockResolvedValue({ data: [] });
    globalThis.fetch = buildFetchMock({ marketType: "futures", cme: cmeUnlinked }) as unknown as typeof fetch;
    render(<AlgorithmDetailsModal algorithmId="algo-1" algorithmName="Test algo" onClose={vi.fn()} />);

    await screen.findByText(/Vincular cuenta CME/i);
    expect(await screen.findByText(/No tenés cuentas CME cargadas todavía/i)).toBeDefined();
  });
});
