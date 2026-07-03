// @vitest-environment jsdom
//
// CmeAlgoTabs — tab-switch shell routing between the propfirm and real
// broker CME workspaces (Wave 4 item 20). Both child workspaces self-fetch
// heavily, so they're stubbed — this test only covers the tab state machine.

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("../CmePropFirmWorkspace.client", () => ({
  default: () => <div data-testid="propfirm-workspace">PropFirm workspace</div>,
}));
vi.mock("../CmeRealBrokerWorkspace.client", () => ({
  default: () => <div data-testid="broker-workspace">Real broker workspace</div>,
}));

import CmeAlgoTabs from "../CmeAlgoTabs.client";

describe("CmeAlgoTabs", () => {
  it("defaults to the PropFirm tab active and its workspace rendered", () => {
    render(<CmeAlgoTabs />);
    const propfirmBtn = screen.getByText("CME PropFirm");
    expect(propfirmBtn.className).toContain("bg-white/10");
    expect(screen.getByTestId("propfirm-workspace")).toBeDefined();
    expect(screen.queryByTestId("broker-workspace")).toBeNull();
  });

  it("switches to the Real Broker tab on click", () => {
    render(<CmeAlgoTabs />);
    fireEvent.click(screen.getByText("CME Real Broker"));

    expect(screen.getByTestId("broker-workspace")).toBeDefined();
    expect(screen.queryByTestId("propfirm-workspace")).toBeNull();
    expect(screen.getByText("CME Real Broker").className).toContain("bg-white/10");
    expect(screen.getByText("CME PropFirm").className).not.toContain("bg-white/10");
  });
});
