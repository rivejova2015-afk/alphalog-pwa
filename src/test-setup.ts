// Vitest setup file — runs before every test file.
// Pulls in @testing-library/jest-dom matchers (toBeInTheDocument, etc.) and
// cleans up React trees between tests to prevent state leaks.

import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

// jsdom does not implement <dialog> showModal/close. Stub them so components
// that use <Modal>/<ConfirmDialog> render without throwing under tests.
if (typeof HTMLDialogElement !== "undefined") {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () { (this as HTMLDialogElement).open = true; };
  }
  if (!HTMLDialogElement.prototype.show) {
    HTMLDialogElement.prototype.show = function () { (this as HTMLDialogElement).open = true; };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function () { (this as HTMLDialogElement).open = false; };
  }
}
