// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const { fromMock, fetchMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  fetchMock: vi.fn(),
}));

vi.mock("@/lib/supabase/browser", () => ({
  createClient: () => ({ from: fromMock }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { CmeDeployToAccountSection } from "../AlgorithmDetailsModal.client";

describe("CmeDeployToAccountSection — cuentas CME vía API (no Supabase directo)", () => {
  beforeEach(() => {
    fromMock.mockReset();
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;

    fromMock.mockImplementation((table: string) => {
      throw new Error(`unexpected sb.from(${table}) — algo_cme_accounts must go through fetch()`);
    });

    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/intelligence/algorithms/cme-accounts") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: [
              {
                id: "cme-1",
                account_type: "propfirm",
                provider_name: "MyFundedFutures",
                account_number: "MFFU-123",
                label: "Cuenta principal",
                is_paper: true,
                funded_amount: "150000",
                max_daily_loss: "3000",
                max_trailing_dd: "6000",
              },
            ],
          }),
        });
      }
      throw new Error(`unexpected fetch(${url})`);
    });
  });

  it("carga cuentas CME vía fetch, no sb.from('algo_cme_accounts')", async () => {
    render(
      <CmeDeployToAccountSection
        algorithmId="algo-1"
        currentStatus="draft"
        onDeployed={() => {}}
      />,
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/intelligence/algorithms/cme-accounts");
    });

    expect(fromMock).not.toHaveBeenCalled();

    await screen.findByText(/Cuenta principal/);
  });
});
