// @vitest-environment jsdom
//
// ExecutionAlgoSection dentro de AlgorithmDetailsModal — valida el panel de
// slicing TWAP/VWAP/IS:
//   1. Renderiza para algos futures con "Desactivado" por default.
//   2. Muestra los campos de duración/slice-count solo cuando hay algo elegido.
//   3. PUTs los parámetros mergeados al guardar (con algo seleccionado).
//   4. PUTs execution_algo:null al desactivar (volver a "").
//
// Heavy children stubbed igual que AlgorithmDetailsModal.kelly.test.tsx.

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
vi.mock("../AlgorithmShadowInbox", () => ({ AlgorithmShadowInbox: () => null }));
vi.mock("../TradovateConnectModal.client", () => ({ default: () => null }));
vi.mock("@/components/tradehub/PairingInstructionsModal.client", () => ({ default: () => null }));
vi.mock("@/lib/supabase/browser", () => ({
  createClient: () => ({ from: () => ({ select: async () => ({ data: [] }) }) }),
}));

interface AlgoParams {
  execution_algo?: string | null;
  execution_duration_minutes?: number;
  execution_slice_count?: number;
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

describe("AlgorithmDetailsModal — ExecutionAlgoSection", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("renderiza con 'Desactivado' por default y sin campos de slicing visibles", async () => {
    globalThis.fetch = buildFetchMock({}, []) as unknown as typeof fetch;
    render(<AlgorithmDetailsModal algorithmId="algo-fut" algorithmName="ES strategy" onClose={vi.fn()} />);

    expect(await screen.findByText(/TWAP \/ VWAP \/ Implementation Shortfall/i)).toBeDefined();
    const select = await screen.findByDisplayValue(/Desactivado/i);
    expect(select).toBeDefined();
    expect(screen.queryByText(/Duración \(min\)/i)).toBeNull();
  });

  it("muestra duración + slice count cuando ya hay un algo seleccionado", async () => {
    globalThis.fetch = buildFetchMock(
      { execution_algo: "twap", execution_duration_minutes: 30, execution_slice_count: 8 },
      [],
    ) as unknown as typeof fetch;
    render(<AlgorithmDetailsModal algorithmId="algo-fut" algorithmName="ES strategy" onClose={vi.fn()} />);

    expect(await screen.findByText(/Duración \(min\)/i)).toBeDefined();
    expect(await screen.findByText(/Cantidad de slices/i)).toBeDefined();
  });

  it("PUTs execution_algo + duration + slice count al elegir TWAP y guardar", async () => {
    const captures: Array<{ url: string; method: string; body?: unknown }> = [];
    globalThis.fetch = buildFetchMock({ contracts_per_trade: 2 }, captures) as unknown as typeof fetch;
    render(<AlgorithmDetailsModal algorithmId="algo-fut" algorithmName="ES strategy" onClose={vi.fn()} />);

    const select = await screen.findByDisplayValue(/Desactivado/i);
    fireEvent.change(select, { target: { value: "twap" } });

    const saveBtn = await screen.findByRole("button", { name: /Guardar ejecución/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      const put = captures.find((c) => c.url === "/api/algorithms/algo-fut" && c.method === "PUT");
      expect(put).toBeDefined();
      const body = put!.body as { parameters: Record<string, unknown> };
      expect(body.parameters.execution_algo).toBe("twap");
      expect(body.parameters.execution_duration_minutes).toBe(20);
      expect(body.parameters.execution_slice_count).toBe(5);
      // Existing keys preserved.
      expect(body.parameters.contracts_per_trade).toBe(2);
    });
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("PUTs execution_algo:null al volver a 'Desactivado'", async () => {
    const captures: Array<{ url: string; method: string; body?: unknown }> = [];
    globalThis.fetch = buildFetchMock(
      { execution_algo: "vwap", execution_duration_minutes: 15, execution_slice_count: 3 },
      captures,
    ) as unknown as typeof fetch;
    render(<AlgorithmDetailsModal algorithmId="algo-fut" algorithmName="ES strategy" onClose={vi.fn()} />);

    const select = await screen.findByDisplayValue(/VWAP/i);
    fireEvent.change(select, { target: { value: "" } });

    const saveBtn = await screen.findByRole("button", { name: /Guardar ejecución/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      const put = captures.find((c) => c.url === "/api/algorithms/algo-fut" && c.method === "PUT");
      expect(put).toBeDefined();
      const body = put!.body as { parameters: Record<string, unknown> };
      expect(body.parameters.execution_algo).toBeNull();
    });
    expect(toastSuccess).toHaveBeenCalled();
  });
});
