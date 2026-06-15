// Unit tests for src/lib/security/aiRateLimit.ts.
//
// Hourly per-user-per-endpoint rate limit con RPC `increment_api_rate_limit`.
// Validates:
//   - allowed=true cuando Supabase env vars no están configuradas (fail-open).
//   - allowed=true cuando RPC tira error (fail-open).
//   - allowed=true cuando hits <= maxPerHour.
//   - allowed=false + retryAfterSeconds cuando hits > maxPerHour.
//   - retryAfterSeconds capped at 3600 (1 hora).
//   - Rate limit key incluye el endpoint y userId.
//   - Catches unexpected exceptions y returns allowed=true.

import { describe, it, expect, vi, beforeEach } from "vitest";

const { createClientMock, rpcMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  rpcMock:          vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({ createClient: createClientMock }));
vi.mock("@/lib/log", () => ({
  logError: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn(),
}));

import { checkAiRateLimit } from "../aiRateLimit";

describe("checkAiRateLimit", () => {
  beforeEach(() => {
    createClientMock.mockReset();
    rpcMock.mockReset();
    createClientMock.mockReturnValue({ rpc: rpcMock });
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  });

  it("fail-open cuando SUPABASE_SERVICE_ROLE_KEY no está configurada", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const result = await checkAiRateLimit("u1", "ai-evidence");
    expect(result.allowed).toBe(true);
    expect(createClientMock).not.toHaveBeenCalled();
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  });

  it("fail-open cuando NEXT_PUBLIC_SUPABASE_URL no está configurada", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    const result = await checkAiRateLimit("u1", "ai-evidence");
    expect(result.allowed).toBe(true);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  });

  it("allowed=true cuando hits <= maxPerHour (3 default)", async () => {
    rpcMock.mockResolvedValue({ data: 2, error: null });
    const result = await checkAiRateLimit("u1", "ai-evidence");
    expect(result.allowed).toBe(true);
    expect(result.retryAfterSeconds).toBeUndefined();
  });

  it("allowed=true cuando hits === maxPerHour (boundary)", async () => {
    rpcMock.mockResolvedValue({ data: 3, error: null });
    const result = await checkAiRateLimit("u1", "ai-evidence");
    expect(result.allowed).toBe(true);
  });

  it("allowed=false + retryAfterSeconds cuando hits > maxPerHour", async () => {
    rpcMock.mockResolvedValue({ data: 4, error: null });
    const result = await checkAiRateLimit("u1", "ai-evidence");
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(3600);
  });

  it("maxPerHour configurable: 10 → allowed con 5 hits", async () => {
    rpcMock.mockResolvedValue({ data: 5, error: null });
    const result = await checkAiRateLimit("u1", "ai-evidence", 10);
    expect(result.allowed).toBe(true);
  });

  it("maxPerHour=10 → denied con 11 hits", async () => {
    rpcMock.mockResolvedValue({ data: 11, error: null });
    const result = await checkAiRateLimit("u1", "ai-evidence", 10);
    expect(result.allowed).toBe(false);
  });

  it("fail-open cuando RPC tira error", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "function not found" } });
    const result = await checkAiRateLimit("u1", "ai-evidence");
    expect(result.allowed).toBe(true);
  });

  it("rate-limit key incluye endpoint + userId", async () => {
    rpcMock.mockResolvedValue({ data: 1, error: null });
    await checkAiRateLimit("user-xyz", "ai-reports");
    expect(rpcMock).toHaveBeenCalledWith("increment_api_rate_limit", expect.objectContaining({
      p_key: "ai-limit:ai-reports:user-xyz",
    }));
  });

  it("p_window_start es ISO timestamp rounded a la hora", async () => {
    rpcMock.mockResolvedValue({ data: 1, error: null });
    await checkAiRateLimit("u1", "ai-evidence");
    const call = rpcMock.mock.calls[0][1] as { p_window_start: string };
    expect(call.p_window_start).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:00:00\.000Z$/);
  });

  it("fail-open cuando createClient tira (unexpected exception)", async () => {
    createClientMock.mockImplementation(() => { throw new Error("client init crashed"); });
    const result = await checkAiRateLimit("u1", "ai-evidence");
    expect(result.allowed).toBe(true);
  });

  it("hits=0 (RPC returned non-number) treats as 0 → allowed", async () => {
    rpcMock.mockResolvedValue({ data: "not-a-number", error: null });
    const result = await checkAiRateLimit("u1", "ai-evidence");
    expect(result.allowed).toBe(true);
  });
});
