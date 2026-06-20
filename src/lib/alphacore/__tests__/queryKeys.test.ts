import { describe, it, expect } from "vitest";
import {
  queryKeys,
  serializeKey,
  getInvalidationPattern,
  matchesPattern,
  commonQueries,
} from "../queryKeys";

describe("queryKeys factory", () => {
  describe("queryKeys.list", () => {
    it("retorna QueryKey con scope='list' y filters default {}", () => {
      const k = queryKeys.list("tradehub", "accounts");
      expect(k.scope).toBe("list");
      expect(k.module).toBe("tradehub");
      expect(k.table).toBe("accounts");
      expect(k.filters).toEqual({});
    });

    it("acepta filters + subsection", () => {
      const k = queryKeys.list("business", "business_costs", { period: "2026-05" }, "decisions");
      expect(k.filters).toEqual({ period: "2026-05" });
      expect(k.subsection).toBe("decisions");
    });
  });

  describe("queryKeys.detail", () => {
    it("incluye entityId", () => {
      const k = queryKeys.detail("tradehub", "accounts", "uuid-123");
      expect(k.scope).toBe("detail");
      expect(k.entityId).toBe("uuid-123");
    });
  });

  describe("queryKeys.aggregate", () => {
    it("scope='aggregate' con filters", () => {
      const k = queryKeys.aggregate("treasury", "treasury_transactions", { type: "withdrawal" });
      expect(k.scope).toBe("aggregate");
      expect(k.filters).toEqual({ type: "withdrawal" });
    });
  });
});

describe("serializeKey", () => {
  it("array básico [scope, module, table] sin extras", () => {
    expect(serializeKey(queryKeys.list("tradehub", "accounts"))).toEqual([
      "list",
      "tradehub",
      "accounts",
    ]);
  });

  it("incluye subsection en posición correcta", () => {
    const arr = serializeKey(queryKeys.list("business", "costs", undefined, "decisions"));
    expect(arr).toContain("decisions");
  });

  it("incluye entityId para detail keys", () => {
    const arr = serializeKey(queryKeys.detail("tradehub", "accounts", "abc"));
    expect(arr).toContain("abc");
  });

  it("incluye filters object cuando no está vacío", () => {
    const arr = serializeKey(queryKeys.list("tradehub", "accounts", { trash: true }));
    expect(arr.some((p) => typeof p === "object" && p !== null && "trash" in p)).toBe(true);
  });

  it("omite filters vacío del array", () => {
    const arr = serializeKey(queryKeys.list("tradehub", "accounts"));
    expect(arr).toEqual(["list", "tradehub", "accounts"]);
  });
});

describe("getInvalidationPattern", () => {
  it("retorna 2 patterns (list + aggregate)", () => {
    const r = getInvalidationPattern("tradehub", "accounts");
    expect(r).toHaveLength(2);
    expect(r[0][0]).toBe("list");
    expect(r[1][0]).toBe("aggregate");
  });

  it("acepta subsection opcional", () => {
    const r = getInvalidationPattern("business", "costs", "kpis");
    expect(r[0]).toContain("kpis");
  });
});

describe("matchesPattern", () => {
  it("match exacto strings → true", () => {
    expect(matchesPattern(
      ["list", "tradehub", "accounts"],
      ["list", "tradehub", "accounts"],
    )).toBe(true);
  });

  it("pattern más corto = prefix match → true", () => {
    expect(matchesPattern(
      ["list", "tradehub", "accounts", { trash: false }],
      ["list", "tradehub"],
    )).toBe(true);
  });

  it("pattern más largo que key → false", () => {
    expect(matchesPattern(
      ["list", "tradehub"],
      ["list", "tradehub", "accounts"],
    )).toBe(false);
  });

  it("diferencia en string → false", () => {
    expect(matchesPattern(
      ["list", "tradehub", "accounts"],
      ["list", "business", "accounts"],
    )).toBe(false);
  });

  it("partial object match — pattern.trash matches en key.{trash, foo}", () => {
    expect(matchesPattern(
      ["list", "tradehub", "accounts", { trash: false, foo: "x" }],
      ["list", "tradehub", "accounts", { trash: false }],
    )).toBe(true);
  });

  it("partial object mismatch → false", () => {
    expect(matchesPattern(
      ["list", "tradehub", "accounts", { trash: false }],
      ["list", "tradehub", "accounts", { trash: true }],
    )).toBe(false);
  });
});

describe("commonQueries", () => {
  it("accounts.list usa scope=list, module=tradehub, table=accounts", () => {
    const k = commonQueries.accounts.list();
    expect(k.module).toBe("tradehub");
    expect(k.table).toBe("accounts");
    expect(k.scope).toBe("list");
  });

  it("accounts.listTrash incluye filter { trash: true }", () => {
    const k = commonQueries.accounts.listTrash();
    expect(k.filters).toEqual({ trash: true });
  });

  it("trades.list con accountId genera filtro", () => {
    const k = commonQueries.trades.list("acc-1");
    expect(k.filters).toEqual({ accountId: "acc-1" });
  });

  it("trades.list sin accountId genera filtro vacío", () => {
    const k = commonQueries.trades.list();
    expect(k.filters).toEqual({});
  });

  it("appLogs.topBugs es aggregate con groupBy + days", () => {
    const k = commonQueries.appLogs.topBugs();
    expect(k.scope).toBe("aggregate");
    expect(k.filters).toMatchObject({ groupBy: "fingerprint", days: 7 });
  });

});
