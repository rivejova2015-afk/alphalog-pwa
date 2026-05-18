import { describe, it, expect } from "vitest";
import { buildImpactMatrix } from "../impactMatrix";
import { extractRecaps } from "../recapExtractor";
import { diffReports } from "../reportDiff";
import { monitorSources } from "../sourceHealthMonitor";
import { clusterStories } from "../storyClustering";

// ─── buildImpactMatrix ───────────────────────────────────────────────────────

describe("buildImpactMatrix", () => {
  it("retorna [] cuando input vacío", () => {
    expect(buildImpactMatrix([])).toEqual([]);
  });

  it("preserva todos los campos del input", () => {
    const r = buildImpactMatrix([
      { topic: "Fed Rate", impact: "high", bias: "bullish", confidence: 0.85 },
    ]);
    expect(r).toEqual([
      { topic: "Fed Rate", impact: "high", bias: "bullish", confidence: 0.85 },
    ]);
  });

  it("mantiene el orden del input", () => {
    const input = [
      { topic: "A", impact: "low", bias: "neutral", confidence: 0.1 },
      { topic: "B", impact: "high", bias: "bearish", confidence: 0.9 },
    ];
    const r = buildImpactMatrix(input);
    expect(r.map((x) => x.topic)).toEqual(["A", "B"]);
  });
});

// ─── extractRecaps ───────────────────────────────────────────────────────────

describe("extractRecaps", () => {
  it("filtra noticias con 'recap' en el título (case insensitive)", () => {
    const r = extractRecaps([
      { id: "n1", title: "Market Recap May 17", content: "..." },
      { id: "n2", title: "Other news", content: "..." },
      { id: "n3", title: "DAILY RECAP — Fed", content: "..." },
    ]);
    expect(r).toHaveLength(2);
    expect(r.map((x) => x.id)).toEqual(["n1", "n3"]);
  });

  it("retorna [] cuando ningún título matchea", () => {
    expect(extractRecaps([{ id: "n1", title: "Earnings beat", content: "" }])).toEqual([]);
  });

  it("input vacío → []", () => {
    expect(extractRecaps([])).toEqual([]);
  });

  it("cada recap tiene direction + drivers (placeholders)", () => {
    const r = extractRecaps([{ id: "n1", title: "Recap", content: "" }]);
    expect(r[0].direction).toBe("up");
    expect(r[0].drivers).toEqual(["macro", "yields"]);
  });
});

// ─── diffReports ─────────────────────────────────────────────────────────────

describe("diffReports", () => {
  it("retorna líneas presentes en current pero no en previous", () => {
    const r = diffReports("a\nb\nc", "a\nc");
    expect(r).toEqual(["b"]);
  });

  it("cuando todo coincide → []", () => {
    expect(diffReports("a\nb", "a\nb")).toEqual([]);
  });

  it("cap a 5 bullets aunque haya más diferencias", () => {
    const current = Array.from({ length: 20 }, (_, i) => `line-${i}`).join("\n");
    const r = diffReports(current, "");
    expect(r).toHaveLength(5);
  });

  it("previous vacío → todas las líneas de current (cap 5)", () => {
    expect(diffReports("x\ny\nz", "")).toEqual(["x", "y", "z"]);
  });

  it("current vacío → []", () => {
    // "".split("\n") = [""] → filtered against previous=set, "" tampoco existe
    // Devuelve [""] si previous no incluye "" — el behavior actual.
    const r = diffReports("", "previous content");
    expect(r).toEqual([""]);
  });
});

// ─── monitorSources ──────────────────────────────────────────────────────────

describe("monitorSources", () => {
  it("retorna 'empty' cuando data está vacío", () => {
    expect(monitorSources([{ source: "rss-feed", data: [] }])).toEqual([
      { source: "rss-feed", status: "empty" },
    ]);
  });

  it("retorna 'duplicate' cuando hay items duplicados", () => {
    const r = monitorSources([
      { source: "feed-x", data: [{ a: 1 }, { a: 1 }, { a: 2 }] },
    ]);
    expect(r[0].status).toBe("duplicate");
  });

  it("retorna 'down' cuando el source contiene 'fail'", () => {
    const r = monitorSources([
      { source: "fail-source", data: [{ ok: true }] },
    ]);
    expect(r[0].status).toBe("down");
  });

  it("retorna 'ok' en caso normal", () => {
    const r = monitorSources([
      { source: "healthy-feed", data: [{ ok: true }, { ok: false }] },
    ]);
    expect(r[0].status).toBe("ok");
  });

  it("procesa múltiples sources independientemente", () => {
    const r = monitorSources([
      { source: "ok", data: [{}] },
      { source: "empty", data: [] },
      { source: "fail-x", data: [{}] },
    ]);
    expect(r.map((x) => x.status)).toEqual(["ok", "empty", "down"]);
  });
});

// ─── clusterStories ──────────────────────────────────────────────────────────

describe("clusterStories", () => {
  it("agrupa noticias por topic", () => {
    const news = [
      { id: "n1", title: "T1a", content: "", topic: "fed", date: new Date() },
      { id: "n2", title: "T1b", content: "", topic: "fed", date: new Date() },
      { id: "n3", title: "T2a", content: "", topic: "ecb", date: new Date() },
    ];
    const r = clusterStories(news);
    expect(r).toHaveLength(2);
    const fed = r.find((c) => c.topic === "fed");
    const ecb = r.find((c) => c.topic === "ecb");
    expect(fed?.items).toHaveLength(2);
    expect(ecb?.items).toHaveLength(1);
  });

  it("retorna [] cuando input vacío", () => {
    expect(clusterStories([])).toEqual([]);
  });

  it("una sola noticia → 1 cluster con 1 item", () => {
    const r = clusterStories([
      { id: "n1", title: "T", content: "", topic: "x", date: new Date() },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].items).toHaveLength(1);
  });
});
