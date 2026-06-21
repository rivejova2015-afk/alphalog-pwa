// Integration tests for GET /api/intelligence/capital-targets.
//
// Covers:
//   1. 401 cuando auth falla.
//   2. Success: returns array (raw) + Cache-Control header.
//   3. Empty array cuando data null.
//   4. Missing-schema error (42P01 / 42703 / "does not exist") → returns [] (no 500).
//   5. Other supabase error → 500 + logError.
//   6. Catch exception → 500 + recordBugFromRequest.

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { getUserMock, fromMock, recordBugMock } = vi.hoisted(() => ({
  getUserMock:   vi.fn(),
  fromMock:      vi.fn(),
  recordBugMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
  }),
}));
vi.mock("@/lib/security/bugRecorder", () => ({
  recordBugFromRequest: recordBugMock,
}));
vi.mock("@/lib/log", () => ({
  logError: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn(),
}));

let GET: (req: NextRequest) => Promise<Response>;
beforeAll(async () => {
  const mod = await import("../route");
  GET = mod.GET;
});

function makeSelectChain(result: { data?: unknown; error?: unknown }) {
  const proxy: Record<string, unknown> = {};
  const methods = ["select", "eq", "is", "order"];
  for (const m of methods) proxy[m] = vi.fn(() => proxy);
  proxy.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return proxy;
}

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/intelligence/capital-targets");
}

function authedUser(id = "u-1") {
  getUserMock.mockResolvedValue({ data: { user: { id } }, error: null });
}
function unauthed() {
  getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "no session" } });
}

describe("GET /api/intelligence/capital-targets", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    fromMock.mockReset();
    recordBugMock.mockReset();
  });

  it("401 cuando auth falla", async () => {
    unauthed();
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("Success: returns array (raw) + Cache-Control", async () => {
    authedUser();
    const rows = [
      {
        id: "t-1", account_type: "real", target_name: "Build $100k",
        target_capital: 100000, capital_account_id: null,
        manual_monthly_pct: 5, manual_quarterly_pct: null,
        manual_semiannual_pct: null, manual_annual_pct: null,
        manual_updated_at: null, custom_current_capital: null,
        custom_current_updated_at: null,
        created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
      },
    ];
    fromMock.mockReturnValue(makeSelectChain({ data: rows, error: null }));

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe("t-1");
    expect(res.headers.get("Cache-Control")).toContain("private");
    expect(res.headers.get("Cache-Control")).toContain("max-age=60");
  });

  it("Empty array cuando data null", async () => {
    authedUser();
    fromMock.mockReturnValue(makeSelectChain({ data: null, error: null }));

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it("Missing-schema error (42P01) → returns [] (no 500)", async () => {
    authedUser();
    fromMock.mockReturnValue(makeSelectChain({
      data: null, error: { code: "42P01", message: "relation does not exist" },
    }));

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it("Missing-schema error (42703 — column does not exist) → returns []", async () => {
    authedUser();
    fromMock.mockReturnValue(makeSelectChain({
      data: null, error: { code: "42703", message: "column does not exist" },
    }));

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it("Missing-schema por message contains 'does not exist' → returns []", async () => {
    authedUser();
    fromMock.mockReturnValue(makeSelectChain({
      data: null, error: { code: "OTHER", message: "table does not exist" },
    }));

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it("Other supabase error → 500 + 'Failed to fetch targets'", async () => {
    authedUser();
    fromMock.mockReturnValue(makeSelectChain({
      data: null, error: { code: "23000", message: "constraint violation" },
    }));

    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to fetch targets");
  });

  it("Catch exception (createClient throws) → 500 + recordBug", async () => {
    getUserMock.mockRejectedValue(new Error("connection refused"));

    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
    expect(recordBugMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: null, status: 500 }),
    );
  });
});
