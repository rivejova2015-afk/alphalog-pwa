// @vitest-environment jsdom
//
// RegimePill — Phase 7 of the regime-aware multi-strategy restructure.
// Renders the current market regime as a colored pill with the strategy
// the coordinator would dispatch to. Visible inside CoinarbControlPanel.

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RegimePill } from "../CoinarbControlPanel.client";

describe("RegimePill", () => {
  it("renders a muted placeholder when regime is null", () => {
    render(<RegimePill regime={null} />);
    const pill = screen.getByTestId("regime-pill");
    expect(pill).toBeInTheDocument();
    expect(pill).toHaveAttribute("data-regime", "UNKNOWN");
    expect(pill.textContent).toMatch(/awaiting first read/);
  });

  it("renders TRENDING_HIGH with emerald accent + SMC aggressive strategy", () => {
    render(<RegimePill regime="TRENDING_HIGH" />);
    const pill = screen.getByTestId("regime-pill");
    expect(pill).toHaveAttribute("data-regime", "TRENDING_HIGH");
    expect(pill.textContent).toMatch(/Trending · High Vol/);
    expect(pill.textContent).toMatch(/SMC aggressive/);
    expect(pill.className).toMatch(/emerald/);
  });

  it("renders TRENDING_LOW with cyan accent + Momentum breakout", () => {
    render(<RegimePill regime="TRENDING_LOW" />);
    const pill = screen.getByTestId("regime-pill");
    expect(pill.textContent).toMatch(/Trending · Low Vol/);
    expect(pill.textContent).toMatch(/Momentum breakout/);
    expect(pill.className).toMatch(/cyan/);
  });

  it("renders RANGE_HIGH with amber accent + SMC strict", () => {
    render(<RegimePill regime="RANGE_HIGH" />);
    const pill = screen.getByTestId("regime-pill");
    expect(pill.textContent).toMatch(/Range · High Vol/);
    expect(pill.textContent).toMatch(/SMC strict/);
    expect(pill.className).toMatch(/amber/);
  });

  it("renders RANGE_LOW with violet accent + Mean reversion", () => {
    render(<RegimePill regime="RANGE_LOW" />);
    const pill = screen.getByTestId("regime-pill");
    expect(pill.textContent).toMatch(/Range · Low Vol/);
    expect(pill.textContent).toMatch(/Mean reversion/);
    expect(pill.className).toMatch(/violet/);
  });

  it("renders DEAD as muted with Pause strategy", () => {
    render(<RegimePill regime="DEAD" />);
    const pill = screen.getByTestId("regime-pill");
    expect(pill.textContent).toMatch(/Dead/);
    expect(pill.textContent).toMatch(/Pause/);
    expect(pill.className).toMatch(/slate/);
  });

  it("includes a description in the title attribute (hover tooltip)", () => {
    render(<RegimePill regime="TRENDING_HIGH" />);
    const pill = screen.getByTestId("regime-pill");
    const title = pill.getAttribute("title");
    expect(title).toBeTruthy();
    expect(title).toMatch(/ADX/);
    expect(title).toMatch(/atrNorm/);
  });

  it("null state also has an explanatory title (so operator knows why pill is muted)", () => {
    render(<RegimePill regime={null} />);
    const pill = screen.getByTestId("regime-pill");
    const title = pill.getAttribute("title");
    expect(title).toBeTruthy();
    expect(title).toMatch(/Waiting for regime detector/);
  });
});
