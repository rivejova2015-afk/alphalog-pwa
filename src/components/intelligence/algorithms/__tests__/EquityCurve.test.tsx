// @vitest-environment jsdom
//
// EquityCurve — SVG sparkline. Validates:
//   1. Renders an svg root con viewBox y height correctos.
//   2. Path se renderiza cuando hay ≥2 points.
//   3. NO renderiza path cuando < 2 points (defensive).
//   4. min/max labels reflejan los extremos del array de equity points.
//   5. Color emerald cuando final_equity >= start_equity (positive trend).
//   6. Color red cuando final_equity < start_equity (negative trend).
//   7. Gradient id incluye el algoId slugified.
//   8. Custom height prop se aplica al svg style.
//   9. Default DEMO_POINTS cuando no se pasan points.

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EquityCurve } from "../EquityCurve";

describe("EquityCurve", () => {
  it("renders an svg root with the default viewBox and height", () => {
    const { container } = render(<EquityCurve points={[{ date: "2026-01-01", equity: 100 }, { date: "2026-01-02", equity: 110 }]} />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute("viewBox")).toBe("0 0 100 120");
  });

  it("renders a path element when there are 2+ points", () => {
    const { container } = render(<EquityCurve points={[
      { date: "2026-01-01", equity: 100 },
      { date: "2026-01-02", equity: 110 },
      { date: "2026-01-03", equity: 105 },
    ]} />);
    expect(container.querySelector("path")).not.toBeNull();
  });

  it("does NOT render a path when there is only 1 point (defensive)", () => {
    const { container } = render(<EquityCurve points={[{ date: "2026-01-01", equity: 100 }]} />);
    expect(container.querySelector("path")).toBeNull();
  });

  it("renders min/max equity labels in the footer", () => {
    render(<EquityCurve points={[
      { date: "2026-01-01", equity: 10_000 },
      { date: "2026-01-02", equity: 12_500 },
      { date: "2026-01-03", equity: 9_800 },
    ]} />);
    expect(screen.getByText("$9,800")).toBeDefined();
    expect(screen.getByText("$12,500")).toBeDefined();
  });

  it("colors the path emerald when the last equity >= the first (positive trend)", () => {
    const { container } = render(<EquityCurve points={[
      { date: "2026-01-01", equity: 10_000 },
      { date: "2026-01-02", equity: 11_000 },
    ]} />);
    const path = container.querySelector("path");
    expect(path?.getAttribute("stroke")).toBe("#34d399");
  });

  it("colors the path red when the last equity < the first (negative trend)", () => {
    const { container } = render(<EquityCurve points={[
      { date: "2026-01-01", equity: 11_000 },
      { date: "2026-01-02", equity: 10_000 },
    ]} />);
    const path = container.querySelector("path");
    expect(path?.getAttribute("stroke")).toBe("#ef4444");
  });

  it("uses the algoId in the gradient id (slugified)", () => {
    const { container } = render(<EquityCurve
      algoId="ES Strategy"
      points={[{ date: "2026-01-01", equity: 100 }, { date: "2026-01-02", equity: 110 }]}
    />);
    const linearGradient = container.querySelector("linearGradient");
    expect(linearGradient?.id).toBe("equity-gradient-es-strategy");
  });

  it("applies the custom height prop to the svg style", () => {
    const { container } = render(<EquityCurve
      height={250}
      points={[{ date: "2026-01-01", equity: 100 }, { date: "2026-01-02", equity: 110 }]}
    />);
    const svg = container.querySelector("svg") as SVGElement;
    expect(svg.style.height).toBe("250px");
    expect(svg.getAttribute("viewBox")).toBe("0 0 100 250");
  });

  it("renders the DEMO_POINTS when no points prop is passed (30-day demo curve)", () => {
    const { container } = render(<EquityCurve />);
    // A path WILL render because DEMO_POINTS has 30 entries.
    expect(container.querySelector("path")).not.toBeNull();
    // Both min and max footer labels render — query by their dollar-sign prefix.
    const dollarLabels = Array.from(container.querySelectorAll("span")).filter(
      (s) => s.textContent?.startsWith("$"),
    );
    expect(dollarLabels.length).toBeGreaterThanOrEqual(2);
  });
});
