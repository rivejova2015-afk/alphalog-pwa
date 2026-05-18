import { describe, it, expect, beforeEach } from "vitest";
import { BossAttemptLogger } from "../bossAttemptLog";
import { replayProgress, type ProgressEvent } from "../progressReplay";
import { getDailyMicroActions } from "../questMicroPlanner";
import { RecoveryPlaybook } from "../recoveryPlaybookNode";
import { ThresholdVersioning, type ThresholdPreset } from "../thresholdPresets";

// ─── BossAttemptLogger ───────────────────────────────────────────────────────

describe("BossAttemptLogger", () => {
  let logger: BossAttemptLogger;

  beforeEach(() => {
    logger = new BossAttemptLogger();
  });

  it("logAttempt registra un intento con id único y timestamp", () => {
    logger.logAttempt("boss-1", "gate-A", "win_rate < 50%");
    const attempts = logger.getAttemptsForBoss("boss-1");
    expect(attempts).toHaveLength(1);
    expect(attempts[0].bossId).toBe("boss-1");
    expect(attempts[0].failedGate).toBe("gate-A");
    expect(attempts[0].failedMetric).toBe("win_rate < 50%");
    expect(attempts[0].id).toMatch(/^boss-1-\d+$/);
    expect(attempts[0].timestamp).toBeInstanceOf(Date);
  });

  it("getAttemptsForBoss filtra correctamente por bossId", () => {
    logger.logAttempt("boss-1", "g1", "m1");
    logger.logAttempt("boss-2", "g2", "m2");
    logger.logAttempt("boss-1", "g3", "m3");
    expect(logger.getAttemptsForBoss("boss-1")).toHaveLength(2);
    expect(logger.getAttemptsForBoss("boss-2")).toHaveLength(1);
    expect(logger.getAttemptsForBoss("boss-3")).toHaveLength(0);
  });

  it("sin intentos retorna array vacío", () => {
    expect(logger.getAttemptsForBoss("any")).toEqual([]);
  });
});

// ─── replayProgress ──────────────────────────────────────────────────────────

describe("replayProgress", () => {
  function makeEvent(id: string, date: string, type = "xp", value = 10): ProgressEvent {
    return { id, type, value, timestamp: new Date(date) };
  }

  it("filtra eventos dentro del rango [from, to]", () => {
    const events = [
      makeEvent("a", "2026-05-01"),
      makeEvent("b", "2026-05-15"),
      makeEvent("c", "2026-05-30"),
    ];
    const r = replayProgress(events, new Date("2026-05-10"), new Date("2026-05-20"));
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe("b");
  });

  it("incluye eventos exactamente en el borde (from y to inclusive)", () => {
    const events = [
      makeEvent("from", "2026-05-10"),
      makeEvent("to", "2026-05-20"),
    ];
    const r = replayProgress(events, new Date("2026-05-10"), new Date("2026-05-20"));
    expect(r).toHaveLength(2);
  });

  it("retorna [] cuando ningún evento cae en el rango", () => {
    const events = [makeEvent("a", "2026-01-01")];
    const r = replayProgress(events, new Date("2026-05-01"), new Date("2026-05-31"));
    expect(r).toEqual([]);
  });

  it("array de eventos vacío → []", () => {
    expect(replayProgress([], new Date(), new Date())).toEqual([]);
  });
});

// ─── getDailyMicroActions ────────────────────────────────────────────────────

describe("getDailyMicroActions", () => {
  it("retorna las 3 micro-acciones fijas (registro, evidencia, control)", () => {
    const r = getDailyMicroActions(new Date());
    expect(r).toHaveLength(3);
    expect(r.map((a) => a.id)).toEqual(["registro", "evidencia", "control"]);
  });

  it("todas las acciones empiezan con completed=false", () => {
    const r = getDailyMicroActions(new Date());
    expect(r.every((a) => a.completed === false)).toBe(true);
  });

  it("acepta cualquier date (no afecta el output)", () => {
    const today = getDailyMicroActions(new Date());
    const future = getDailyMicroActions(new Date("2030-01-01"));
    expect(today.map((a) => a.id)).toEqual(future.map((a) => a.id));
  });
});

// ─── RecoveryPlaybook ────────────────────────────────────────────────────────

describe("RecoveryPlaybook", () => {
  let pb: RecoveryPlaybook;

  beforeEach(() => {
    pb = new RecoveryPlaybook();
  });

  it("addMission agrega misiones con completed=false", () => {
    pb.addMission("Pausar trading 24h");
    pb.addMission("Revisar últimos 20 trades");
    const list = pb.getChecklist();
    expect(list).toHaveLength(2);
    expect(list[0].label).toBe("Pausar trading 24h");
    expect(list[0].completed).toBe(false);
  });

  it("completeMission marca una misión por id", () => {
    pb.addMission("Test mission");
    const id = pb.getChecklist()[0].id;
    pb.completeMission(id);
    expect(pb.getChecklist()[0].completed).toBe(true);
  });

  it("completeMission con id desconocido no rompe", () => {
    pb.addMission("Test");
    expect(() => pb.completeMission("invalid-id")).not.toThrow();
    expect(pb.getChecklist()[0].completed).toBe(false);
  });

  it("getProgress=0 sin misiones", () => {
    expect(pb.getProgress()).toBe(0);
  });

  it("getProgress=1 cuando todas completas", () => {
    pb.addMission("a");
    pb.addMission("b");
    pb.getChecklist().forEach((m) => pb.completeMission(m.id));
    expect(pb.getProgress()).toBe(1);
  });

  it("getProgress proporcional", () => {
    pb.addMission("a");
    pb.addMission("b");
    pb.addMission("c");
    pb.addMission("d");
    pb.completeMission(pb.getChecklist()[0].id);
    expect(pb.getProgress()).toBeCloseTo(0.25, 5);
  });
});

// ─── ThresholdVersioning ─────────────────────────────────────────────────────

describe("ThresholdVersioning", () => {
  let tv: ThresholdVersioning;

  beforeEach(() => {
    tv = new ThresholdVersioning();
  });

  it("addVersion agrega y getLatest retorna la más reciente", () => {
    tv.addVersion("conservador", { dd: 5, risk: 0.5 });
    tv.addVersion("balanceado", { dd: 10, risk: 1.0 });
    const latest = tv.getLatest();
    expect(latest?.preset).toBe("balanceado");
    expect(latest?.values.dd).toBe(10);
  });

  it("getLatest=undefined cuando no hay versiones", () => {
    expect(tv.getLatest()).toBeUndefined();
  });

  it("getAll retorna todas las versiones en orden", () => {
    tv.addVersion("conservador", {});
    tv.addVersion("balanceado", {});
    tv.addVersion("estricto", {});
    const all = tv.getAll();
    expect(all).toHaveLength(3);
    expect(all.map((v) => v.preset)).toEqual(["conservador", "balanceado", "estricto"]);
  });

  it("rollback elimina la última versión", () => {
    tv.addVersion("conservador", {});
    tv.addVersion("balanceado", {});
    tv.rollback();
    expect(tv.getAll()).toHaveLength(1);
    expect(tv.getLatest()?.preset).toBe("conservador");
  });

  it("rollback no elimina la única versión (preserva al menos 1)", () => {
    tv.addVersion("conservador", {});
    tv.rollback();
    expect(tv.getAll()).toHaveLength(1);
  });

  it("rollback sin versiones es seguro (no throw)", () => {
    expect(() => tv.rollback()).not.toThrow();
    expect(tv.getAll()).toEqual([]);
  });

  it("acepta los 3 presets válidos", () => {
    const presets: ThresholdPreset[] = ["conservador", "balanceado", "estricto"];
    for (const p of presets) {
      tv.addVersion(p, { x: 1 });
    }
    expect(tv.getAll().map((v) => v.preset)).toEqual(presets);
  });

  it("cada versión tiene id único y createdAt", () => {
    tv.addVersion("conservador", {});
    const v = tv.getLatest()!;
    expect(v.id).toMatch(/^conservador-\d+$/);
    expect(v.createdAt).toBeInstanceOf(Date);
  });
});
