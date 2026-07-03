import { describe, it, expect, beforeEach } from "vitest";
import { buildSlicePlan, insertExecutionSlices, finalizeParentIfDone } from "../execution-slices";

describe("buildSlicePlan", () => {
  it("selecciona planTwap por default", () => {
    const plan = buildSlicePlan({ algo: "twap", totalQuantity: 10, durationMinutes: 20, sliceCount: 5 });
    expect(plan.algo).toBe("twap");
    expect(plan.slices.reduce((s, sl) => s + sl.quantity, 0)).toBe(10);
  });

  it("selecciona planVwap con volumeProfile", () => {
    const plan = buildSlicePlan({
      algo: "vwap",
      totalQuantity: 10,
      durationMinutes: 20,
      sliceCount: 5,
      volumeProfile: [4, 1, 1, 1, 3],
    });
    expect(plan.algo).toBe("vwap");
    expect(plan.slices.map((s) => s.quantity)).toEqual([4, 1, 1, 1, 3]);
  });

  it("vwap sin volumeProfile cae a TWAP internamente (planVwap lo maneja)", () => {
    const plan = buildSlicePlan({ algo: "vwap", totalQuantity: 10, durationMinutes: 20, sliceCount: 5 });
    expect(plan.slices.map((s) => s.quantity)).toEqual([2, 2, 2, 2, 2]);
  });

  it("selecciona planIs con urgency", () => {
    const plan = buildSlicePlan({ algo: "is", totalQuantity: 10, durationMinutes: 20, sliceCount: 5, urgency: 1 });
    expect(plan.algo).toBe("is");
    expect(plan.slices[0].quantity).toBeGreaterThanOrEqual(plan.slices[plan.slices.length - 1].quantity);
  });
});

// Mock mínimo de supabase-js encadenable, similar al patrón de risk-manager.test.ts.
type InsertedRow = Record<string, unknown>;

function makeMockSupabase(opts: {
  parentInsertResult?: { data: { id: string } | null; error: { message: string } | null };
  childInsertResult?: { data: InsertedRow[] | null; error: { message: string } | null };
  siblingsResult?: { data: { status: string }[] | null };
}) {
  const updateCalls: Array<{ table: string; payload: Record<string, unknown> }> = [];
  const insertCalls: Array<{ table: string; payload: unknown }> = [];

  const mock = {
    from(table: string) {
      return {
        insert(payload: unknown) {
          insertCalls.push({ table, payload });
          const isArray = Array.isArray(payload);
          return {
            select: () => ({
              single: async () => opts.parentInsertResult ?? { data: { id: "parent-1" }, error: null },
              order: () => ({
                then: (resolve: (v: unknown) => unknown) =>
                  resolve(
                    opts.childInsertResult ?? {
                      data: isArray
                        ? (payload as InsertedRow[]).map((row, i) => ({
                            id: `slice-${i}`,
                            slice_index: i,
                            quantity: row.quantity,
                          }))
                        : [],
                      error: null,
                    },
                  ),
              }),
            }),
          };
        },
        update(payload: Record<string, unknown>) {
          updateCalls.push({ table, payload });
          return { eq: async () => ({ error: null }) };
        },
        select() {
          return {
            eq: async () => opts.siblingsResult ?? { data: [], error: null },
          };
        },
      };
    },
  };

  return { mock, updateCalls, insertCalls };
}

describe("insertExecutionSlices", () => {
  it("throws si el plan no tiene slices", async () => {
    const { mock } = makeMockSupabase({});
    await expect(
      insertExecutionSlices(mock as never, {
        userId: "u1",
        cmeAccountId: "acc1",
        contract: "MESU6",
        direction: "BUY",
        stopLossTicks: 20,
        takeProfitTicks: 40,
        plan: { algo: "twap", totalQuantity: 5, totalSlices: 0, durationMinutes: 10, slices: [] },
      }),
    ).rejects.toThrow("zero slices");
  });

  it("inserta padre + N hijas y devuelve la primera slice", async () => {
    const { mock, insertCalls } = makeMockSupabase({});
    const plan = {
      algo: "twap" as const,
      totalQuantity: 10,
      totalSlices: 5,
      durationMinutes: 20,
      slices: [
        { scheduledAt: "2026-07-03T20:00:00.000Z", quantity: 2, sliceIndex: 0 },
        { scheduledAt: "2026-07-03T20:05:00.000Z", quantity: 2, sliceIndex: 1 },
        { scheduledAt: "2026-07-03T20:10:00.000Z", quantity: 2, sliceIndex: 2 },
        { scheduledAt: "2026-07-03T20:15:00.000Z", quantity: 2, sliceIndex: 3 },
        { scheduledAt: "2026-07-03T20:20:00.000Z", quantity: 2, sliceIndex: 4 },
      ],
    };
    const result = await insertExecutionSlices(mock as never, {
      userId: "u1",
      algorithmId: "algo1",
      cmeAccountId: "acc1",
      contract: "MESU6",
      direction: "BUY",
      stopLossTicks: 20,
      takeProfitTicks: 40,
      plan,
    });

    expect(result.parentSignalId).toBe("parent-1");
    expect(result.firstSlice).toEqual({ id: "slice-0", quantity: 2 });
    expect(result.remainingCount).toBe(4);

    // Parent insert: status='executing', quantity=total.
    const parentInsert = insertCalls.find((c) => !Array.isArray(c.payload));
    expect((parentInsert?.payload as Record<string, unknown>).status).toBe("executing");
    expect((parentInsert?.payload as Record<string, unknown>).quantity).toBe(10);

    // Children insert: array of 5 rows, each with parent_signal_id + scheduled_at + expires_at.
    const childInsert = insertCalls.find((c) => Array.isArray(c.payload));
    const childRows = childInsert?.payload as InsertedRow[];
    expect(childRows).toHaveLength(5);
    expect(childRows[0].parent_signal_id).toBe("parent-1");
    expect(childRows[0].status).toBe("pending");
    expect(childRows[0].scheduled_at).toBe("2026-07-03T20:00:00.000Z");
    // expires_at = scheduled_at + 2min grace window.
    expect(childRows[0].expires_at).toBe("2026-07-03T20:02:00.000Z");
  });

  it("throws si el insert del padre falla", async () => {
    const { mock } = makeMockSupabase({
      parentInsertResult: { data: null, error: { message: "db error" } },
    });
    await expect(
      insertExecutionSlices(mock as never, {
        userId: "u1",
        cmeAccountId: "acc1",
        contract: "MESU6",
        direction: "BUY",
        stopLossTicks: 20,
        takeProfitTicks: 40,
        plan: {
          algo: "twap",
          totalQuantity: 5,
          totalSlices: 1,
          durationMinutes: 10,
          slices: [{ scheduledAt: "2026-07-03T20:00:00.000Z", quantity: 5, sliceIndex: 0 }],
        },
      }),
    ).rejects.toThrow("could not insert parent signal");
  });
});

describe("finalizeParentIfDone", () => {
  let updateCalls: Array<{ table: string; payload: Record<string, unknown> }>;

  beforeEach(() => {
    updateCalls = [];
  });

  it("no-op si hay siblings todavía pending", async () => {
    const { mock, updateCalls: calls } = makeMockSupabase({
      siblingsResult: { data: [{ status: "executed" }, { status: "pending" }] },
    });
    updateCalls = calls;
    await finalizeParentIfDone(mock as never, "parent-1");
    expect(updateCalls).toHaveLength(0);
  });

  it("no-op si no hay siblings (parent_signal_id sin filas)", async () => {
    const { mock, updateCalls: calls } = makeMockSupabase({ siblingsResult: { data: [] } });
    updateCalls = calls;
    await finalizeParentIfDone(mock as never, "parent-1");
    expect(updateCalls).toHaveLength(0);
  });

  it("marca 'executed' si al menos una slice se ejecutó y el resto es terminal", async () => {
    const { mock, updateCalls: calls } = makeMockSupabase({
      siblingsResult: { data: [{ status: "executed" }, { status: "rejected" }, { status: "executed" }] },
    });
    updateCalls = calls;
    await finalizeParentIfDone(mock as never, "parent-1");
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].payload.status).toBe("executed");
  });

  it("marca 'rejected' si todas las slices fueron rejected/skipped", async () => {
    const { mock, updateCalls: calls } = makeMockSupabase({
      siblingsResult: { data: [{ status: "rejected" }, { status: "skipped" }] },
    });
    updateCalls = calls;
    await finalizeParentIfDone(mock as never, "parent-1");
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].payload.status).toBe("rejected");
    expect(updateCalls[0].payload.reject_reason).toBe("all_slices_rejected");
  });

  it("no-op si hay siblings en status 'executing' (plan aún en curso)", async () => {
    const { mock, updateCalls: calls } = makeMockSupabase({
      siblingsResult: { data: [{ status: "executing" }, { status: "executed" }] },
    });
    updateCalls = calls;
    await finalizeParentIfDone(mock as never, "parent-1");
    expect(updateCalls).toHaveLength(0);
  });
});
