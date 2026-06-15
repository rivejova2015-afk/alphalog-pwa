import { describe, it, expect } from "vitest";
import { LIBRARY, LIBRARY_CATEGORIES, libraryByCategory, getLibraryBook } from "../library";

describe("LIBRARY catálogo", () => {
  it("cada libro tiene ids únicos y campos obligatorios válidos", () => {
    const ids = new Set<number>();
    for (const b of LIBRARY) {
      expect(b.id).toBeGreaterThan(0);
      expect(ids.has(b.id), `id duplicado: ${b.id}`).toBe(false);
      ids.add(b.id);
      expect(b.title.length).toBeGreaterThan(0);
      expect(b.author.length).toBeGreaterThan(0);
      expect(b.cat.length).toBeGreaterThan(0);
      expect(b.desc.length).toBeGreaterThan(10);
      expect(["pdf", "web"]).toContain(b.format);
      expect(["b", "i", "a", "all"]).toContain(b.level);
      expect(b.license.length).toBeGreaterThan(0);
    }
  });

  it("todas las URLs son http(s) y bien formadas", () => {
    for (const b of LIBRARY) {
      expect(/^https?:\/\//.test(b.url), `${b.title}: url no http(s)`).toBe(true);
      expect(() => new URL(b.url)).not.toThrow();
    }
  });

  it("cubre las categorías del syllabus con al menos 5 recursos cada una", () => {
    const SYLLABUS_CATS = [
      "Fundamentos", "Redes", "Sistemas", "Criptografía", "Web Security", "Pentesting",
      "Social Eng.", "Malware", "Forense", "Blue Team", "Cloud", "Especializado",
      "Programación", "Exploit Dev Avanzado", "Cripto Avanzada", "AI/ML Security",
      "Hardware & Low-Level", "Reversing Avanzado", "Investigación",
      "Arquitectura de Seguridad", "GRC",
    ];
    const counts: Record<string, number> = {};
    for (const b of LIBRARY) counts[b.cat] = (counts[b.cat] ?? 0) + 1;
    for (const c of SYLLABUS_CATS) {
      expect(counts[c] ?? 0, `categoría '${c}' con menos de 5 recursos`).toBeGreaterThanOrEqual(5);
    }
  });

  it("LIBRARY_CATEGORIES son únicas y derivadas del catálogo", () => {
    expect(new Set(LIBRARY_CATEGORIES).size).toBe(LIBRARY_CATEGORIES.length);
    for (const c of LIBRARY_CATEGORIES) {
      expect(libraryByCategory(c).length).toBeGreaterThan(0);
    }
  });

  it("getLibraryBook resuelve por id", () => {
    expect(getLibraryBook(LIBRARY[0].id)?.id).toBe(LIBRARY[0].id);
    expect(getLibraryBook(99999)).toBeUndefined();
  });
});
