import { describe, it, expect } from "vitest";
import { NEWS_SOURCES, getSourcesForAsset } from "../sources";
import { dedupeNews, getNormalizedTitle } from "../dedupe";
import { scoreImpact } from "../impactScore";
import type { NewsItem } from "../ingest";

function makeNews(overrides: Partial<NewsItem> = {}): NewsItem {
  return {
    id: `n-${Math.random()}`,
    title: "Some news headline",
    url: undefined,
    source: "test-source",
    publishedAt: new Date(),
    asset: "US500",
    ...overrides,
  };
}

// ─── sources ────────────────────────────────────────────────────────────────

describe("NEWS_SOURCES + getSourcesForAsset", () => {
  it("incluye fuentes oficiales esperadas", () => {
    const ids = NEWS_SOURCES.map((s) => s.id);
    expect(ids).toContain("fed_press_monetary");
    expect(ids).toContain("bls_employment");
    expect(ids).toContain("bls_cpi");
    expect(ids).toContain("sec_press");
  });

  it("cada source tiene id, name, url, assets[]", () => {
    for (const s of NEWS_SOURCES) {
      expect(s.id.length).toBeGreaterThan(0);
      expect(s.name.length).toBeGreaterThan(0);
      expect(s.url).toMatch(/^https?:\/\//);
      expect(s.assets.length).toBeGreaterThan(0);
    }
  });

  it("getSourcesForAsset('US500') incluye fed + bls + sec", () => {
    const r = getSourcesForAsset("US500");
    const ids = r.map((s) => s.id);
    expect(ids).toContain("fed_press_monetary");
    expect(ids).toContain("sec_press");
  });

  it("getSourcesForAsset('XAUUSD') NO incluye sec (es US500-only)", () => {
    const r = getSourcesForAsset("XAUUSD");
    const ids = r.map((s) => s.id);
    expect(ids).not.toContain("sec_press");
    expect(ids).toContain("fed_press_monetary");
  });
});

// ─── dedupeNews ─────────────────────────────────────────────────────────────

describe("dedupeNews + getNormalizedTitle", () => {
  it("array vacío → []", () => {
    expect(dedupeNews([])).toEqual([]);
  });

  it("items con URL distintas no se deduplican", () => {
    const items = [
      makeNews({ url: "https://x.com/a", title: "Same Title" }),
      makeNews({ url: "https://x.com/b", title: "Same Title" }),
    ];
    expect(dedupeNews(items)).toHaveLength(2);
  });

  it("items con misma URL → se deduplican", () => {
    const items = [
      makeNews({ url: "https://x.com/article" }),
      makeNews({ url: "https://x.com/article", title: "Different Title" }),
    ];
    expect(dedupeNews(items)).toHaveLength(1);
  });

  it("items sin URL pero con título normalizado igual → se deduplican", () => {
    const items = [
      makeNews({ title: "Fed Cuts Rates!" }),
      makeNews({ title: "Fed Cuts Rates" }), // sin '!'
      makeNews({ title: "FED CUTS RATES" }), // diferente case
    ];
    expect(dedupeNews(items)).toHaveLength(1);
  });

  it("getNormalizedTitle: lowercase + trim + collapse spaces + sin puntuación", () => {
    expect(getNormalizedTitle("Hello, World!  ")).toBe("hello world");
    expect(getNormalizedTitle("Fed&amp;Co")).toBe("fed co");
    expect(getNormalizedTitle("&quot;test&quot;")).toBe("test");
    expect(getNormalizedTitle("multiple   spaces")).toBe("multiple spaces");
  });

  it("preserva el orden de los items únicos (first-wins)", () => {
    const items = [
      makeNews({ id: "first", url: "u1" }),
      makeNews({ id: "second", url: "u1" }), // dup
      makeNews({ id: "third", url: "u2" }),
    ];
    const r = dedupeNews(items);
    expect(r.map((x) => x.id)).toEqual(["first", "third"]);
  });
});

// ─── scoreImpact ────────────────────────────────────────────────────────────

describe("scoreImpact", () => {
  it("'high' cuando título contiene keyword high (US500)", () => {
    const r = scoreImpact("US500", makeNews({ title: "FOMC announces rate cut" }));
    expect(r.label).toBe("high");
    expect(r.score).toBe(3);
  });

  it("'medium' cuando contiene keyword medium pero no high", () => {
    const r = scoreImpact("US500", makeNews({ title: "Retail sales miss expectations" }));
    expect(r.label).toBe("medium");
    expect(r.score).toBe(2);
  });

  it("'low' cuando no hay keywords", () => {
    const r = scoreImpact("US500", makeNews({ title: "Unrelated celebrity gossip" }));
    expect(r.label).toBe("low");
    expect(r.score).toBe(1);
  });

  it("case-insensitive (UPPERCASE matchea)", () => {
    const r = scoreImpact("US500", makeNews({ title: "FED RATE HIKE INCOMING" }));
    expect(r.label).toBe("high");
  });

  it("keyword puede estar en el source también, no sólo el title", () => {
    const r = scoreImpact("US500", makeNews({ title: "Generic news", source: "Fed Reserve" }));
    expect(r.label).toBe("high");
  });

  it("XAUUSD: 'gold' matches high", () => {
    const r = scoreImpact("XAUUSD", makeNews({ title: "Gold prices surge" }));
    expect(r.label).toBe("high");
  });

  it("US500 'gold' NO matches (no es keyword para US500)", () => {
    const r = scoreImpact("US500", makeNews({ title: "Gold prices surge" }));
    expect(r.label).toBe("low");
  });
});
