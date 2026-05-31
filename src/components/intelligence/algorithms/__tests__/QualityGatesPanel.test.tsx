// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import QualityGatesPanel from "../QualityGatesPanel.client";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

function mockGatesResponse(score: {
  gates_passed:  number;
  gates_total:   number;
  must_failed:   number;
  should_failed: number;
  tier:          "TIER_1" | "TIER_2" | "NOT_READY";
}) {
  return {
    algorithm: { id: "algo-1", name: "Test", status: "paused" },
    score: {
      algorithm_id:     "algo-1",
      gates_total:      score.gates_total,
      gates_passed:     score.gates_passed,
      must_failed:      score.must_failed,
      should_failed:    score.should_failed,
      last_computed_at: new Date().toISOString(),
      tier:             score.tier,
    },
    breakdown: [],
  };
}

describe("QualityGatesPanel — tier badge", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders TIER_1 emerald badge when all 20 gates pass", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok:   true,
      json: () => Promise.resolve(mockGatesResponse({
        gates_passed: 20, gates_total: 20, must_failed: 0, should_failed: 0, tier: "TIER_1",
      })),
    }) as unknown as typeof fetch;

    render(<QualityGatesPanel algorithmId="algo-1" />);

    await waitFor(() => {
      expect(screen.getByText(/TIER 1/i)).toBeInTheDocument();
    });
    // 20 / 20 visible
    expect(screen.getByText("20")).toBeInTheDocument();
  });

  it("renders TIER_2 amber badge when must_failed=0 but should_failed>0", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok:   true,
      json: () => Promise.resolve(mockGatesResponse({
        gates_passed: 18, gates_total: 20, must_failed: 0, should_failed: 2, tier: "TIER_2",
      })),
    }) as unknown as typeof fetch;

    render(<QualityGatesPanel algorithmId="algo-1" />);

    await waitFor(() => {
      expect(screen.getByText(/TIER 2/i)).toBeInTheDocument();
    });
    expect(screen.getByText("18")).toBeInTheDocument();
  });

  it("renders NOT_READY when any must-gate failed", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok:   true,
      json: () => Promise.resolve(mockGatesResponse({
        gates_passed: 15, gates_total: 20, must_failed: 3, should_failed: 2, tier: "NOT_READY",
      })),
    }) as unknown as typeof fetch;

    render(<QualityGatesPanel algorithmId="algo-1" />);

    await waitFor(() => {
      expect(screen.getByText(/NOT READY/i)).toBeInTheDocument();
    });
    // Alert banner shows the must-failed count
    expect(screen.getByText(/3 must-gates fallidas/i)).toBeInTheDocument();
  });
});
