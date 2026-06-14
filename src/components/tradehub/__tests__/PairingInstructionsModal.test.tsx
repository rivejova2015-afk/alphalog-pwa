// @vitest-environment jsdom
//
// PairingInstructionsModal — modal del flujo MT5 pairing con countdown
// timer + copy button. Validates:
//   1. Renders dialog con role + aria-modal + aria-label.
//   2. EA download link con href + download attr.
//   3. 6 steps numerados 1-6 renderizan.
//   4. Token visible en el placeholder del Step 5.
//   5. Countdown timer muestra MM:SS cuando expiresAt está en futuro.
//      expiresInMinutes mencionado en el hint.
//   6. Expired state: token con line-through, copy button disabled,
//      hint "Token expirado".
//   7. Copy success → clipboard.writeText con token + toast.success +
//      label flips a "Copiado".
//   8. Copy failure → toast.error + label permanece "Copiar".
//   9. Close button (X + bottom "Listo") invocan onClose.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

const { toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
  toastSuccessMock: vi.fn(),
  toastErrorMock:   vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: { success: toastSuccessMock, error: toastErrorMock, info: vi.fn(), warning: vi.fn(), message: vi.fn() },
}));

import PairingInstructionsModal from "../PairingInstructionsModal.client";

const futureIso = (minutesFromNow: number) =>
  new Date(Date.now() + minutesFromNow * 60_000).toISOString();
const pastIso = () => new Date(Date.now() - 60_000).toISOString();

describe("PairingInstructionsModal", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
  });

  it("renders a dialog with the right aria attributes", () => {
    render(
      <PairingInstructionsModal
        token="ABC123"
        expiresAt={futureIso(10)}
        expiresInMinutes={10}
        onClose={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-label")).toMatch(/emparejamiento MT5/i);
  });

  it("renders the EA download link with the right href + download attribute", () => {
    render(
      <PairingInstructionsModal
        token="ABC123"
        expiresAt={futureIso(10)}
        expiresInMinutes={10}
        onClose={vi.fn()}
      />,
    );
    const link = screen.getByRole("link", { name: /AlphaLogTelemetry\.ex5/i });
    expect(link.getAttribute("href")).toBe("/ea/AlphaLogTelemetry.ex5");
    expect(link.hasAttribute("download")).toBe(true);
  });

  it("renders all 6 step numbers", () => {
    render(
      <PairingInstructionsModal
        token="ABC123"
        expiresAt={futureIso(10)}
        expiresInMinutes={10}
        onClose={vi.fn()}
      />,
    );
    for (const n of ["1", "2", "3", "4", "5", "6"]) {
      expect(screen.getByText(n)).toBeDefined();
    }
  });

  it("renders the token in the Step 5 placeholder code block", () => {
    render(
      <PairingInstructionsModal
        token="XYZ987-PAIRING"
        expiresAt={futureIso(10)}
        expiresInMinutes={10}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("XYZ987-PAIRING")).toBeDefined();
  });

  it("renders countdown MM:SS + expiresInMinutes mention when not expired", () => {
    render(
      <PairingInstructionsModal
        token="t"
        expiresAt={futureIso(10)}
        expiresInMinutes={10}
        onClose={vi.fn()}
      />,
    );
    // Hint includes the configured-for-N-min phrasing.
    expect(screen.getByText(/configurado para 10 min/i)).toBeDefined();
    // Countdown displays MM:SS — 10 min from now should show "10:00" or "9:59".
    expect(screen.getByText(/Expira en (10:00|9:5\d)/i)).toBeDefined();
  });

  it("expired state: token line-through, copy disabled, 'Token expirado' hint", () => {
    render(
      <PairingInstructionsModal
        token="OLDTOKEN"
        expiresAt={pastIso()}
        expiresInMinutes={10}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/Token expirado/i)).toBeDefined();
    const tokenEl = screen.getByText("OLDTOKEN");
    expect(tokenEl.className).toContain("line-through");
    const copyBtn = screen.getByRole("button", { name: /Copiar/i }) as HTMLButtonElement;
    expect(copyBtn.disabled).toBe(true);
  });

  it("Copy success: clipboard called with token + toast.success + label flips to 'Copiado'", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    render(
      <PairingInstructionsModal
        token="COPY-ME"
        expiresAt={futureIso(10)}
        expiresInMinutes={10}
        onClose={vi.fn()}
      />,
    );
    const copyBtn = screen.getByRole("button", { name: /Copiar/i });
    await act(async () => {
      fireEvent.click(copyBtn);
    });

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("COPY-ME");
      expect(toastSuccessMock).toHaveBeenCalledWith("Token copiado");
      expect(screen.getByRole("button", { name: /Copiado/i })).toBeDefined();
    });
  });

  it("Copy failure: clipboard rejects → toast.error, label stays 'Copiar'", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("permission denied"));
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    render(
      <PairingInstructionsModal
        token="t"
        expiresAt={futureIso(10)}
        expiresInMinutes={10}
        onClose={vi.fn()}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Copiar/i }));
    });

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("No se pudo copiar");
    });
    // Label stays "Copiar" because the success path didn't run.
    expect(screen.getByRole("button", { name: /Copiar/i })).toBeDefined();
    expect(screen.queryByRole("button", { name: /Copiado/i })).toBeNull();
  });

  it("X icon button and bottom 'Listo' button both invoke onClose", () => {
    const onClose = vi.fn();
    render(
      <PairingInstructionsModal
        token="t"
        expiresAt={futureIso(10)}
        expiresInMinutes={10}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByLabelText(/Cerrar/i));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /^Listo$/i }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
