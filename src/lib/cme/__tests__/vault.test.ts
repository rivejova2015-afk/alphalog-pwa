import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase server before importing the module
const mockRpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({ rpc: mockRpc }),
}));

import { storeCmeAccessToken, readCmeAccessToken, deleteCmeAccessToken } from "../vault";

describe("vault", () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  describe("storeCmeAccessToken", () => {
    it("llama store_vault_secret con clave cme-access:{connectionId}", async () => {
      mockRpc.mockResolvedValue({ error: null });
      await storeCmeAccessToken("conn-123", "my-token");
      expect(mockRpc).toHaveBeenCalledWith("store_vault_secret", {
        p_name: "cme-access:conn-123",
        p_secret: "my-token",
      });
    });

    it("throw cuando RPC retorna error", async () => {
      mockRpc.mockResolvedValue({ error: { message: "RLS denied" } });
      await expect(storeCmeAccessToken("conn-x", "tok")).rejects.toThrow(/RLS denied/);
    });
  });

  describe("readCmeAccessToken", () => {
    it("retorna el token cuando existe", async () => {
      mockRpc.mockResolvedValue({ data: "stored-token", error: null });
      const t = await readCmeAccessToken("conn-1");
      expect(t).toBe("stored-token");
      expect(mockRpc).toHaveBeenCalledWith("read_vault_secret", { p_name: "cme-access:conn-1" });
    });

    it("retorna null cuando data es null", async () => {
      mockRpc.mockResolvedValue({ data: null, error: null });
      const t = await readCmeAccessToken("conn-x");
      expect(t).toBeNull();
    });

    it("retorna null cuando hay error (fail-soft)", async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: "not found" } });
      const t = await readCmeAccessToken("conn-x");
      expect(t).toBeNull();
    });
  });

  describe("deleteCmeAccessToken", () => {
    it("sobrescribe el secret con cadena vacía", async () => {
      mockRpc.mockResolvedValue({ error: null });
      await deleteCmeAccessToken("conn-7");
      expect(mockRpc).toHaveBeenCalledWith("store_vault_secret", {
        p_name: "cme-access:conn-7",
        p_secret: "",
      });
    });

    it("no propaga errores (catch silently)", async () => {
      mockRpc.mockReturnValue({ catch: (fn: () => void) => { fn(); return Promise.resolve(); } });
      await expect(deleteCmeAccessToken("conn-x")).resolves.toBeUndefined();
    });
  });
});
