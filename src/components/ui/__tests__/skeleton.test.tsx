// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Skeleton, SkeletonText } from "../skeleton";

describe("Skeleton", () => {
  it("renders a single placeholder by default", () => {
    const { container } = render(<Skeleton />);
    const skeletons = container.querySelectorAll('[aria-hidden="true"]');
    expect(skeletons.length).toBe(1);
  });

  it("renders multiple placeholders with count > 1", () => {
    const { container } = render(<Skeleton count={5} />);
    // Wrapper is also aria-hidden; expect 1 wrapper + 5 child placeholders.
    const items = container.querySelectorAll('.animate-pulse');
    expect(items.length).toBe(5);
  });

  it("SkeletonText renders the requested number of lines", () => {
    const { container } = render(<SkeletonText lines={4} />);
    const lines = container.querySelectorAll('.animate-pulse');
    expect(lines.length).toBe(4);
  });
});
