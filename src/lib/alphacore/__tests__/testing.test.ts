import { describe, it, expect } from "vitest";
import {
  generateTestJournalEntry,
  generateTestAccount,
  assert,
  assertEqual,
  assertMutationSuccess,
  assertMutationFailure,
  assertMutationStatus,
  assertDefined,
  assertIncludes,
} from "../testing";

// Test fixtures cast loosely to bypass MutationResponse strict typing.
// We only exercise the assertion logic which inspects `.status`/`.error`/`.data`.
type Loose = Parameters<typeof assertMutationStatus>[0];

describe("generateTestJournalEntry", () => {
  it("retorna entry con todos los campos requeridos", () => {
    const e = generateTestJournalEntry();
    expect(e.id).toBeDefined();
    expect(e.user_id).toMatch(/^test-user-/);
    expect(e.mood).toBe("neutral");
    expect(e.tags).toEqual(["test"]);
    expect(e.version).toBe(1);
    expect(e.fingerprint).toMatch(/^test-fp-/);
    expect(e.deleted_at).toBeNull();
  });

  it("overrides reemplazan defaults", () => {
    const e = generateTestJournalEntry({ mood: "great", custom: "field" });
    expect(e.mood).toBe("great");
    expect(e.custom).toBe("field");
  });

  it("ids únicos en llamadas consecutivas", () => {
    const a = generateTestJournalEntry();
    const b = generateTestJournalEntry();
    expect(a.id).not.toBe(b.id);
  });
});

describe("generateTestAccount", () => {
  it("retorna account con todos los campos requeridos", () => {
    const a = generateTestAccount();
    expect(a.id).toBeDefined();
    expect(a.name).toMatch(/^Test Account /);
    expect(a.type).toBe("trading");
    expect(a.balance).toBe(10000);
    expect(a.currency).toBe("USD");
    expect(a.is_active).toBe(true);
  });

  it("account_number siempre empieza con 'TEST'", () => {
    const a = generateTestAccount();
    expect(a.account_number).toMatch(/^TEST/);
  });

  it("overrides custom", () => {
    const a = generateTestAccount({ balance: 99, currency: "EUR" });
    expect(a.balance).toBe(99);
    expect(a.currency).toBe("EUR");
  });
});

describe("assert / assertEqual / assertDefined / assertIncludes", () => {
  it("assert passes con condition=true", () => {
    expect(() => assert(true, "should pass")).not.toThrow();
  });

  it("assert throws con condition=false + mensaje", () => {
    expect(() => assert(false, "bad state")).toThrow("Assertion failed: bad state");
  });

  it("assertEqual passes con valores iguales", () => {
    expect(() => assertEqual(1, 1)).not.toThrow();
    expect(() => assertEqual("a", "a")).not.toThrow();
  });

  it("assertEqual throws con valores distintos", () => {
    expect(() => assertEqual(1, 2)).toThrow(/Expected 2, got 1/);
    expect(() => assertEqual(1, 2, "custom msg")).toThrow("custom msg");
  });

  it("assertDefined passes con valor presente", () => {
    expect(() => assertDefined("value", "should exist")).not.toThrow();
    expect(() => assertDefined(0, "should exist")).not.toThrow();
    expect(() => assertDefined(false, "should exist")).not.toThrow();
  });

  it("assertDefined throws con null/undefined", () => {
    expect(() => assertDefined(null, "x")).toThrow(/Assertion failed.*x/);
    expect(() => assertDefined(undefined, "y")).toThrow(/Assertion failed.*y/);
  });

  it("assertIncludes passes cuando array contiene", () => {
    expect(() => assertIncludes([1, 2, 3], 2)).not.toThrow();
    expect(() => assertIncludes(["a", "b"], "a")).not.toThrow();
  });

  it("assertIncludes throws cuando array no contiene", () => {
    expect(() => assertIncludes([1, 2], 99)).toThrow(/include/);
    expect(() => assertIncludes([1, 2], 99, "custom err")).toThrow("custom err");
  });
});

describe("assertMutationSuccess / Failure / Status", () => {
  function loose(payload: Record<string, unknown>): Loose {
    return payload as unknown as Loose;
  }

  it("Success passes con data + no error", () => {
    const r = loose({ data: { id: "x" }, status: "synced", mutationId: "m1" });
    expect(() => assertMutationSuccess(r)).not.toThrow();
  });

  it("Success throws cuando hay error", () => {
    const r = loose({ status: "failed", error: { code: "23505", message: "dup" }, mutationId: "m1" });
    expect(() => assertMutationSuccess(r)).toThrow(/Mutation failed: 23505/);
  });

  it("Success throws cuando no hay data", () => {
    const r = loose({ status: "synced", mutationId: "m1" });
    expect(() => assertMutationSuccess(r)).toThrow(/No data returned/);
  });

  it("Failure passes cuando código error matches", () => {
    const r = loose({ status: "failed", error: { code: "23505", message: "dup" }, mutationId: "m1" });
    expect(() => assertMutationFailure(r, "23505")).not.toThrow();
  });

  it("Failure throws cuando esperabamos fallo pero no hubo", () => {
    const r = loose({ data: {}, status: "synced", mutationId: "m1" });
    expect(() => assertMutationFailure(r, "23505")).toThrow(/Expected mutation to fail/);
  });

  it("Failure throws cuando código no matches", () => {
    const r = loose({ status: "failed", error: { code: "23503", message: "fk" }, mutationId: "m1" });
    expect(() => assertMutationFailure(r, "23505")).toThrow(/Expected error code 23505, got 23503/);
  });

  it("Status passes cuando coincide", () => {
    const r = loose({ data: {}, status: "synced", mutationId: "m1" });
    expect(() => assertMutationStatus(r, "synced")).not.toThrow();
  });

  it("Status throws cuando no coincide", () => {
    const r = loose({ data: {}, status: "pending", mutationId: "m1" });
    expect(() => assertMutationStatus(r, "synced")).toThrow(/Expected status synced, got pending/);
  });
});
