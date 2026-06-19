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
const WEB_MODULES = [20, 21, 22, 23, 24];
const PENTEST_MODULES = [25, 26, 27, 28, 29, 30, 31, 32, 33];
const SOCIAL_MODULES = [34, 35];
const MALWARE_MODULES = [36, 37, 38];
const FORENSE_MODULES = [39, 40, 41];
const BLUE_MODULES = [42, 43, 44];
const CLOUD_MODULES = [45, 46, 47, 48];
const ESPEC_MODULES = [49, 50];
const PROG_MODULES = [51, 52, 53, 54, 55, 56, 57, 58];
const EXPLOIT_MODULES = [59, 60, 61, 62];
const CRIPTOADV_MODULES = [63, 64, 65, 66];

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
  it("cada módulo de Web Security (M20-M24) tiene ≥4 definiciones", () => {
    for (const m of WEB_MODULES) {
      expect(definitionsByModule(m).length, `módulo ${m}`).toBeGreaterThanOrEqual(4);
    }
  });
  it("cada módulo de Pentesting (M25-M33) tiene ≥4 definiciones", () => {
    for (const m of PENTEST_MODULES) {
      expect(definitionsByModule(m).length, `módulo ${m}`).toBeGreaterThanOrEqual(4);
    }
  });
  it("cada módulo de Social Eng. (M34-M35) tiene ≥4 definiciones", () => {
    for (const m of SOCIAL_MODULES) {
      expect(definitionsByModule(m).length, `módulo ${m}`).toBeGreaterThanOrEqual(4);
    }
  });
  it("cada módulo de Malware (M36-M38) tiene ≥4 definiciones", () => {
    for (const m of MALWARE_MODULES) {
      expect(definitionsByModule(m).length, `módulo ${m}`).toBeGreaterThanOrEqual(4);
    }
  });
  it("cada módulo de Forense (M39-M41) tiene ≥4 definiciones", () => {
    for (const m of FORENSE_MODULES) {
      expect(definitionsByModule(m).length, `módulo ${m}`).toBeGreaterThanOrEqual(4);
    }
  });
  it("cada módulo de Blue Team (M42-M44) tiene ≥4 definiciones", () => {
    for (const m of BLUE_MODULES) {
      expect(definitionsByModule(m).length, `módulo ${m}`).toBeGreaterThanOrEqual(4);
    }
  });
  it("cada módulo de Cloud (M45-M48) tiene ≥4 definiciones", () => {
    for (const m of CLOUD_MODULES) {
      expect(definitionsByModule(m).length, `módulo ${m}`).toBeGreaterThanOrEqual(4);
    }
  });
  it("cada módulo de Especializado (M49-M50) tiene ≥4 definiciones", () => {
    for (const m of ESPEC_MODULES) {
      expect(definitionsByModule(m).length, `módulo ${m}`).toBeGreaterThanOrEqual(4);
    }
  });
  it("cada módulo de Programación (M51-M58) tiene ≥4 definiciones", () => {
    for (const m of PROG_MODULES) {
      expect(definitionsByModule(m).length, `módulo ${m}`).toBeGreaterThanOrEqual(4);
    }
  });
  it("cada módulo de Exploit Dev Avanzado (M59-M62) tiene ≥4 definiciones", () => {
    for (const m of EXPLOIT_MODULES) {
      expect(definitionsByModule(m).length, `módulo ${m}`).toBeGreaterThanOrEqual(4);
    }
  });
  it("cada módulo de Cripto Avanzada (M63-M66) tiene ≥4 definiciones", () => {
    for (const m of CRIPTOADV_MODULES) {
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
  it("M21 tiene el OWASP Top 10 (controls, 10 categorías) y M24 un flujo SSRF", () => {
    const owasp = frameworksByModule(21).find((f) => f.kind === "controls");
    expect(owasp).toBeDefined();
    expect(owasp!.phases).toHaveLength(10);
    expect(frameworksByModule(24).some((f) => f.kind === "flow")).toBe(true);
  });
  it("M25 tiene la metodología de pentest (flow, 7 fases) y M29/M33 flujos", () => {
    const metodologia = frameworksByModule(25).find((f) => f.kind === "flow");
    expect(metodologia).toBeDefined();
    expect(metodologia!.phases).toHaveLength(7);
    expect(frameworksByModule(29).some((f) => f.kind === "flow")).toBe(true);
    expect(frameworksByModule(33).some((f) => f.kind === "flow")).toBe(true);
  });
  it("M34 tiene los 6 principios de Cialdini (controls, 6) y M35 un flujo de phishing", () => {
    const cialdini = frameworksByModule(34).find((f) => f.kind === "controls");
    expect(cialdini).toBeDefined();
    expect(cialdini!.phases).toHaveLength(6);
    expect(frameworksByModule(35).some((f) => f.kind === "flow")).toBe(true);
  });
  it("M36 tiene la Pirámide del Dolor (layers, 6) y M38 un flujo de análisis", () => {
    const pyramid = frameworksByModule(36).find((f) => f.kind === "layers");
    expect(pyramid).toBeDefined();
    expect(pyramid!.phases).toHaveLength(6);
    expect(frameworksByModule(38).some((f) => f.kind === "flow")).toBe(true);
  });
  it("M39 tiene el proceso forense (flow) y M40 el orden de volatilidad (layers, 5)", () => {
    expect(frameworksByModule(39).some((f) => f.kind === "flow")).toBe(true);
    const volat = frameworksByModule(40).find((f) => f.kind === "layers");
    expect(volat).toBeDefined();
    expect(volat!.phases).toHaveLength(5);
  });
  it("M43 tiene el ciclo de IR (flow, 6) y M44 el ciclo de hunting (flow)", () => {
    const ir = frameworksByModule(43).find((f) => f.kind === "flow");
    expect(ir).toBeDefined();
    expect(ir!.phases).toHaveLength(6);
    expect(frameworksByModule(44).some((f) => f.kind === "flow")).toBe(true);
  });
  it("M47 tiene las 4 C (layers, 4) y M48 el pipeline DevSecOps (flow)", () => {
    const fourC = frameworksByModule(47).find((f) => f.kind === "layers");
    expect(fourC).toBeDefined();
    expect(fourC!.phases).toHaveLength(4);
    expect(frameworksByModule(48).some((f) => f.kind === "flow")).toBe(true);
  });
  it("M49 tiene el OWASP IoT Top 10 (controls, 10) y M50 la estructura de reporte (flow)", () => {
    const iot = frameworksByModule(49).find((f) => f.kind === "controls");
    expect(iot).toBeDefined();
    expect(iot!.phases).toHaveLength(10);
    expect(frameworksByModule(50).some((f) => f.kind === "flow")).toBe(true);
  });
  it("M55 tiene la anatomía de un buffer overflow (flow)", () => {
    expect(frameworksByModule(55).some((f) => f.kind === "flow")).toBe(true);
  });
  it("M61 (full chain navegador) y M62 (cadena ROP) tienen un flow", () => {
    expect(frameworksByModule(61).some((f) => f.kind === "flow")).toBe(true);
    expect(frameworksByModule(62).some((f) => f.kind === "flow")).toBe(true);
  });
  it("M63 tiene los modelos de ataque (layers, 4) y M64 la migración PQC (flow)", () => {
    const modelos = frameworksByModule(63).find((f) => f.kind === "layers");
    expect(modelos).toBeDefined();
    expect(modelos!.phases).toHaveLength(4);
    expect(frameworksByModule(64).some((f) => f.kind === "flow")).toBe(true);
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
  it("M20 y M21 tienen líneas de tiempo (ataques web y OWASP Top 10)", () => {
    expect(timelinesByModule(20).length).toBeGreaterThanOrEqual(1);
    expect(timelinesByModule(21).length).toBeGreaterThanOrEqual(1);
  });
  it("M25 tiene línea de tiempo (historia del pentesting)", () => {
    expect(timelinesByModule(25).length).toBeGreaterThanOrEqual(1);
  });
  it("M35 tiene línea de tiempo (evolución del phishing)", () => {
    expect(timelinesByModule(35).length).toBeGreaterThanOrEqual(1);
  });
  it("M36 tiene línea de tiempo (evolución del malware)", () => {
    expect(timelinesByModule(36).length).toBeGreaterThanOrEqual(1);
  });
  it("M39 tiene línea de tiempo (evolución de la forense digital)", () => {
    expect(timelinesByModule(39).length).toBeGreaterThanOrEqual(1);
  });
  it("M42 tiene línea de tiempo (evolución de la defensa/SOC)", () => {
    expect(timelinesByModule(42).length).toBeGreaterThanOrEqual(1);
  });
  it("M45 tiene línea de tiempo (evolución del cloud)", () => {
    expect(timelinesByModule(45).length).toBeGreaterThanOrEqual(1);
  });
  it("M49 tiene línea de tiempo (seguridad IoT/móvil)", () => {
    expect(timelinesByModule(49).length).toBeGreaterThanOrEqual(1);
  });
  it("M51 tiene línea de tiempo (lenguajes en ciberseguridad)", () => {
    expect(timelinesByModule(51).length).toBeGreaterThanOrEqual(1);
  });
  it("M59 tiene línea de tiempo (mitigaciones de explotación)", () => {
    expect(timelinesByModule(59).length).toBeGreaterThanOrEqual(1);
  });
  it("M64 tiene línea de tiempo (hacia la cripto post-cuántica)", () => {
    expect(timelinesByModule(64).length).toBeGreaterThanOrEqual(1);
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
