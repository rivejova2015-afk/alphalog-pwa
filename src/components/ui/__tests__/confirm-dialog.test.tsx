// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "../confirm-dialog";

describe("ConfirmDialog", () => {
  it("does not render when open is false", () => {
    const { queryByText } = render(
      <ConfirmDialog
        open={false}
        title="Delete?"
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(queryByText("Delete?")).not.toBeInTheDocument();
  });

  it("renders title and message when open", () => {
    render(
      <ConfirmDialog
        open
        title="Delete file?"
        message="This cannot be undone."
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByText("Delete file?")).toBeInTheDocument();
    expect(screen.getByText("This cannot be undone.")).toBeInTheDocument();
  });

  it("calls onConfirm when confirm button is clicked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Go?"
        confirmLabel="Yes do it"
        onCancel={() => {}}
        onConfirm={onConfirm}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Yes do it" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("calls onCancel when cancel button is clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Go?"
        cancelLabel="No"
        onCancel={onCancel}
        onConfirm={() => {}}
      />,
    );
    await user.click(screen.getByRole("button", { name: "No" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
