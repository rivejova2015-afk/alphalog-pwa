// @vitest-environment jsdom
//
// "Activar" button in the modal header (Sprint R). Validates:
//   1. Renders only when algorithm.status === 'paused'.
//   2. Hidden for other statuses (draft, paper, live).
//   3. Clicking it PUTs { status: 'draft' } to /api/algorithms/[id].
//   4. Calls fetchAll() (which re-fetches both the algo + connections) on
//      success so the button disappears after the flip.
//
// Heavy children stubbed the same way as the other modal tests in this dir.

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

type StatusFixture = "paused" | "draft" | "paper" | "live";

function buildFetchMock(
  status: StatusFixture,
  captures: Array<{ url: string; method: string; body?: unknown }>,
  algoFetchCount: { value: number },
) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    captures.push({ url, method: init?.method ?? "GET", body });

    if (url === "/api/algorithms/algo-1" && (init?.method ?? "GET") === "GET") {
      algoFetchCount.value += 1;
      // After the first fetch, return whatever the test originally set.
      // After a successful PUT, the modal calls fetchAll() which re-issues
      // this GET — we serve "draft" then so the test can assert the button
      // disappears post-flip.
      const effective = algoFetchCount.value === 1 ? status : "draft";
      return {
        ok: true,
        json: async () => ({
          algorithm: {
            id:                    "algo-1",
            name:                  "Test algo",
            market_type:           "futures",
            platform:              "Tradovate",
            status:                effective,
            parameters:            { contract: "ESM5" },
            engine_config:         { market_type: "futures" },
            linked_bot_account_id: null,
          },
        }),
      } as Response;
    }
    if (url === "/api/algorithms/algo-1" && init?.method === "PUT") {
      return { ok: true, json: async () => ({ algorithm: { id: "algo-1", status: "draft" } }) } as Response;
    }
    if (url.includes("/connections")) {
      return {
        ok: true,
        json: async () => ({
          algorithm: { id: "algo-1", name: "Test algo", market_type: "futures", instrument: "ES", platform: "Tradovate" },
          mt5:       null,
          cme:       { cme_account_id: null, provider_name: null, account_number: null, is_paper: true },
          options:   null,
        }),
      } as Response;
    }
    return { ok: true, json: async () => ({}) } as Response;
  });
}

describe("AlgorithmDetailsModal — Activar button (paused → draft)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("renders the Activar button when status='paused'", async () => {
    const counter = { value: 0 };
    globalThis.fetch = buildFetchMock("paused", [], counter) as unknown as typeof fetch;
    render(<AlgorithmDetailsModal algorithmId="algo-1" algorithmName="Test algo" onClose={vi.fn()} />);

    expect(await screen.findByLabelText(/Activar estrategia/i)).toBeDefined();
  });

  it("hides the Activar button for non-paused statuses", async () => {
    for (const status of ["draft", "paper", "live"] as StatusFixture[]) {
      const counter = { value: 0 };
      globalThis.fetch = buildFetchMock(status, [], counter) as unknown as typeof fetch;
      const { unmount } = render(
        <AlgorithmDetailsModal algorithmId="algo-1" algorithmName="Test algo" onClose={vi.fn()} />,
      );
      // Wait for the modal to settle.
      await screen.findByText(/Detalles de conexión/i);
      expect(screen.queryByLabelText(/Activar estrategia/i)).toBeNull();
      unmount();
    }
  });

  it("PUTs { status: 'draft' } when clicked and re-fetches the algo row", async () => {
    const captures: Array<{ url: string; method: string; body?: unknown }> = [];
    const counter = { value: 0 };
    globalThis.fetch = buildFetchMock("paused", captures, counter) as unknown as typeof fetch;
    render(<AlgorithmDetailsModal algorithmId="algo-1" algorithmName="Test algo" onClose={vi.fn()} />);

    const button = await screen.findByLabelText(/Activar estrategia/i);
    fireEvent.click(button);

    await waitFor(() => {
      const put = captures.find((c) => c.url === "/api/algorithms/algo-1" && c.method === "PUT");
      expect(put).toBeDefined();
      expect((put!.body as { status: string }).status).toBe("draft");
    });

    expect(toastSuccess).toHaveBeenCalledWith(expect.stringMatching(/activada/i));

    // After save, fetchAll() runs and the second GET returns 'draft' — the
    // button should disappear.
    await waitFor(() => {
      expect(screen.queryByLabelText(/Activar estrategia/i)).toBeNull();
    });
  });
});
