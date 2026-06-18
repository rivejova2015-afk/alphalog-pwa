// Unit tests for src/lib/api/routeParams.ts.
//
// Pure helpers: resolveRouteParams (Promise-of-params → params) y
// resolveRouteId (extrae .id como string + UUID guard opcional).
//
// Validates:
//   1. resolveRouteParams: params es object directo → resuelve to ese object.
//   2. resolveRouteParams: params es Promise → awaita.
//   3. resolveRouteId: params.id es UUID v4 válido → returns trimmed.
//   4. resolveRouteId: params.id NO es string → null.
//   5. resolveRouteId: params.id missing → null.
//   6. resolveRouteId: params.id es string vacío después de trim → null.
//   7. resolveRouteId: enforceUuid=true (default) rechaza non-UUID → null.
//   8. resolveRouteId: enforceUuid=false acepta cualquier string non-empty.
//   9. resolveRouteId: trim whitespace inicial/final.
//   10. resolveRouteId: UUID es case-insensitive (mayúsculas válidas).

import { describe, it, expect } from "vitest";
import { resolveRouteParams, resolveRouteId } from "../routeParams";

const VALID_UUID = "9c858901-8a57-4791-81c0-0c79c8500abf";
const VALID_UUID_UPPER = "9C858901-8A57-4791-81C0-0C79C8500ABF";

describe("resolveRouteParams", () => {
  it("params es objeto directo → resuelve al mismo object", async () => {
    const params = { id: "x", slug: "y" };
    const result = await resolveRouteParams({ params });
    expect(result).toEqual({ id: "x", slug: "y" });
  });

  it("params es Promise → awaita y resuelve", async () => {
    const params = Promise.resolve({ id: "p1" });
    const result = await resolveRouteParams({ params });
    expect(result).toEqual({ id: "p1" });
  });

  it("params es Promise resuelve con shape parcial", async () => {
    const result = await resolveRouteParams<{ tag?: string }>({
      params: Promise.resolve({ tag: "alpha" }),
    });
    expect(result.tag).toBe("alpha");
  });
});

describe("resolveRouteId", () => {
  it("UUID v4 válido → returns trimmed id", async () => {
    const id = await resolveRouteId({ params: { id: VALID_UUID } });
    expect(id).toBe(VALID_UUID);
  });

  it("UUID con whitespace alrededor → trims", async () => {
    const id = await resolveRouteId({ params: { id: `  ${VALID_UUID}  ` } });
    expect(id).toBe(VALID_UUID);
  });

  it("UUID en mayúsculas → válido (case-insensitive)", async () => {
    const id = await resolveRouteId({ params: { id: VALID_UUID_UPPER } });
    expect(id).toBe(VALID_UUID_UPPER);
  });

  it("params.id es number → null", async () => {
    const id = await resolveRouteId({ params: { id: 42 } });
    expect(id).toBeNull();
  });

  it("params.id es undefined → null", async () => {
    const id = await resolveRouteId({ params: {} });
    expect(id).toBeNull();
  });

  it("params.id es null → null", async () => {
    const id = await resolveRouteId({ params: { id: null } });
    expect(id).toBeNull();
  });

  it("params.id es array → null (no string)", async () => {
    const id = await resolveRouteId({ params: { id: [VALID_UUID] } });
    expect(id).toBeNull();
  });

  it("params.id es string vacío → null", async () => {
    const id = await resolveRouteId({ params: { id: "" } });
    expect(id).toBeNull();
  });

  it("params.id es solo whitespace → null tras trim", async () => {
    const id = await resolveRouteId({ params: { id: "   " } });
    expect(id).toBeNull();
  });

  it("enforceUuid=true (default): non-UUID → null", async () => {
    const id = await resolveRouteId({ params: { id: "not-a-uuid" } });
    expect(id).toBeNull();
  });

  it("enforceUuid=true: numeric string → null", async () => {
    const id = await resolveRouteId({ params: { id: "12345" } });
    expect(id).toBeNull();
  });

  it("enforceUuid=false: acepta cualquier string non-empty", async () => {
    const id = await resolveRouteId(
      { params: { id: "custom-slug-123" } },
      { enforceUuid: false }
    );
    expect(id).toBe("custom-slug-123");
  });

  it("enforceUuid=false: trim + acepta non-UUID", async () => {
    const id = await resolveRouteId(
      { params: { id: "  hello  " } },
      { enforceUuid: false }
    );
    expect(id).toBe("hello");
  });

  it("enforceUuid=false: string vacía tras trim → null (siempre)", async () => {
    const id = await resolveRouteId(
      { params: { id: "  " } },
      { enforceUuid: false }
    );
    expect(id).toBeNull();
  });

  it("UUID v5 (no v4) → null bajo enforceUuid (regex es [1-5] versión)", async () => {
    // Actually [1-5] in the regex matches v1 through v5, so this should pass.
    const v5 = "9c858901-8a57-5791-81c0-0c79c8500abf"; // 5xxx version
    const id = await resolveRouteId({ params: { id: v5 } });
    expect(id).toBe(v5);
  });

  it("UUID v6 → null (regex solo permite [1-5])", async () => {
    const v6 = "9c858901-8a57-6791-81c0-0c79c8500abf";
    const id = await resolveRouteId({ params: { id: v6 } });
    expect(id).toBeNull();
  });

  it("UUID con variant inválido → null (no en [89ab])", async () => {
    // Variant byte must be 8|9|a|b for v4 RFC compliance.
    const badVariant = "9c858901-8a57-4791-c1c0-0c79c8500abf"; // 'c' is invalid
    const id = await resolveRouteId({ params: { id: badVariant } });
    expect(id).toBeNull();
  });

  it("params como Promise: awaits y extrae id", async () => {
    const id = await resolveRouteId({
      params: Promise.resolve({ id: VALID_UUID }),
    });
    expect(id).toBe(VALID_UUID);
  });
});
