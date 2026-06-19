import { describe, it, expect } from "vitest";
import { DEFINITIONS, definitionsByModule, getDefinition } from "../definitions";
import { FRAMEWORKS, frameworksByModule } from "../frameworks";
import { TIMELINES, timelinesByModule } from "../timelines";
import { BRANCHES, branchesByModule } from "../branches";
import { CERT_TRACK_IDS } from "../certifications";

const PILOT_MODULES = [1, 2, 3, 4];
const REDES_MODULES = [5, 6, 7, 8, 9];
const SISTEMAS_MODULES = [10, 11, 12, 13, 14, 15];
const CRIPTO_MODULES = [16, 17, 18, 19];

describe("DEFINITIONS", () => {
  it("ids únicos y campos no vacíos", () => {
    const ids = new Set<number>();
    for (const d of DEFINITIONS) {
      expect(ids.has(d.id), `id duplicado: ${d.id}`).toBe(false);
      ids.add(d.id);
      expect(d.term.length).toBeGreaterThan(0);
      expect(d.short.length).toBeGreaterThan(0);
      expect(d.detail.length).toBeGreaterThan(20);
      expect(Array.isArray(d.examples)).toBe(true);
      expect(d.module).toBeGreaterThan(0);
    }
  });
  it("cada módulo del piloto (M1-M4) tiene ≥4 definiciones", () => {
    for (const m of PILOT_MODULES) {
      expect(definitionsByModule(m).length, `módulo ${m}`).toBeGreaterThanOrEqual(4);
    }
  });
  it("cada módulo de Redes (M5-M9) tiene ≥4 definiciones", () => {
    for (const m of REDES_MODULES) {
      expect(definitionsByModule(m).length, `módulo ${m}`).toBeGreaterThanOrEqual(4);
    }
  });
  it("cada módulo de Sistemas (M10-M15) tiene ≥4 definiciones", () => {
    for (const m of SISTEMAS_MODULES) {
      expect(definitionsByModule(m).length, `módulo ${m}`).toBeGreaterThanOrEqual(4);
    }
  });
  it("cada módulo de Criptografía (M16-M19) tiene ≥4 definiciones", () => {
    for (const m of CRIPTO_MODULES) {
      expect(definitionsByModule(m).length, `módulo ${m}`).toBeGreaterThanOrEqual(4);
    }
  });
  it("getDefinition resuelve por id", () => {
    expect(getDefinition(DEFINITIONS[0].id)?.term).toBe(DEFINITIONS[0].term);
    expect(getDefinition(999999)).toBeUndefined();
  });
});

describe("FRAMEWORKS", () => {
  it("ids únicos, fases numeradas consecutivamente y con defensas", () => {
    const ids = new Set<number>();
    for (const f of FRAMEWORKS) {
      expect(ids.has(f.id), `id duplicado: ${f.id}`).toBe(false);
      ids.add(f.id);
      expect(f.name.length).toBeGreaterThan(0);
      expect(f.summary.length).toBeGreaterThan(0);
      expect(f.phases.length).toBeGreaterThan(0);
      f.phases.forEach((p, i) => {
        expect(p.n, `${f.name} fase ${i}`).toBe(i + 1);
        expect(p.name.length).toBeGreaterThan(0);
        expect(p.desc.length).toBeGreaterThan(0);
        expect(p.defenses.length).toBeGreaterThan(0);
      });
    }
  });
  it("M1 tiene el Cyber Kill Chain y M3 una matriz ATT&CK", () => {
    expect(frameworksByModule(1).some((f) => f.kind === "killchain")).toBe(true);
    expect(frameworksByModule(3).some((f) => f.kind === "attack")).toBe(true);
  });
  it("M5 tiene el modelo OSI (layers, 7 capas) y M9 un flujo de ataque WiFi", () => {
    const osi = frameworksByModule(5).find((f) => f.kind === "layers");
    expect(osi).toBeDefined();
    expect(osi!.phases).toHaveLength(7);
    expect(frameworksByModule(9).some((f) => f.kind === "flow")).toBe(true);
  });
  it("M14 tiene el flujo de autenticación Kerberos y M13 un pipeline de detección", () => {
    expect(frameworksByModule(14).some((f) => f.kind === "flow")).toBe(true);
    expect(frameworksByModule(13).some((f) => f.kind === "flow")).toBe(true);
  });
  it("M19 tiene el handshake TLS y M18 la cadena de confianza PKI", () => {
    expect(frameworksByModule(19).some((f) => f.kind === "flow")).toBe(true);
    expect(frameworksByModule(18).some((f) => f.kind === "flow")).toBe(true);
  });
});

describe("TIMELINES", () => {
  it("eventos ordenados por año ascendente y con campos válidos", () => {
    for (const t of TIMELINES) {
      expect(t.events.length).toBeGreaterThan(0);
      const years = t.events.map((e) => e.year);
      expect(years).toEqual([...years].sort((a, b) => a - b));
      for (const e of t.events) {
        expect(e.title.length).toBeGreaterThan(0);
        expect(e.desc.length).toBeGreaterThan(0);
        expect(["low", "medium", "high"]).toContain(e.impact);
      }
    }
  });
  it("M1 tiene una línea de tiempo de historia", () => {
    expect(timelinesByModule(1).length).toBeGreaterThanOrEqual(1);
  });
  it("M6 y M9 tienen líneas de tiempo (protocolos y seguridad WiFi)", () => {
    expect(timelinesByModule(6).length).toBeGreaterThanOrEqual(1);
    expect(timelinesByModule(9).length).toBeGreaterThanOrEqual(1);
  });
  it("M10 y M14 tienen líneas de tiempo (Linux/distros y ataques AD)", () => {
    expect(timelinesByModule(10).length).toBeGreaterThanOrEqual(1);
    expect(timelinesByModule(14).length).toBeGreaterThanOrEqual(1);
  });
  it("M16 y M19 tienen líneas de tiempo (criptografía y SSL/TLS)", () => {
    expect(timelinesByModule(16).length).toBeGreaterThanOrEqual(1);
    expect(timelinesByModule(19).length).toBeGreaterThanOrEqual(1);
  });
});

describe("BRANCHES", () => {
  it("ids únicos, campos no vacíos y track válido de certificaciones", () => {
    const ids = new Set<number>();
    for (const b of BRANCHES) {
      expect(ids.has(b.id), `id duplicado: ${b.id}`).toBe(false);
      ids.add(b.id);
      expect(b.name.length).toBeGreaterThan(0);
      expect(b.summary.length).toBeGreaterThan(0);
      expect(b.roles.length).toBeGreaterThan(0);
      expect(b.skills.length).toBeGreaterThan(0);
      expect(b.tools.length).toBeGreaterThan(0);
      expect(CERT_TRACK_IDS).toContain(b.track);
    }
  });
  it("M1 expone las ramas del campo (≥6)", () => {
    expect(branchesByModule(1).length).toBeGreaterThanOrEqual(6);
  });
});
