// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import QualityGatesPanel from "../QualityGatesPanel.client";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

function mockResp(score: { gates_passed: number; must_failed: number; tier: "TIER_1" | "TIER_2" | "NOT_READY" }) {
  return {
    ok:   true,
    json: () => Promise.resolve({
      algorithm: { id: "algo-x", name: "Test", status: "paused" },
      score: {
        algorithm_id:     "algo-x",
        gates_total:      20,
        gates_passed:     score.gates_passed,
        must_failed:      score.must_failed,
        should_failed:    0,
        last_computed_at: new Date().toISOString(),
        tier:             score.tier,
      },
      breakdown: [],
    }),
  };
}

describe("QualityGatesPanel — promote button gating", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("disables Promote when must_failed > 0", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      mockResp({ gates_passed: 18, must_failed: 2, tier: "NOT_READY" }),
    ) as unknown as typeof fetch;

    render(<QualityGatesPanel algorithmId="algo-x" />);

    await waitFor(() => screen.getByText(/Promover a LIVE/i));

    const btn = screen.getByRole("button", { name: /Promover a LIVE/i });
    expect(btn).toBeDisabled();
    expect(btn.getAttribute("title")).toMatch(/Bloqueado/i);
  });

  it("disables Promote when gates_passed < 20 even if no must failed", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      mockResp({ gates_passed: 18, must_failed: 0, tier: "TIER_2" }),
    ) as unknown as typeof fetch;

    render(<QualityGatesPanel algorithmId="algo-x" />);

    await waitFor(() => screen.getByText(/Promover a LIVE/i));

    const btn = screen.getByRole("button", { name: /Promover a LIVE/i });
    expect(btn).toBeDisabled();
  });

  it("enables Promote when gates_passed === 20 AND must_failed === 0", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      mockResp({ gates_passed: 20, must_failed: 0, tier: "TIER_1" }),
    ) as unknown as typeof fetch;

    render(<QualityGatesPanel algorithmId="algo-x" />);

    await waitFor(() => screen.getByText(/Promover a LIVE/i));

    const btn = screen.getByRole("button", { name: /Promover a LIVE/i });
    expect(btn).not.toBeDisabled();
  });
});
