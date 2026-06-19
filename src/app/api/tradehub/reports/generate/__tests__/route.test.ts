// Regression test for /api/tradehub/reports/generate POST handler.
//
// SECURITY (audit 2026-06, Área 6 — SSRF): the push-notify fetch must target
// the app's own configured URL (NEXT_PUBLIC_APP_URL), NEVER the attacker-
// controllable `Origin` request header. Sending it to `Origin` would leak
// INTERNAL_API_SECRET to an arbitrary host (SSRF + secret exfiltration).
//
// This test sends a malicious Origin and asserts the push goes to the
// configured host instead.

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { getUserMock, fromMock, rateLimitMock, encryptMock, decryptMock } = vi.hoisted(() => ({
  getUserMock:   vi.fn(),
  fromMock:      vi.fn(),
  rateLimitMock: vi.fn(),
  encryptMock:   vi.fn(),
  decryptMock:   vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
  }),
}));
vi.mock("@/lib/security/aiRateLimit", () => ({
  checkAiRateLimit: rateLimitMock,
}));
vi.mock("@/lib/security/encryption", () => ({
  encryptText: encryptMock,
  decryptText: decryptMock,
}));
vi.mock("@/lib/log", () => ({
  logError: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn(),
}));

let POST: (req: NextRequest) => Promise<Response>;
beforeAll(async () => {
  POST = (await import("../route")).POST;
});

// Universal Supabase query-chain stub: every builder method returns the proxy;
// maybeSingle()/single() and await (then) resolve to the configured result.
function makeChain(result: { data?: unknown; error?: unknown }) {
  const p: Record<string, unknown> = {};
  for (const m of ["select", "eq", "not", "gte", "lte", "order", "is", "insert"]) {
    p[m] = () => p;
  }
  p.maybeSingle = () => Promise.resolve(result);
  p.single = () => Promise.resolve(result);
  p.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return p;
}

describe("POST /api/tradehub/reports/generate — push target hardening (SSRF)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getUserMock.mockReset();
    fromMock.mockReset();
    rateLimitMock.mockReset();
    encryptMock.mockReset();
    decryptMock.mockReset();

    process.env.NEXT_PUBLIC_APP_URL = "https://test.alphalog.io";
    process.env.INTERNAL_API_SECRET = "internal-secret";

    getUserMock.mockResolvedValue({ data: { user: { id: "u-1" } }, error: null });
    rateLimitMock.mockResolvedValue({ allowed: true });
    encryptMock.mockReturnValue("enc:v1:fake");
    decryptMock.mockReturnValue("# report");

    fromMock
      .mockReturnValueOnce(makeChain({ data: null, error: null }))                 // existing weekly_report → none
      .mockReturnValueOnce(makeChain({ data: [], error: null }))                   // trades → empty
      .mockReturnValueOnce(makeChain({ data: { id: "r-1", content_md: "enc:v1:fake" }, error: null })); // insert

    fetchMock = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  function makeRequest(origin: string): NextRequest {
    return new NextRequest("http://localhost/api/tradehub/reports/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", origin },
    });
  }

  it("sends push to NEXT_PUBLIC_APP_URL, never the Origin header", async () => {
    const res = await POST(makeRequest("https://evil.tld"));

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const calledUrl = String(fetchMock.mock.calls[0][0]);
    expect(calledUrl).toBe("https://test.alphalog.io/api/push/notify-user");
    expect(calledUrl).not.toContain("evil.tld");
  });

  it("does not leak INTERNAL_API_SECRET to an attacker-controlled host", async () => {
    await POST(makeRequest("http://169.254.169.254"));

    const calledUrl = String(fetchMock.mock.calls[0][0]);
    // The bearer secret is attached to this request — it must only ever go to our own origin.
    expect(calledUrl.startsWith("https://test.alphalog.io/")).toBe(true);
  });
});
