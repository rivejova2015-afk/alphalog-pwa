import { describe, it, expect } from "vitest";
import { requireOwnership } from "../ownership";

describe("requireOwnership", () => {
  it("devuelve la fila si user_id coincide", () => {
    const row = { id: "a", user_id: "u1", label: "x" };
    expect(requireOwnership(row, "u1")).toEqual(row);
  });

  it("devuelve null si user_id NO coincide", () => {
    const row = { id: "a", user_id: "u1", label: "x" };
    expect(requireOwnership(row, "otro-usuario")).toBeNull();
  });

  it("devuelve null si la fila es null", () => {
    expect(requireOwnership(null, "u1")).toBeNull();
  });
});
