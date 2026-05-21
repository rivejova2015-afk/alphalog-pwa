import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  detectVersionConflict,
  detectContentConflict,
  detectDeleteConflict,
  resolveLastWriteWins,
  resolveClientPreference,
  resolveManualMerge,
  resolveAbort,
  autoResolveConflict,
  ConflictMetrics,
  createRollbackSnapshot,
  rollbackToSnapshot,
} from "../conflict-resolution";

// ─── Detection ──────────────────────────────────────────────────────────────

describe("detectVersionConflict", () => {
  it("hasConflict=false cuando versiones coinciden", () => {
    const r = detectVersionConflict(1, 1, {}, {});
    expect(r.hasConflict).toBe(false);
    expect(r.type).toBe("none");
  });

  it("hasConflict=true cuando versiones difieren", () => {
    const r = detectVersionConflict(1, 2, { a: 1 }, { a: 2 });
    expect(r.hasConflict).toBe(true);
    expect(r.type).toBe("version-mismatch");
    expect(r.suggestedResolution).toBe("last-write-wins");
  });
});

describe("detectContentConflict", () => {
  it("hasConflict=false cuando todos los campos coinciden", () => {
    const data = { foo: "bar", baz: 1 };
    expect(detectContentConflict(data, data).hasConflict).toBe(false);
  });

  it("hasConflict=true cuando un campo difiere", () => {
    const r = detectContentConflict({ foo: "a" }, { foo: "b" });
    expect(r.hasConflict).toBe(true);
    expect(r.type).toBe("content-mismatch");
    expect(r.suggestedResolution).toBe("manual-merge");
  });

  it("ignora campos protegidos (id, user_id, created_at, deleted_at)", () => {
    const r = detectContentConflict(
      { id: "a", user_id: "u1", foo: "same" },
      { id: "b", user_id: "u2", foo: "same" },
    );
    expect(r.hasConflict).toBe(false);
  });

  it("acepta protectedFields custom", () => {
    const r = detectContentConflict(
      { custom_field: "a", foo: "same" },
      { custom_field: "b", foo: "same" },
      ["custom_field"],
    );
    expect(r.hasConflict).toBe(false);
  });
});

describe("detectDeleteConflict", () => {
  it("hasConflict=false cuando ambos deleted (o ambos no-deleted)", () => {
    expect(detectDeleteConflict(true, true, {}, {}).hasConflict).toBe(false);
    expect(detectDeleteConflict(false, false, {}, {}).hasConflict).toBe(false);
  });

  it("hasConflict=true cuando client deleted pero server activo (o viceversa)", () => {
    expect(detectDeleteConflict(true, false, {}, {}).hasConflict).toBe(true);
    expect(detectDeleteConflict(false, true, {}, {}).hasConflict).toBe(true);
  });
});

// ─── Resolution Strategies ──────────────────────────────────────────────────

describe("resolveLastWriteWins", () => {
  it("usa serverData como mergedData", () => {
    const r = resolveLastWriteWins({ x: 1 }, { x: 2 });
    expect(r.mergedData).toEqual({ x: 2 });
    expect(r.strategy).toBe("last-write-wins");
    expect(r.resolved).toBe(true);
  });

  it("genera conflictId UUID + timestamp ISO", () => {
    const r = resolveLastWriteWins({}, {});
    expect(r.conflictId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(r.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("resolveClientPreference", () => {
  it("usa clientData como mergedData", () => {
    const r = resolveClientPreference({ x: 1 }, { x: 2 });
    expect(r.mergedData).toEqual({ x: 1 });
    expect(r.strategy).toBe("client-preference");
  });
});

describe("resolveManualMerge", () => {
  it("same-value se mantiene; conflictivo usa server", () => {
    const client = { foo: "client", same: 1 };
    const server = { foo: "server", same: 1 };
    const r = resolveManualMerge(client, server);
    expect(r.mergedData.same).toBe(1);
    expect(r.mergedData.foo).toBe("server");
  });

  it("merged base es server (fields que sólo existen en server se preservan)", () => {
    const r = resolveManualMerge({ x: 1 }, { x: 1, extraServer: "y" });
    expect(r.mergedData.extraServer).toBe("y");
  });

  it("notes lista los conflicting fields", () => {
    const r = resolveManualMerge({ foo: "a", bar: "b" }, { foo: "x", bar: "b" });
    expect(r.notes).toContain("foo");
    expect(r.notes).not.toContain("bar");
  });

  it("respeta protectedFields default (id, user_id, created_at, version)", () => {
    const r = resolveManualMerge(
      { id: "client-id", foo: "different" },
      { id: "server-id", foo: "different" },
    );
    // id es protected → no se considera conflict
    expect(r.notes).not.toContain("id,");
  });
});

describe("resolveAbort", () => {
  it("resolved=false con mergedData vacío", () => {
    const r = resolveAbort({ a: 1 }, { a: 2 });
    expect(r.resolved).toBe(false);
    expect(r.mergedData).toEqual({});
    expect(r.strategy).toBe("abort");
  });
});

// ─── Auto Resolution ────────────────────────────────────────────────────────

describe("autoResolveConflict", () => {
  it("no conflict → resolved=true con serverData", async () => {
    const detection = detectVersionConflict(1, 1, { x: 1 }, { x: 1 });
    const r = await autoResolveConflict(detection);
    expect(r.resolved).toBe(true);
    expect(r.notes).toContain("No conflict");
  });

  it("usa suggestedResolution por default", async () => {
    const detection = detectVersionConflict(1, 2, { v: 1 }, { v: 2 });
    const r = await autoResolveConflict(detection);
    expect(r.strategy).toBe("last-write-wins");
  });

  it("strategy override en options.strategy", async () => {
    const detection = detectVersionConflict(1, 2, { v: 1 }, { v: 2 });
    const r = await autoResolveConflict(detection, { strategy: "client-preference" });
    expect(r.strategy).toBe("client-preference");
    expect(r.mergedData).toEqual({ v: 1 });
  });

  it("strategy=abort no-resuelve", async () => {
    const detection = detectVersionConflict(1, 2, {}, {});
    const r = await autoResolveConflict(detection, { strategy: "abort" });
    expect(r.resolved).toBe(false);
  });
});

// ─── ConflictMetrics ────────────────────────────────────────────────────────

describe("ConflictMetrics", () => {
  let metrics: ConflictMetrics;

  beforeEach(() => {
    metrics = new ConflictMetrics();
  });

  it("estado inicial: 0 conflicts, successRate=100", () => {
    const m = metrics.getMetrics();
    expect(m.totalConflicts).toBe(0);
    expect(m.successRate).toBe(100);
  });

  it("record incrementa el counter de strategy correspondiente", () => {
    metrics.record(resolveLastWriteWins({}, {}));
    metrics.record(resolveLastWriteWins({}, {}));
    metrics.record(resolveClientPreference({}, {}));
    const m = metrics.getMetrics();
    expect(m.resolutions["last-write-wins"]).toBe(2);
    expect(m.resolutions["client-preference"]).toBe(1);
    expect(m.totalConflicts).toBe(3);
  });

  it("successRate refleja resolved=true / total", () => {
    metrics.record(resolveLastWriteWins({}, {}));
    metrics.record(resolveAbort({}, {}));
    const m = metrics.getMetrics();
    expect(m.successRate).toBe(50);
  });

  it("clear resetea conflicts y counts", () => {
    metrics.record(resolveLastWriteWins({}, {}));
    metrics.clear();
    expect(metrics.getMetrics().totalConflicts).toBe(0);
    expect(metrics.getMetrics().resolutions["last-write-wins"]).toBe(0);
  });
});

// ─── Rollback ───────────────────────────────────────────────────────────────

describe("createRollbackSnapshot", () => {
  it("retorna snapshot con todos los campos", () => {
    const s = createRollbackSnapshot("e1", "trades", "update", { v: 1 }, { v: 2 }, "c1");
    expect(s.entityId).toBe("e1");
    expect(s.table).toBe("trades");
    expect(s.operation).toBe("update");
    expect(s.dataBeforeChange).toEqual({ v: 1 });
    expect(s.dataAfterChange).toEqual({ v: 2 });
    expect(s.conflictId).toBe("c1");
    expect(s.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("rollbackToSnapshot", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("happy path: PATCH al endpoint con payload restored", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    const snap = createRollbackSnapshot("e1", "trades", "update", { foo: "before", id: "e1" }, { foo: "after" }, "c1");
    await rollbackToSnapshot(snap);
    expect(global.fetch).toHaveBeenCalledOnce();
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/alphacore/trades/e1/update");
    expect((init as { method: string }).method).toBe("PATCH");
    const body = JSON.parse((init as { body: string }).body);
    expect(body.payload.foo).toBe("before");
    // id/user_id/created_at se strippean
    expect(body.payload.id).toBeUndefined();
    expect(body.metadata.source).toBe("conflict_rollback");
  });

  it("throw cuando response.ok=false", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ message: "Server error" }),
    });
    const snap = createRollbackSnapshot("e1", "trades", "update", {}, {}, "c1");
    await expect(rollbackToSnapshot(snap)).rejects.toThrow(/Rollback failed.*Server error/);
  });

  it("usa fallback message cuando errorData no tiene .message", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({}),
    });
    const snap = createRollbackSnapshot("e1", "trades", "update", {}, {}, "c1");
    await expect(rollbackToSnapshot(snap)).rejects.toThrow(/HTTP 404/);
  });
});
