// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const { fromMock, fetchMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  fetchMock: vi.fn(),
}));

vi.mock("@/lib/supabase/browser", () => ({
  createClient: () => ({ from: fromMock }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { NewStrategyWizard } from "../NewStrategyWizard.client";

function chain(result: { data: unknown }) {
  const proxy: Record<string, unknown> = {};
  const methods = ["select", "eq", "is", "order"];
  for (const m of methods) proxy[m] = () => proxy;
  proxy.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return proxy;
}

describe("NewStrategyWizard — cuentas CME vía API (no Supabase directo)", () => {
  beforeEach(() => {
    fromMock.mockReset();
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;

    fromMock.mockImplementation((table: string) => {
      if (table === "bots") return chain({ data: [{ id: "bot-1", name: "Bot" }] });
      if (table === "bot_accounts") return chain({ data: [] });
      if (table === "algorithm_templates") return chain({ data: [] });
      throw new Error(`unexpected sb.from(${table}) — algo_cme_accounts must go through fetch()`);
    });

    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/intelligence/algorithms/cme-accounts" && !init) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) });
      }
      if (url === "/api/intelligence/algorithms/cme-accounts" && init?.method === "POST") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: { id: "new-cme-1", provider_name: "MyFundedFutures", account_number: "MFFU-123", account_type: "propfirm", is_paper: true },
          }),
        });
      }
      throw new Error(`unexpected fetch(${url})`);
    });
  });

  it("carga cuentas CME vía fetch, no sb.from('algo_cme_accounts')", async () => {
    render(<NewStrategyWizard onClose={() => {}} />);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/intelligence/algorithms/cme-accounts");
    });
  });

  it("crea una cuenta CME vía POST fetch, no sb.from(...).insert()", async () => {
    render(<NewStrategyWizard onClose={() => {}} />);

    fireEvent.click(await screen.findByText("Futures CME"));
    fireEvent.click(await screen.findByText("Agregar cuenta nueva"));

    const numberInput = await screen.findByPlaceholderText("Número de cuenta (ej. U1234567)");
    fireEvent.change(numberInput, { target: { value: "MFFU-123" } });

    fireEvent.click(screen.getByText("Guardar cuenta"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/intelligence/algorithms/cme-accounts",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });
});
