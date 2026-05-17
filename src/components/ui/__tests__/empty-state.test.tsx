// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "../empty-state";

describe("EmptyState", () => {
  it("renders title and message", () => {
    render(<EmptyState title="No data" message="Try uploading some." />);
    expect(screen.getByText("No data")).toBeInTheDocument();
    expect(screen.getByText("Try uploading some.")).toBeInTheDocument();
  });

  it("renders the action node when provided", () => {
    render(
      <EmptyState
        title="No data"
        action={<button type="button">Upload</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Upload" })).toBeInTheDocument();
  });

  it("has role=status for screen readers", () => {
    render(<EmptyState title="Empty" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
