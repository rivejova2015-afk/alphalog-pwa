import { describe, it, expect } from "vitest";
import { searchModules } from "../search";

describe("searchModules", () => {
  it("query vacío → []", () => {
    expect(searchModules("")).toEqual([]);
    expect(searchModules("   ")).toEqual([]);
  });

  it("encuentra por título (Nmap → M26)", () => {
    const r = searchModules("nmap");
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].m).toBe(26);
  });

  it("encuentra por topic (kerberos → Active Directory M14)", () => {
    const r = searchModules("kerberos");
    expect(r.some((x) => x.m === 14)).toBe(true);
    const ad = r.find((x) => x.m === 14)!;
    expect(ad.matched.length).toBeGreaterThan(0);
  });

  it("es insensible a acentos (criptografia → módulos de Criptografía)", () => {
    const r = searchModules("criptografia");
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((x) => x.cat.includes("Cripto") || x.title.toLowerCase().includes("cripto"))).toBe(true);
  });

  it("requiere que TODOS los tokens matcheen", () => {
    const r = searchModules("nmap zzzznoexiste");
    expect(r).toEqual([]);
  });

  it("prioriza match en el título sobre topic", () => {
    const r = searchModules("phishing");
    // "Phishing Avanzado" (M35) debería rankear primero por título
    expect(r[0].title.toLowerCase()).toContain("phishing");
  });

  it("respeta el límite", () => {
    const r = searchModules("seguridad", 3);
    expect(r.length).toBeLessThanOrEqual(3);
  });
});
