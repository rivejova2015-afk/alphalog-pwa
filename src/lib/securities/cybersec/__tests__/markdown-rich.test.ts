import { describe, it, expect } from "vitest";
import { parseContent } from "../markdown";

describe("parseContent — tablas", () => {
  it("parsea header + filas e ignora la fila separadora", () => {
    const content = "| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |";
    const blocks = parseContent(content);
    expect(blocks).toHaveLength(1);
    const t = blocks[0];
    expect(t.type).toBe("table");
    expect(t.header).toEqual(["A", "B"]);
    expect(t.rows).toEqual([["1", "2"], ["3", "4"]]);
  });

  it("separa la tabla del texto que la rodea", () => {
    const content = "Intro\n| A | B |\n|---|---|\n| 1 | 2 |\nCierre";
    const blocks = parseContent(content);
    expect(blocks.map((b) => b.type)).toEqual(["text", "table", "text"]);
  });
});

describe("parseContent — callouts", () => {
  it("agrupa líneas '>' y quita el prefijo", () => {
    const content = "> 💡 Un consejo útil\n> segunda línea";
    const blocks = parseContent(content);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("callout");
    expect(blocks[0].variant).toBe("tip");
    expect(blocks[0].lines).toEqual(["💡 Un consejo útil", "segunda línea"]);
  });

  it("detecta la variante por emoji", () => {
    expect(parseContent("> ⚠️ ojo")[0].variant).toBe("warning");
    expect(parseContent("> ✅ hecho")[0].variant).toBe("success");
    expect(parseContent("> sin emoji")[0].variant).toBe("info");
  });
});

describe("parseContent — no-regresión", () => {
  it("texto plano sigue siendo un bloque de texto", () => {
    const blocks = parseContent("Hola **mundo**\nsegunda línea de prosa");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("text");
    expect(blocks[0].lines).toHaveLength(2);
  });

  it("el código sigue detectándose como bloque de código", () => {
    const blocks = parseContent("nmap -sV 10.0.0.1");
    expect(blocks[0].type).toBe("code");
  });

  it("prosa con pipes interna no se confunde con tabla", () => {
    // No empieza con '|', así que es prosa, no tabla.
    const blocks = parseContent("Datos → Segmento (TCP) | UDP");
    expect(blocks[0].type).toBe("text");
  });
});
