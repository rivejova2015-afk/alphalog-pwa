import { describe, it, expect, vi, afterEach, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import { getPgClient } from "@/lib/pg/client";

const TEST_USER_ID = "304a1a34-36a9-4a75-ae52-3023409932f0";

const { getUserMock } = vi.hoisted(() => ({ getUserMock: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: getUserMock } }),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let POST: any;
beforeAll(async () => {
  const mod = await import("../route");
  POST = mod.POST;
});

describe("POST /api/intelligence/algorithms/cme-accounts — integración con Postgres real", () => {
  let createdId: string | undefined;

  afterEach(async () => {
    if (!createdId) return;
    const pg = getPgClient();
    await pg.from("algo_cme_accounts").delete().eq("id", createdId);
    createdId = undefined;
  });

  it("crea una cuenta propfirm real en Postgres", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: TEST_USER_ID } } });

    const req = new NextRequest("http://localhost/api/intelligence/algorithms/cme-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        account_type: "propfirm",
        provider_name: "MyFundedFutures",
        account_number: "TEST-CREATE-ROUTE",
        label: "MFFU Eval",
        funded_amount: 150000,
        max_daily_loss: 1500,
        is_paper: true,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.provider_name).toBe("MyFundedFutures");
    createdId = body.data.id;

    const pg = getPgClient();
    const { data: rows } = await pg
      .from("algo_cme_accounts")
      .select("*")
      .eq("id", createdId as string);
    expect((rows as unknown[]).length).toBe(1);
    expect((rows as { user_id: string }[])[0].user_id).toBe(TEST_USER_ID);
  });

  it("rechaza sin autenticación", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const req = new NextRequest("http://localhost/api/intelligence/algorithms/cme-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account_type: "broker", provider_name: "IBKR", account_number: "X" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("rechaza payload inválido (account_number vacío)", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: TEST_USER_ID } } });
    const req = new NextRequest("http://localhost/api/intelligence/algorithms/cme-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account_type: "broker", provider_name: "IBKR", account_number: "" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
