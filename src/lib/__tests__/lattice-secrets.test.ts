import { describe, it, expect } from "vitest";
import { getLatticeSecret, setLatticeSecret, deleteLatticeSecret } from "../lattice-secrets";

describe("lattice-secrets", () => {
  it("guarda y lee un secreto cifrado, round-trip", async () => {
    const name = `test-${Date.now()}`;
    await setLatticeSecret("alphalog-cme", name, "token-de-prueba-xyz");
    const read = await getLatticeSecret("alphalog-cme", name);
    expect(read).toBe("token-de-prueba-xyz");
    await deleteLatticeSecret("alphalog-cme", name);
    const afterDelete = await getLatticeSecret("alphalog-cme", name);
    expect(afterDelete).toBeNull();
  });

  it("getLatticeSecret devuelve null si no existe", async () => {
    const read = await getLatticeSecret("alphalog-cme", "no-existe-nunca");
    expect(read).toBeNull();
  });
});
