import { describe, it, expect, vi } from "vitest";

// Mock encryption antes de importar helpers.ts (server-only + decryptText).
vi.mock("@/lib/security/encryption", () => ({
  decryptText: (value: string) => {
    if (value.startsWith("enc:")) return value.slice(4);
    if (value === "THROW") throw new Error("decrypt failed");
    return value;
  },
}));

import {
  asNumber,
  normalizeStatus,
  normalizeText,
  classifyAccountType,
  isWithinLastDays,
  shortText,
  isMissingTableError,
  safeDecrypt,
  parseJournalContent,
  toDateKey,
  scoreFromJournalEntry,
  computeMoodOutcomeCorrelation,
  buildConstraintItems,
  withFallback,
  MOOD_SCORE_MAP,
  DAY_MS,
  type JournalLike,
  type TradeLike,
} from "../helpers";

// ─── Primitivos ──────────────────────────────────────────────────────────────

describe("asNumber", () => {
  it("number finito → mismo valor", () => {
    expect(asNumber(42)).toBe(42);
    expect(asNumber(-3.5)).toBe(-3.5);
    expect(asNumber(0)).toBe(0);
  });
  it("string numérica → parseo", () => {
    expect(asNumber("42")).toBe(42);
    expect(asNumber("-3.5")).toBe(-3.5);
  });
  it("null/undefined → 0", () => {
    expect(asNumber(null)).toBe(0);
    expect(asNumber(undefined)).toBe(0);
  });
  it("NaN/Infinity → 0", () => {
    expect(asNumber(NaN)).toBe(0);
    expect(asNumber(Infinity)).toBe(0);
    expect(asNumber(-Infinity)).toBe(0);
  });
  it("string no numérica → 0", () => {
    expect(asNumber("abc")).toBe(0);
    expect(asNumber("")).toBe(0);
  });
});

describe("normalizeStatus", () => {
  it("'open' (cualquier case) → 'open'", () => {
    expect(normalizeStatus("open")).toBe("open");
    expect(normalizeStatus("OPEN")).toBe("open");
    expect(normalizeStatus(" Open ")).toBe("open");
  });
  it("cualquier otro valor → 'closed'", () => {
    expect(normalizeStatus("closed")).toBe("closed");
    expect(normalizeStatus("pending")).toBe("closed");
    expect(normalizeStatus(null)).toBe("closed");
    expect(normalizeStatus(undefined)).toBe("closed");
    expect(normalizeStatus("")).toBe("closed");
  });
});

describe("normalizeText", () => {
  it("trim + lowercase", () => {
    expect(normalizeText("  HOLA Mundo  ")).toBe("hola mundo");
  });
  it("null/undefined → ''", () => {
    expect(normalizeText(null)).toBe("");
    expect(normalizeText(undefined)).toBe("");
  });
});

// ─── classifyAccountType ─────────────────────────────────────────────────────

describe("classifyAccountType", () => {
  it("propfirm en role", () => {
    expect(classifyAccountType({ role: "propfirm trader" })).toBe("propfirm");
  });
  it("'prop firm' (con espacio) en category", () => {
    expect(classifyAccountType({ role: "trader" }, "prop firm Apex")).toBe("propfirm");
  });
  it("'funded' token → propfirm", () => {
    expect(classifyAccountType({ role: "funded" })).toBe("propfirm");
  });
  it("'challenge' token → propfirm", () => {
    expect(classifyAccountType({ role: "evaluation" }, "TopStep challenge")).toBe("propfirm");
  });
  it("sin tokens propfirm → real", () => {
    expect(classifyAccountType({ role: "personal" }, "Brokerage")).toBe("real");
  });
  it("role + category null → real (default)", () => {
    expect(classifyAccountType({ role: null }, null)).toBe("real");
  });
});

// ─── isWithinLastDays ────────────────────────────────────────────────────────

describe("isWithinLastDays", () => {
  it("fecha hoy mismo → true para 7 días", () => {
    expect(isWithinLastDays(new Date().toISOString(), 7)).toBe(true);
  });
  it("hace 3 días → true para 7", () => {
    const d = new Date(Date.now() - 3 * DAY_MS).toISOString();
    expect(isWithinLastDays(d, 7)).toBe(true);
  });
  it("hace 30 días → false para 7", () => {
    const d = new Date(Date.now() - 30 * DAY_MS).toISOString();
    expect(isWithinLastDays(d, 7)).toBe(false);
  });
  it("null/empty → false", () => {
    expect(isWithinLastDays(null, 7)).toBe(false);
    expect(isWithinLastDays("", 7)).toBe(false);
  });
  it("date inválida → false", () => {
    expect(isWithinLastDays("not-a-date", 7)).toBe(false);
  });
});

// ─── shortText ────────────────────────────────────────────────────────────────

describe("shortText", () => {
  it("string corta → preservada con whitespace collapsed", () => {
    expect(shortText("hola   mundo")).toBe("hola mundo");
  });
  it("string larga > max → truncada con '...' (slice(max-1) + ...)", () => {
    const r = shortText("a".repeat(200), 50);
    // Implementación: slice(0, max-1) + "..." → length = (max-1) + 3 = max + 2
    expect(r.length).toBe(52);
    expect(r.endsWith("...")).toBe(true);
  });
  it("default max = 180 (truncado → length 182)", () => {
    const r = shortText("a".repeat(300));
    expect(r.length).toBe(182);
  });
});

// ─── isMissingTableError ─────────────────────────────────────────────────────

describe("isMissingTableError", () => {
  it("código 42P01 → true", () => {
    expect(isMissingTableError({ code: "42P01", message: "x" })).toBe(true);
  });
  it("mensaje contiene 'does not exist' → true", () => {
    expect(isMissingTableError({ message: "relation does not exist" })).toBe(true);
    expect(isMissingTableError({ message: "Column foo DOES NOT EXIST" })).toBe(true);
  });
  it("otros errores → false", () => {
    expect(isMissingTableError({ code: "23505", message: "duplicate key" })).toBe(false);
    expect(isMissingTableError(null)).toBe(false);
    expect(isMissingTableError(undefined)).toBe(false);
  });
});

// ─── safeDecrypt + parseJournalContent ───────────────────────────────────────

describe("safeDecrypt", () => {
  it("null/empty → ''", () => {
    expect(safeDecrypt(null)).toBe("");
    expect(safeDecrypt(undefined)).toBe("");
    expect(safeDecrypt("")).toBe("");
  });
  it("delega a decryptText", () => {
    expect(safeDecrypt("enc:hola")).toBe("hola");
  });
  it("decryptText throw → retorna valor original", () => {
    expect(safeDecrypt("THROW")).toBe("THROW");
  });
});

describe("parseJournalContent", () => {
  it("null/empty → todo defaults", () => {
    const r = parseJournalContent(null);
    expect(r.text).toBe("");
    expect(r.mood_score).toBeNull();
    expect(r.action_items).toEqual([]);
    expect(r.lessons_learned).toBe("");
  });
  it("JSON válido → parsea text + mood_score + action_items + lessons_learned", () => {
    const json = JSON.stringify({
      text: "Hoy bien",
      mood_score: 8,
      action_items: ["a", "b", "c"],
      lessons_learned: "no overtradear",
    });
    const r = parseJournalContent(`enc:${json}`);
    expect(r.text).toBe("Hoy bien");
    expect(r.mood_score).toBe(8);
    expect(r.action_items).toEqual(["a", "b", "c"]);
    expect(r.lessons_learned).toBe("no overtradear");
  });
  it("JSON malformado → text=decrypted, resto defaults", () => {
    const r = parseJournalContent("enc:not-json{");
    expect(r.text).toBe("not-json{");
    expect(r.mood_score).toBeNull();
    expect(r.action_items).toEqual([]);
  });
  it("filtra action_items no string o vacíos", () => {
    const json = JSON.stringify({ action_items: ["a", "", "  ", 42, null, "b"] });
    const r = parseJournalContent(`enc:${json}`);
    expect(r.action_items).toEqual(["a", "b"]);
  });
  it("mood_score no número → null", () => {
    const json = JSON.stringify({ mood_score: "siete" });
    const r = parseJournalContent(`enc:${json}`);
    expect(r.mood_score).toBeNull();
  });
});

// ─── toDateKey ────────────────────────────────────────────────────────────────

describe("toDateKey", () => {
  it("ISO datetime → YYYY-MM-DD", () => {
    expect(toDateKey("2026-05-17T15:30:00Z")).toBe("2026-05-17");
  });
  it("null/empty → null", () => {
    expect(toDateKey(null)).toBeNull();
    expect(toDateKey("")).toBeNull();
  });
  it("inválido → null", () => {
    expect(toDateKey("garbage")).toBeNull();
  });
});

// ─── scoreFromJournalEntry ───────────────────────────────────────────────────

describe("scoreFromJournalEntry", () => {
  it("usa mood_score del JSON si está presente", () => {
    const json = JSON.stringify({ mood_score: 9 });
    expect(scoreFromJournalEntry({ content: `enc:${json}`, mood: "bad" })).toBe(9);
  });
  it("fallback a MOOD_SCORE_MAP[mood] cuando no hay mood_score", () => {
    expect(scoreFromJournalEntry({ content: null, mood: "good" })).toBe(MOOD_SCORE_MAP.good);
    expect(scoreFromJournalEntry({ content: null, mood: "TERRIBLE" })).toBe(MOOD_SCORE_MAP.terrible);
  });
  it("mood desconocido → 5 (neutral)", () => {
    expect(scoreFromJournalEntry({ content: null, mood: "happy" })).toBe(5);
  });
});

// ─── computeMoodOutcomeCorrelation ───────────────────────────────────────────

describe("computeMoodOutcomeCorrelation", () => {
  function dayN(daysAgo: number): string {
    return new Date(Date.now() - daysAgo * DAY_MS).toISOString();
  }

  function entry(mood: number, daysAgo: number): JournalLike {
    return { content: `enc:${JSON.stringify({ mood_score: mood })}`, created_at: dayN(daysAgo) };
  }

  function closedTrade(pnl: number, daysAgo: number): TradeLike {
    return { status: "closed", pnl, exit_date: dayN(daysAgo) };
  }

  it("< 5 días con data → neutral", () => {
    const r = computeMoodOutcomeCorrelation(
      [entry(8, 1), entry(3, 2)],
      [closedTrade(100, 1), closedTrade(-50, 2)],
    );
    expect(r.biasSignal).toBe("neutral");
    expect(r.correlationSampleSize).toBeLessThan(5);
  });

  it("high mood días + buenos PnL + low mood días + malos PnL → positive", () => {
    const entries: JournalLike[] = [];
    const trades: TradeLike[] = [];
    // 3 días high mood (8) con PnL +100 cada uno
    for (let i = 0; i < 3; i++) {
      entries.push(entry(8, i));
      trades.push(closedTrade(100, i));
    }
    // 3 días low mood (3) con PnL -100
    for (let i = 3; i < 6; i++) {
      entries.push(entry(3, i));
      trades.push(closedTrade(-100, i));
    }
    const r = computeMoodOutcomeCorrelation(entries, trades);
    expect(r.correlationSampleSize).toBe(6);
    expect(r.biasSignal).toBe("positive");
    expect(r.highMoodAvgPnl).toBe(100);
    expect(r.lowMoodAvgPnl).toBe(-100);
  });

  it("ignora trades sin status closed", () => {
    const entries: JournalLike[] = [entry(8, 0), entry(8, 1), entry(8, 2), entry(8, 3), entry(8, 4)];
    const openTrades: TradeLike[] = entries.map((_, i) => ({
      status: "open", pnl: 100, exit_date: dayN(i),
    }));
    const r = computeMoodOutcomeCorrelation(entries, openTrades);
    expect(r.correlationSampleSize).toBe(0); // ningún trade closed encontrado
  });

  it("diff < 10% → neutral (no signal)", () => {
    const entries: JournalLike[] = [];
    const trades: TradeLike[] = [];
    for (let i = 0; i < 3; i++) {
      entries.push(entry(8, i));
      trades.push(closedTrade(100, i));
    }
    for (let i = 3; i < 6; i++) {
      entries.push(entry(3, i));
      trades.push(closedTrade(99, i)); // diff = 1% (< 10%)
    }
    const r = computeMoodOutcomeCorrelation(entries, trades);
    expect(r.biasSignal).toBe("neutral");
  });

  it("scores 5-6 excluidos de ambos buckets", () => {
    const entries: JournalLike[] = [];
    const trades: TradeLike[] = [];
    for (let i = 0; i < 7; i++) {
      entries.push(entry(6, i)); // mid-range
      trades.push(closedTrade(100, i));
    }
    const r = computeMoodOutcomeCorrelation(entries, trades);
    expect(r.highMoodAvgPnl).toBeNull();
    expect(r.lowMoodAvgPnl).toBeNull();
  });
});

// ─── buildConstraintItems ────────────────────────────────────────────────────

describe("buildConstraintItems", () => {
  function recentTrade(pnl: number, daysAgo = 1): TradeLike {
    return {
      status: "closed",
      pnl,
      exit_date: new Date(Date.now() - daysAgo * DAY_MS).toISOString(),
    };
  }

  it("retorna 4 constraints en orden conocido", () => {
    const r = buildConstraintItems([], []);
    expect(r).toHaveLength(4);
    expect(r.map((c) => c.id)).toEqual(["cadence", "winrate", "pnl", "journal"]);
  });

  it("cadence ok con >=5 trades cerrados en 7d", () => {
    const trades = Array.from({ length: 5 }, () => recentTrade(50, 1));
    const r = buildConstraintItems(trades, []);
    expect(r.find((c) => c.id === "cadence")?.status).toBe("ok");
  });

  it("cadence warning con 3-4 trades en 7d", () => {
    const trades = Array.from({ length: 3 }, () => recentTrade(50, 1));
    const r = buildConstraintItems(trades, []);
    expect(r.find((c) => c.id === "cadence")?.status).toBe("warning");
  });

  it("cadence critical con <3 trades en 7d", () => {
    const r = buildConstraintItems([recentTrade(50, 1)], []);
    expect(r.find((c) => c.id === "cadence")?.status).toBe("critical");
  });

  it("winrate ok con >=45%", () => {
    const trades = [recentTrade(100), recentTrade(100), recentTrade(100), recentTrade(-50)]; // 75%
    const r = buildConstraintItems(trades, []);
    expect(r.find((c) => c.id === "winrate")?.status).toBe("ok");
  });

  it("winrate critical con <35%", () => {
    const trades = [recentTrade(100), recentTrade(-50), recentTrade(-50), recentTrade(-50)]; // 25%
    const r = buildConstraintItems(trades, []);
    expect(r.find((c) => c.id === "winrate")?.status).toBe("critical");
  });

  it("pnl ok con PnL > 0", () => {
    const r = buildConstraintItems([recentTrade(500)], []);
    expect(r.find((c) => c.id === "pnl")?.status).toBe("ok");
  });

  it("pnl critical con PnL <= -250", () => {
    const r = buildConstraintItems([recentTrade(-300)], []);
    expect(r.find((c) => c.id === "pnl")?.status).toBe("critical");
  });

  it("journal ok con >=3 entradas en 7d", () => {
    const journals: JournalLike[] = Array.from({ length: 3 }, (_, i) => ({
      created_at: new Date(Date.now() - i * DAY_MS).toISOString(),
    }));
    const r = buildConstraintItems([], journals);
    expect(r.find((c) => c.id === "journal")?.status).toBe("ok");
  });

  it("ignora trades open o fuera del rango temporal", () => {
    const trades: TradeLike[] = [
      { status: "open", pnl: 999, exit_date: new Date().toISOString() }, // open
      { status: "closed", pnl: 999, exit_date: new Date(Date.now() - 100 * DAY_MS).toISOString() }, // > 30d
    ];
    const r = buildConstraintItems(trades, []);
    expect(r.find((c) => c.id === "cadence")?.status).toBe("critical"); // 0 in window
    expect(r.find((c) => c.id === "pnl")?.metric).toContain("0.00");
  });
});

// ─── withFallback ────────────────────────────────────────────────────────────

describe("withFallback", () => {
  it("retorna data cuando query exitosa", async () => {
    const r = await withFallback(Promise.resolve({ data: [1, 2, 3], error: null }), []);
    expect(r).toEqual([1, 2, 3]);
  });
  it("fallback cuando data es null y no hay error", async () => {
    const r = await withFallback(Promise.resolve({ data: null, error: null }), ["fallback"]);
    expect(r).toEqual(["fallback"]);
  });
  it("fallback (graceful) cuando es missing table error", async () => {
    const err = { code: "42P01", message: "relation \"foo\" does not exist" };
    const r = await withFallback(Promise.resolve({ data: null, error: err }), ["fallback"]);
    expect(r).toEqual(["fallback"]);
  });
  it("throw cuando es error genérico (no missing table)", async () => {
    const err = { code: "23505", message: "duplicate key" };
    await expect(
      withFallback(Promise.resolve({ data: null, error: err }), [])
    ).rejects.toEqual(err);
  });
});
