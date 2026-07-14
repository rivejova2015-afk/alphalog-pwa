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

import { storeInstanceSecret, readInstanceSecret, deleteInstanceSecret } from "../vault";

describe("mt5/vault", () => {
  beforeEach(() => {
    mockGetLatticeSecret.mockReset();
    mockSetLatticeSecret.mockReset();
    mockDeleteLatticeSecret.mockReset();
  });

  describe("storeInstanceSecret", () => {
    it("llama setLatticeSecret con project='alphalog-mt5' y name=<bot_instances.id>", async () => {
      mockSetLatticeSecret.mockResolvedValue(undefined);
      await storeInstanceSecret("instance-123", "my-secret");
      expect(mockSetLatticeSecret).toHaveBeenCalledWith("alphalog-mt5", "instance-123", "my-secret");
    });

    it("propaga el error si setLatticeSecret rechaza", async () => {
      mockSetLatticeSecret.mockRejectedValue(new Error("vault unreachable"));
      await expect(storeInstanceSecret("instance-x", "tok")).rejects.toThrow(/vault unreachable/);
    });
  });

  describe("readInstanceSecret", () => {
    it("retorna el secreto cuando existe", async () => {
      mockGetLatticeSecret.mockResolvedValue("stored-secret");
      const s = await readInstanceSecret("instance-1");
      expect(s).toBe("stored-secret");
      expect(mockGetLatticeSecret).toHaveBeenCalledWith("alphalog-mt5", "instance-1");
    });

    it("retorna null cuando no existe", async () => {
      mockGetLatticeSecret.mockResolvedValue(null);
      const s = await readInstanceSecret("instance-x");
      expect(s).toBeNull();
    });
  });

  describe("deleteInstanceSecret", () => {
    it("llama deleteLatticeSecret con project='alphalog-mt5' y name=<bot_instances.id>", async () => {
      mockDeleteLatticeSecret.mockResolvedValue(undefined);
      await deleteInstanceSecret("instance-7");
      expect(mockDeleteLatticeSecret).toHaveBeenCalledWith("alphalog-mt5", "instance-7");
    });
  });
});
