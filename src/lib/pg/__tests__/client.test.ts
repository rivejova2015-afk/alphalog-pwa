import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getPgClient } from "../client";

const TEST_USER_ID = "304a1a34-36a9-4a75-ae52-3023409932f0";
// UUID válido (formato correcto) pero que no existe en ninguna tabla — para
// probar filtros/deletes sin depender de datos reales.
const NONEXISTENT_UUID = "00000000-0000-0000-0000-000000000001";

describe("QueryBuilder — nuevos métodos CME", () => {
  let testAccountId: string;

  beforeAll(async () => {
    const pg = getPgClient();
    const { data } = await pg
      .from("algo_cme_accounts")
      .insert({
        user_id: TEST_USER_ID,
        account_type: "propfirm",
        provider_name: "Apex",
        account_number: "TEST-SHIM-METHODS",
        is_paper: true,
      })
      .single();
    testAccountId = (data as { id: string }).id;
  });

  afterAll(async () => {
    if (!testAccountId) return;
    const pg = getPgClient();
    await pg.from("cme_risk_configs").delete().eq("cme_account_id", testAccountId);
    await pg.from("algo_cme_accounts").delete().eq("id", testAccountId);
  });

  it("upsert() genera INSERT ... ON CONFLICT DO UPDATE", async () => {
    const pg = getPgClient();
    const { error } = await pg
      .from("cme_risk_configs")
      .upsert(
        { user_id: TEST_USER_ID, cme_account_id: testAccountId, circuit_breaker_pct: 80 },
        { onConflict: "user_id,cme_account_id" }
      );
    expect(error).toBeNull();

    // Segunda llamada con el mismo (user_id, cme_account_id) debe actualizar,
    // no duplicar — confirma que el ON CONFLICT realmente funciona.
    const { error: error2 } = await pg
      .from("cme_risk_configs")
      .upsert(
        { user_id: TEST_USER_ID, cme_account_id: testAccountId, circuit_breaker_pct: 50 },
        { onConflict: "user_id,cme_account_id" }
      );
    expect(error2).toBeNull();

    const { data: rows } = await pg.from("cme_risk_configs").select("*").eq("cme_account_id", testAccountId);
    expect((rows as unknown[]).length).toBe(1);
    expect((rows as { circuit_breaker_pct: string }[])[0].circuit_breaker_pct).toBe("50");
  });

  it("delete() borra filas filtradas por eq()", async () => {
    const pg = getPgClient();
    const { error } = await pg.from("cme_positions").delete().eq("user_id", NONEXISTENT_UUID);
    expect(error).toBeNull();
  });

  it("gt() agrega una condición WHERE col > val", async () => {
    const pg = getPgClient();
    const { data, error } = await pg
      .from("cme_signals")
      .select("id")
      .eq("status", "pending")
      .gt("expires_at", new Date(0).toISOString());
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });
});

describe("QueryBuilder — range() + select(cols, { count: 'exact' })", () => {
  // 5 filas de prueba para paginar en páginas de 2 (última página parcial de 1).
  const ACCOUNT_NUMBERS = Array.from({ length: 5 }, (_, i) => `TEST-PAGINATION-${i}`);

  beforeAll(async () => {
    const pg = getPgClient();
    // Limpieza defensiva: si una corrida anterior falló antes de su afterAll,
    // no debe quedar basura contaminando el conteo de esta corrida.
    await pg.from("algo_cme_accounts").delete().eq("user_id", TEST_USER_ID);

    for (const accountNumber of ACCOUNT_NUMBERS) {
      const { error } = await pg.from("algo_cme_accounts").insert({
        user_id: TEST_USER_ID,
        account_type: "propfirm",
        provider_name: "Apex",
        account_number: accountNumber,
        is_paper: true,
      });
      if (error) throw new Error(error.message);
    }
  });

  afterAll(async () => {
    const pg = getPgClient();
    await pg.from("algo_cme_accounts").delete().eq("user_id", TEST_USER_ID);
  });

  it("devuelve la página correcta y el count total a través de 3 páginas", async () => {
    const pg = getPgClient();

    const page1 = await pg
      .from("algo_cme_accounts")
      .select("*", { count: "exact" })
      .eq("user_id", TEST_USER_ID)
      .order("account_number", { ascending: true })
      .range(0, 1);
    expect(page1.error).toBeNull();
    expect(page1.count).toBe(5);
    expect((page1.data as { account_number: string }[]).map((r) => r.account_number)).toEqual([
      "TEST-PAGINATION-0",
      "TEST-PAGINATION-1",
    ]);

    const page2 = await pg
      .from("algo_cme_accounts")
      .select("*", { count: "exact" })
      .eq("user_id", TEST_USER_ID)
      .order("account_number", { ascending: true })
      .range(2, 3);
    expect(page2.error).toBeNull();
    expect(page2.count).toBe(5);
    expect((page2.data as { account_number: string }[]).map((r) => r.account_number)).toEqual([
      "TEST-PAGINATION-2",
      "TEST-PAGINATION-3",
    ]);

    // Última página: parcial (1 fila), pero el count total sigue siendo 5.
    const page3 = await pg
      .from("algo_cme_accounts")
      .select("*", { count: "exact" })
      .eq("user_id", TEST_USER_ID)
      .order("account_number", { ascending: true })
      .range(4, 5);
    expect(page3.error).toBeNull();
    expect(page3.count).toBe(5);
    expect((page3.data as { account_number: string }[]).map((r) => r.account_number)).toEqual([
      "TEST-PAGINATION-4",
    ]);
  });
});
