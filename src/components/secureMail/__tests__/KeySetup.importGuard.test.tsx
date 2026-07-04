// @vitest-environment jsdom
//
// KeySetup — import flow guard contra private keys sin passphrase.
// Bug encontrado en la auditoría de madurez 2026-07: antes se guardaba
// cualquier private key pegada tal cual (key_kdf hardcodeado a 'Imported'),
// sin verificar que la key estuviera realmente cifrada. Ahora
// isPrivateKeyPassphraseProtected() se chequea antes del insert.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import KeySetup from "../KeySetup.client";

const { verifyPublicKeyMock, isProtectedMock, insertMock, getUserMock } = vi.hoisted(() => ({
  verifyPublicKeyMock: vi.fn(),
  isProtectedMock: vi.fn(),
  insertMock: vi.fn(),
  getUserMock: vi.fn(),
}));

vi.mock("@/lib/crypto/openpgp", () => ({
  generateKeypair: vi.fn(),
  verifyPublicKey: (...args: unknown[]) => verifyPublicKeyMock(...args),
  isPrivateKeyPassphraseProtected: (...args: unknown[]) => isProtectedMock(...args),
}));
vi.mock("@/lib/supabase/browser", () => ({
  createClient: () => ({
    auth: { getUser: getUserMock },
    from: () => ({ insert: insertMock }),
  }),
}));

async function fillImportForm() {
  fireEvent.click(screen.getByText(/Import Existing Keys/i));
  fireEvent.change(screen.getByPlaceholderText("john@example.com"), { target: { value: "a@b.com" } });
  fireEvent.change(screen.getByPlaceholderText("-----BEGIN PGP PUBLIC KEY BLOCK-----"), { target: { value: "PUBKEY" } });
  fireEvent.change(screen.getByPlaceholderText("-----BEGIN PGP PRIVATE KEY BLOCK-----"), { target: { value: "PRIVKEY" } });
  fireEvent.change(screen.getByPlaceholderText("••••••••••••"), { target: { value: "a-strong-passphrase" } });
  fireEvent.click(screen.getByRole("button", { name: /Import Keys/i }));
}

describe("KeySetup — import guard against unprotected private keys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyPublicKeyMock.mockResolvedValue(true);
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    insertMock.mockResolvedValue({ error: null });
  });

  it("rechaza el import y NO inserta si la private key no está protegida por passphrase", async () => {
    isProtectedMock.mockResolvedValue(false);
    render(<KeySetup />);
    await fillImportForm();

    await waitFor(() => {
      expect(screen.getByText(/no está protegida por passphrase/i)).toBeDefined();
    });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("permite el import cuando la private key sí está protegida", async () => {
    isProtectedMock.mockResolvedValue(true);
    render(<KeySetup />);
    await fillImportForm();

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText(/importados exitosamente|imported successfully/i)).toBeDefined();
  });
});
