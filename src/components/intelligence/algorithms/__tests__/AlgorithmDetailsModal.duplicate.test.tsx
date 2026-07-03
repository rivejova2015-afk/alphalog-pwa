// @vitest-environment jsdom
//
// "Duplicar estrategia" button in the modal header. Validates:
//   - The button renders with the correct aria-label.
//   - Clicking it POSTs to /api/algorithms/[id]/duplicate.
//   - On success, the modal closes via onClose.
//
// We mock everything beyond the network fetch — the modal pulls heavy
// children (Coinarb section, dispatcher panel, etc.) we don't care about
// in this test, so they get replaced with cheap stubs.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AlgorithmDetailsModal from "../AlgorithmDetailsModal.client";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), message: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("../QualityGatesPanel.client", () => ({ default: () => null }));
vi.mock("../AuditTrailTimeline.client", () => ({ default: () => null }));
vi.mock("../AlgorithmShadowInbox", () => ({ AlgorithmShadowInbox: () => null }));
vi.mock("../TradovateConnectModal.client", () => ({ default: () => null }));
vi.mock("@/components/tradehub/PairingInstructionsModal.client", () => ({ default: () => null }));
// DeployToAccountSection lazy-imports the browser supabase client; without
// env vars the real one throws. Stub it to return an empty account list so
// the section renders the "No tenés cuentas" placeholder instead.
vi.mock("@/lib/supabase/browser", () => ({
  createClient: () => ({
    from: () => ({ select: async () => ({ data: [] }) }),
  }),
}));

function buildFetchMock(captures: { url: string; method: string }[]) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    captures.push({ url, method: init?.method ?? "GET" });
    if (url === "/api/algorithms/algo-1") {
      // Returns the algorithm row used by the modal body — forex algo, no
      // cuenta vinculada so the Deploy section renders too. We only care
      // about the duplicate button in this test though.
      return {
        ok:   true,
        json: async () => ({
          algorithm: {
            id:                    "algo-1",
            name:                  "Test algo",
            market_type:           "forex",
            platform:              "MT5",
            status:                "draft",
            parameters:            {},
            engine_config:         {},
            linked_bot_account_id: null,
          },
        }),
      } as Response;
    }
    if (url.endsWith("/duplicate")) {
      return {
        ok:   true,
        json: async () => ({ algorithm: { id: "new-algo", name: "Test algo (copia)", status: "draft" } }),
      } as Response;
    }
    if (url.includes("/connections")) {
      return {
        ok:   true,
        json: async () => ({
          algorithm: { id: "algo-1", name: "Test algo", market_type: "forex", instrument: "XAUUSD", platform: "MT5" },
          mt5:       null,
          cme:       null,
          options:   null,
        }),
      } as Response;
    }
    return { ok: true, json: async () => ({}) } as Response;
  });
}

describe("AlgorithmDetailsModal — duplicate button", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the Duplicate button in the header", async () => {
    globalThis.fetch = buildFetchMock([]) as unknown as typeof fetch;
    render(<AlgorithmDetailsModal algorithmId="algo-1" algorithmName="Test algo" onClose={vi.fn()} />);

    const button = await screen.findByLabelText(/Duplicar estrategia/i);
    expect(button).toBeDefined();
  });

  it("POSTs /api/algorithms/[id]/duplicate and closes on success", async () => {
    const captures: { url: string; method: string }[] = [];
    globalThis.fetch = buildFetchMock(captures) as unknown as typeof fetch;
    const onClose = vi.fn();
    render(<AlgorithmDetailsModal algorithmId="algo-1" algorithmName="Test algo" onClose={onClose} />);

    const button = await screen.findByLabelText(/Duplicar estrategia/i);
    fireEvent.click(button);

    await waitFor(() => {
      const dup = captures.find((c) => c.url.endsWith("/duplicate"));
      expect(dup).toBeDefined();
      expect(dup?.method).toBe("POST");
      expect(onClose).toHaveBeenCalled();
    });
  });
});
