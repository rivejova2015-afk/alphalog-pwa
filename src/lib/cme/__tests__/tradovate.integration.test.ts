// A diferencia de dispatchers/index.test.ts (que mockea el cliente por
// completo), este test corre contra el Postgres real de lattice-server —
// detecta errores de sintaxis SQL que un mock nunca puede atrapar
// (Ajuste #15).
//
// `pg` (getPgClient()'s return value) se pasa directo a dispatchSignal sin
// cast: DispatchDbClient (src/lib/engine/dispatchers/types.ts) es la
// interfaz estructural mínima que satisfacen tanto un SupabaseClient real
// como el shim de Postgres, precisamente para que este tipo de test no
// necesite un `as never`/`as unknown as X`.
import { describe, it, expect, afterEach } from "vitest";
import { getPgClient } from "@/lib/pg/client";
import { dispatchSignal } from "@/lib/engine/dispatchers";

describe("dispatchTradovate — integración con Postgres real", () => {
  const testUserId = "304a1a34-36a9-4a75-ae52-3023409932f0";
  let testAccountId: string | undefined;
  let testAlgorithmId: string | undefined;

  afterEach(async () => {
    const pg = getPgClient();
    if (testAccountId) {
      await pg.from("cme_signals").delete().eq("cme_account_id", testAccountId);
      await pg.from("algo_cme_accounts").delete().eq("id", testAccountId);
      testAccountId = undefined;
    }
    if (testAlgorithmId) {
      await pg.from("algorithms").delete().eq("id", testAlgorithmId);
      testAlgorithmId = undefined;
    }
  });

  it("shadow mode: inserta en cme_signals contra la base real", async () => {
    const pg = getPgClient();
    const { data: acct, error: acctErr } = await pg
      .from("algo_cme_accounts")
      .insert({
        user_id: testUserId,
        account_type: "propfirm",
        provider_name: "Apex",
        account_number: "TEST-DISPATCH-INTEGRATION",
        is_paper: true,
      })
      .single();
    expect(acctErr).toBeNull();
    testAccountId = (acct as { id: string }).id;

    // cme_signals.algorithm_id tiene FK a public.algorithms(id) — necesita una
    // fila real, no un id inventado (la propia migración de este plan movió
    // `algorithms` al Postgres self-hosted junto con las tablas CME).
    const { data: algorithm, error: algoErr } = await pg
      .from("algorithms")
      .insert({
        user_id: testUserId,
        name: "TEST-DISPATCH-INTEGRATION-ALGO",
      })
      .single();
    expect(algoErr).toBeNull();
    testAlgorithmId = (algorithm as { id: string }).id;

    process.env.DISPATCH_MODE = "shadow";
    const result = await dispatchSignal(
      {
        algo: {
          id: testAlgorithmId,
          user_id: testUserId,
          platform: "Tradovate",
          parameters: { cme_account_id: testAccountId, contract: "ESH4" },
        },
        signal: { action: "BUY", lots: 1, confidence: 0.7, reason: "integration_test" },
        currentBarTs: new Date().toISOString(),
      },
      pg,
    );

    expect(result.ok).toBe(true);
    expect(result.action).toBe("shadow_logged");

    const { data: signals } = await pg
      .from("cme_signals")
      .select("*")
      .eq("cme_account_id", testAccountId);
    expect((signals as unknown[]).length).toBe(1);
  });
});
