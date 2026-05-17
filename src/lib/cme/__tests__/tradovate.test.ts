import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  tradovateAuth,
  tradovateRenew,
  getAccounts,
  placeMarketOrder,
  getPositions,
  closePosition,
} from "../tradovate";

const DEFAULT_CREDS = {
  name: "test-user",
  password: "secret",
  appId: "alphalog",
  appVersion: "1.0",
  cid: 123,
  sec: "abc",
};

describe("tradovate", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("tradovateAuth", () => {
    it("happy path: retorna accessToken + userId + expirationTime", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({
          accessToken: "token-xyz",
          userId: 42,
          expirationTime: "2026-05-04T14:00:00Z",
        }),
      });
      const r = await tradovateAuth(DEFAULT_CREDS, true);
      expect(r.accessToken).toBe("token-xyz");
      expect(r.userId).toBe(42);
    });

    it("throw cuando response.ok = false", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: async () => "Invalid credentials",
      });
      await expect(tradovateAuth(DEFAULT_CREDS, true)).rejects.toThrow(/auth failed.*401/);
    });

    it("throw cuando respuesta contiene p-ticket (captcha)", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({ "p-ticket": "captcha-token" }),
      });
      await expect(tradovateAuth(DEFAULT_CREDS, true)).rejects.toThrow(/captcha required/);
    });

    it("throw cuando respuesta tiene errorText", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({ errorText: "Account locked" }),
      });
      await expect(tradovateAuth(DEFAULT_CREDS, true)).rejects.toThrow(/Account locked/);
    });

    it("throw cuando respuesta no incluye accessToken", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({ userId: 42 }),
      });
      await expect(tradovateAuth(DEFAULT_CREDS, true)).rejects.toThrow(/no accessToken/);
    });

    it("usa endpoint demo cuando isPaper=true", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({ accessToken: "t", userId: 1, expirationTime: "x" }),
      });
      await tradovateAuth(DEFAULT_CREDS, true);
      const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(url).toContain("demo.tradovateapi.com");
    });

    it("usa endpoint live cuando isPaper=false", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({ accessToken: "t", userId: 1, expirationTime: "x" }),
      });
      await tradovateAuth(DEFAULT_CREDS, false);
      const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(url).toContain("live.tradovateapi.com");
    });
  });

  describe("tradovateRenew", () => {
    it("retorna nuevo accessToken", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({ accessToken: "new-token", expirationTime: "later" }),
      });
      const r = await tradovateRenew("old-token", true);
      expect(r.accessToken).toBe("new-token");
    });

    it("throw cuando renew falla", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => "Token expired",
      });
      await expect(tradovateRenew("old", true)).rejects.toThrow(/renew failed.*403/);
    });
  });

  describe("getAccounts", () => {
    it("retorna lista de accounts", async () => {
      const accounts = [
        { id: 1, name: "Demo1", accountType: "Customer", active: true },
        { id: 2, name: "Demo2", accountType: "Customer", active: false },
      ];
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => accounts,
      });
      const r = await getAccounts("token", true);
      expect(r).toHaveLength(2);
      expect(r[0].name).toBe("Demo1");
    });
  });

  describe("placeMarketOrder", () => {
    it("envía bracket1 (SL) + bracket2 (TP)", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({ orderId: 999, orderStatus: "Working" }),
      });
      const r = await placeMarketOrder({
        token: "t",
        isPaper: true,
        accountSpec: "spec",
        accountId: 1,
        action: "Buy",
        symbol: "ES",
        qty: 1,
        slTicks: 10,
        tpTicks: 20,
      });
      expect(r.orderId).toBe(999);
      const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
      expect(body.bracket1.action).toBe("Sell"); // contraria a Buy
      expect(body.bracket2.action).toBe("Sell");
      expect(body.bracket1.stopPriceTicks).toBe(10);
      expect(body.bracket2.limitPriceTicks).toBe(20);
    });

    it("invierte brackets cuando action=Sell", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({ orderId: 1, orderStatus: "Working" }),
      });
      await placeMarketOrder({
        token: "t", isPaper: true, accountSpec: "s", accountId: 1,
        action: "Sell", symbol: "ES", qty: 1, slTicks: 10, tpTicks: 20,
      });
      const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
      expect(body.bracket1.action).toBe("Buy");
      expect(body.bracket2.action).toBe("Buy");
    });

    it("throw cuando placeOrder falla", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => "Invalid contract",
      });
      await expect(placeMarketOrder({
        token: "t", isPaper: true, accountSpec: "s", accountId: 1,
        action: "Buy", symbol: "BAD", qty: 1, slTicks: 10, tpTicks: 20,
      })).rejects.toThrow(/placeOrder failed.*400/);
    });
  });

  describe("getPositions", () => {
    it("filtra posiciones con netPos = 0", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => [
          { id: 1, accountId: 100, contractId: 1, netPos: 5, netPrice: 4000, bought: 5, boughtValue: 20000, sold: 0, soldValue: 0, prevPos: 0, prevPrice: 0, timestamp: "x", tradeDate: { year: 2026, month: 5, day: 3 } },
          { id: 2, accountId: 100, contractId: 2, netPos: 0, netPrice: 0, bought: 1, boughtValue: 1000, sold: 1, soldValue: 1000, prevPos: 0, prevPrice: 0, timestamp: "x", tradeDate: { year: 2026, month: 5, day: 3 } },
        ],
      });
      const r = await getPositions("t", 100, true);
      expect(r).toHaveLength(1);
      expect(r[0].id).toBe(1);
    });

    it("filtra posiciones de otros accountId", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => [
          { id: 1, accountId: 100, netPos: 5, contractId: 1, netPrice: 4000, bought: 5, boughtValue: 0, sold: 0, soldValue: 0, prevPos: 0, prevPrice: 0, timestamp: "x", tradeDate: { year: 2026, month: 5, day: 3 } },
          { id: 2, accountId: 200, netPos: 3, contractId: 1, netPrice: 4000, bought: 3, boughtValue: 0, sold: 0, soldValue: 0, prevPos: 0, prevPrice: 0, timestamp: "x", tradeDate: { year: 2026, month: 5, day: 3 } },
        ],
      });
      const r = await getPositions("t", 100, true);
      expect(r).toHaveLength(1);
      expect(r[0].accountId).toBe(100);
    });
  });

  describe("closePosition", () => {
    it("retorna orderId del liquidate", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({ orderId: 555 }),
      });
      const r = await closePosition({
        token: "t", isPaper: true, accountSpec: "s", accountId: 1,
        positionId: 99, symbol: "ES", qty: 1,
      });
      expect(r.orderId).toBe(555);
    });

    it("throw cuando close falla", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "Server error",
      });
      await expect(closePosition({
        token: "t", isPaper: true, accountSpec: "s", accountId: 1,
        positionId: 99, symbol: "ES", qty: 1,
      })).rejects.toThrow(/closePosition failed.*500/);
    });
  });
});
