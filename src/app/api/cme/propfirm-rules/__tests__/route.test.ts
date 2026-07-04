// Test para GET /api/cme/propfirm-rules — cubre puntualmente el campo
// providerRecognized agregado para el bug #10 del review (provider_name
// legacy no reconocido → sin enforcement propfirm, antes invisible).

import { describe, it, expect, vi, beforeAll } from "vitest";
import { NextRequest } from "next/server";

const { getUserMock, fromMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
  }),
}));

let GET: (req: NextRequest) => Promise<Response>;
beforeAll(async () => {
  const mod = await import("../route");
  GET = mod.GET;
});

function chain(result: { data?: unknown; error?: unknown }) {
  const proxy: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in", "gte", "lte", "order", "limit"]) {
    proxy[m] = () => proxy;
  }
  proxy.maybeSingle = async () => result;
  proxy.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return proxy;
}

function makeRequest(cmeAccountId = "acc-1"): NextRequest {
  return new NextRequest(`http://localhost/api/cme/propfirm-rules?cmeAccountId=${cmeAccountId}`);
}

describe("GET /api/cme/propfirm-rules — providerRecognized", () => {
  beforeAll(() => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
  });

  it("provider reconocido (Apex) → providerRecognized:true", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "algo_cme_accounts") {
        return chain({ data: { provider_name: "Apex", funded_amount: 50000, label: "Acc 1" }, error: null });
      }
      if (table === "terminal_events") return chain({ data: [], error: null });
      throw new Error(`unexpected table ${table}`);
    });
    const res = await GET(makeRequest());
    const json = await res.json();
    expect(json.providerRecognized).toBe(true);
    expect(json.rule).not.toBeNull();
  });

  it("provider legacy no reconocido (TopstepX) → providerRecognized:false, rule:null", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "algo_cme_accounts") {
        return chain({ data: { provider_name: "TopstepX", funded_amount: 50000, label: "Acc 2" }, error: null });
      }
      if (table === "terminal_events") return chain({ data: [], error: null });
      throw new Error(`unexpected table ${table}`);
    });
    const res = await GET(makeRequest());
    const json = await res.json();
    expect(json.providerRecognized).toBe(false);
    expect(json.rule).toBeNull();
  });

  it("sin provider_name (cuenta no-propfirm) → providerRecognized:true (no es un gap, es esperado)", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "algo_cme_accounts") {
        return chain({ data: { provider_name: null, funded_amount: null, label: "Acc 3" }, error: null });
      }
      if (table === "terminal_events") return chain({ data: [], error: null });
      throw new Error(`unexpected table ${table}`);
    });
    const res = await GET(makeRequest());
    const json = await res.json();
    expect(json.providerRecognized).toBe(true);
    expect(json.rule).toBeNull();
  });
});
