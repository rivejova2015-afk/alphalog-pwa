import { describe, it, expect } from "vitest";
import { DEFINITIONS, definitionsByModule, getDefinition } from "../definitions";
import { FRAMEWORKS, frameworksByModule } from "../frameworks";
import { TIMELINES, timelinesByModule } from "../timelines";
import { BRANCHES, branchesByModule } from "../branches";
import { CERT_TRACK_IDS } from "../certifications";

const PILOT_MODULES = [1, 2, 3, 4];

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
