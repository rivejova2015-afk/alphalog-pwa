import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock lattice-secrets before importing the module
const mockGetLatticeSecret = vi.fn();
const mockSetLatticeSecret = vi.fn();
const mockDeleteLatticeSecret = vi.fn();
vi.mock("../../lattice-secrets", () => ({
  getLatticeSecret: (...args: unknown[]) => mockGetLatticeSecret(...args),
  setLatticeSecret: (...args: unknown[]) => mockSetLatticeSecret(...args),
  deleteLatticeSecret: (...args: unknown[]) => mockDeleteLatticeSecret(...args),
}));

import { storeCmeAccessToken, readCmeAccessToken, deleteCmeAccessToken } from "../vault";

describe("vault", () => {
  beforeEach(() => {
    mockGetLatticeSecret.mockReset();
    mockSetLatticeSecret.mockReset();
    mockDeleteLatticeSecret.mockReset();
  });

  describe("storeCmeAccessToken", () => {
    it("llama setLatticeSecret con project='alphalog-cme' y name='cme-access:{connectionId}'", async () => {
      mockSetLatticeSecret.mockResolvedValue(undefined);
      await storeCmeAccessToken("conn-123", "my-token");
      expect(mockSetLatticeSecret).toHaveBeenCalledWith("alphalog-cme", "cme-access:conn-123", "my-token");
    });

    it("propaga el error si setLatticeSecret rechaza", async () => {
      mockSetLatticeSecret.mockRejectedValue(new Error("RLS denied"));
      await expect(storeCmeAccessToken("conn-x", "tok")).rejects.toThrow(/RLS denied/);
    });
  });

  describe("readCmeAccessToken", () => {
    it("retorna el token cuando existe", async () => {
      mockGetLatticeSecret.mockResolvedValue("stored-token");
      const t = await readCmeAccessToken("conn-1");
      expect(t).toBe("stored-token");
      expect(mockGetLatticeSecret).toHaveBeenCalledWith("alphalog-cme", "cme-access:conn-1");
    });

    it("retorna null cuando no existe", async () => {
      mockGetLatticeSecret.mockResolvedValue(null);
      const t = await readCmeAccessToken("conn-x");
      expect(t).toBeNull();
    });
  });

  describe("deleteCmeAccessToken", () => {
    it("llama deleteLatticeSecret con project='alphalog-cme' y name='cme-access:{connectionId}'", async () => {
      mockDeleteLatticeSecret.mockResolvedValue(undefined);
      await deleteCmeAccessToken("conn-7");
      expect(mockDeleteLatticeSecret).toHaveBeenCalledWith("alphalog-cme", "cme-access:conn-7");
    });
  });
});
