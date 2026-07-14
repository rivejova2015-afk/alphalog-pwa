import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getPgClient } from "../client";

describe("QueryBuilder — nuevos métodos CME", () => {
  it("upsert() genera INSERT ... ON CONFLICT DO UPDATE", async () => {
    const pg = getPgClient();
    const { error } = await pg
      .from("cme_risk_configs")
      .upsert(
        { user_id: "304a1a34-36a9-4a75-ae52-3023409932f0", cme_account_id: "00000000-0000-0000-0000-000000000000", circuit_breaker_pct: 80 },
        { onConflict: "user_id,cme_account_id" }
      );
    // No aserta contra datos reales — solo que la query se construye y ejecuta sin tirar.
    expect(error).toBeNull();
  });

  it("delete() borra filas filtradas por eq()", async () => {
    const pg = getPgClient();
    const { error } = await pg.from("cme_positions").delete().eq("user_id", "no-such-user");
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
