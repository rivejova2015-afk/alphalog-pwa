import { describe, it, expect } from "vitest";
import {
  CERTIFICATIONS, CERT_TRACKS, CERT_TRACK_IDS, CERT_TIER_LABELS,
  certsByTrack, trackForCategory, certsByCategory, getCertification,
} from "../certifications";
import { SYLLABUS } from "../syllabus";

const TRACK_IDS = new Set(CERT_TRACK_IDS);

describe("CERTIFICATIONS catálogo", () => {
  it("ids únicos y campos obligatorios válidos", () => {
    const ids = new Set<number>();
    for (const c of CERTIFICATIONS) {
      expect(c.id).toBeGreaterThan(0);
      expect(ids.has(c.id), `id duplicado: ${c.id}`).toBe(false);
      ids.add(c.id);
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.fullName.length).toBeGreaterThan(0);
      expect(c.vendor.length).toBeGreaterThan(0);
      expect(TRACK_IDS.has(c.track), `track inválido en ${c.name}: ${c.track}`).toBe(true);
      expect([1, 2, 3, 4, 5]).toContain(c.tier);
      expect(c.priceUsd).toBeGreaterThanOrEqual(0);
      expect(c.prerequisites.length).toBeGreaterThan(0);
      expect(c.exam.length).toBeGreaterThan(0);
      expect(c.domains.length).toBeGreaterThan(0);
      expect(c.desc.length).toBeGreaterThan(10);
    }
  });

  it("todas las URLs son http(s) y bien formadas", () => {
    for (const c of CERTIFICATIONS) {
      expect(/^https?:\/\//.test(c.url), `${c.name}: url no http(s)`).toBe(true);
      expect(() => new URL(c.url)).not.toThrow();
    }
  });

  it("cada track tiene ≥3 certs y cubre los niveles 1..4", () => {
    for (const t of CERT_TRACKS) {
      const certs = certsByTrack(t.id);
      expect(certs.length, `track '${t.id}' con menos de 3 certs`).toBeGreaterThanOrEqual(3);
      const tiers = new Set(certs.map((c) => c.tier));
      for (const tier of [1, 2, 3, 4]) {
        expect(tiers.has(tier as 1 | 2 | 3 | 4), `track '${t.id}' sin nivel ${tier}`).toBe(true);
      }
    }
  });

  it("certsByTrack devuelve ordenado por tier ascendente", () => {
    for (const t of CERT_TRACKS) {
      const tiers = certsByTrack(t.id).map((c) => c.tier);
      expect([...tiers].sort((a, b) => a - b)).toEqual(tiers);
    }
  });

  it("trackForCategory cubre las 21 categorías del syllabus", () => {
    const cats = [...new Set(SYLLABUS.map((m) => m.cat))];
    for (const cat of cats) {
      const track = trackForCategory(cat);
      expect(TRACK_IDS.has(track), `categoría '${cat}' mapea a track inválido: ${track}`).toBe(true);
      // y siempre hay al menos una cert para mostrar en el detalle del módulo
      expect(certsByCategory(cat).length).toBeGreaterThan(0);
    }
  });

  it("CERT_TRACKS y CERT_TIER_LABELS bien formados", () => {
    expect(CERT_TRACKS.length).toBe(8);
    expect(new Set(CERT_TRACKS.map((t) => t.id)).size).toBe(8);
    for (const tier of [1, 2, 3, 4, 5] as const) {
      expect(CERT_TIER_LABELS[tier].length).toBeGreaterThan(0);
    }
  });

  it("getCertification resuelve por id", () => {
    expect(getCertification(CERTIFICATIONS[0].id)?.id).toBe(CERTIFICATIONS[0].id);
    expect(getCertification(99999)).toBeUndefined();
  });
});
