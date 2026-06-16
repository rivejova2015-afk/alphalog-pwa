import { describe, it, expect } from "vitest";
import { isMarketHours, nextMarketOpen, isGlobexOpen, isPastCutoffEt, nowEtHHMM } from "../market-hours";

describe("market-hours", () => {
  describe("isMarketHours", () => {
    it("falso en domingo (cualquier hora)", () => {
      const sunday = new Date("2026-05-03T15:00:00Z");
      expect(isMarketHours(sunday)).toBe(false);
    });

    it("falso en sábado", () => {
      const saturday = new Date("2026-05-02T18:00:00Z");
      expect(isMarketHours(saturday)).toBe(false);
    });

    it("verdadero durante RTH (durante DST): 10:00 ET = 14:00 UTC", () => {
      // May = DST activo. 14:00 UTC = 10:00 ET (UTC-4)
      const monday = new Date("2026-05-04T14:00:00Z");
      expect(isMarketHours(monday)).toBe(true);
    });

    it("verdadero a 16:14 ET (justo antes del close)", () => {
      // 16:14 ET = 20:14 UTC durante DST
      const monday = new Date("2026-05-04T20:14:00Z");
      expect(isMarketHours(monday)).toBe(true);
    });

    it("falso a 16:15 ET (close exacto)", () => {
      // 16:15 ET = 20:15 UTC durante DST
      const monday = new Date("2026-05-04T20:15:00Z");
      expect(isMarketHours(monday)).toBe(false);
    });

    it("falso a 09:29 ET (antes de open)", () => {
      // 09:29 ET = 13:29 UTC durante DST
      const monday = new Date("2026-05-04T13:29:00Z");
      expect(isMarketHours(monday)).toBe(false);
    });

    it("verdadero a 09:30 ET exacto (open)", () => {
      // 09:30 ET = 13:30 UTC durante DST
      const monday = new Date("2026-05-04T13:30:00Z");
      expect(isMarketHours(monday)).toBe(true);
    });

    it("maneja Standard Time (no DST): enero", () => {
      // Enero: STD time. 10:00 ET = 15:00 UTC (UTC-5)
      const jan = new Date("2026-01-05T15:00:00Z"); // lunes
      expect(isMarketHours(jan)).toBe(true);
    });

    it("falso pre-open en Standard Time", () => {
      // 09:00 ET en STD = 14:00 UTC
      const jan = new Date("2026-01-05T14:00:00Z"); // lunes
      expect(isMarketHours(jan)).toBe(false);
    });
  });

  describe("isGlobexOpen", () => {
    it("falso en sábado (cerrado todo el día)", () => {
      const sat = new Date("2026-05-02T18:00:00Z");
      expect(isGlobexOpen(sat)).toBe(false);
    });

    it("falso domingo antes de 18:00 ET (open de la semana)", () => {
      // Domingo 17:59 ET (DST) = 21:59 UTC
      const sun = new Date("2026-05-03T21:59:00Z");
      expect(isGlobexOpen(sun)).toBe(false);
    });

    it("verdadero domingo a partir de 18:00 ET", () => {
      // Domingo 18:00 ET (DST) = 22:00 UTC
      const sun = new Date("2026-05-03T22:00:00Z");
      expect(isGlobexOpen(sun)).toBe(true);
    });

    it("verdadero lunes 10:00 ET (RTH window)", () => {
      const mon = new Date("2026-05-04T14:00:00Z");
      expect(isGlobexOpen(mon)).toBe(true);
    });

    it("falso lunes 17:30 ET (daily maintenance)", () => {
      // Lunes 17:30 ET (DST) = 21:30 UTC
      const mon = new Date("2026-05-04T21:30:00Z");
      expect(isGlobexOpen(mon)).toBe(false);
    });

    it("verdadero lunes 18:00 ET (reapertura post-maintenance)", () => {
      const mon = new Date("2026-05-04T22:00:00Z");
      expect(isGlobexOpen(mon)).toBe(true);
    });

    it("falso viernes 17:30 ET (cerró para fin de semana)", () => {
      // Viernes 17:30 ET (DST) = 21:30 UTC
      const fri = new Date("2026-05-08T21:30:00Z");
      expect(isGlobexOpen(fri)).toBe(false);
    });

    it("verdadero viernes 16:00 ET (todavía abierto pre-cierre)", () => {
      const fri = new Date("2026-05-08T20:00:00Z");
      expect(isGlobexOpen(fri)).toBe(true);
    });
  });

  describe("nextMarketOpen", () => {
    it("retorna `now` cuando ya está abierto", () => {
      const monday = new Date("2026-05-04T14:00:00Z"); // 10:00 ET, abierto
      const r = nextMarketOpen(monday);
      expect(r.getTime()).toBe(monday.getTime());
    });

    it("retorna el siguiente lunes 09:30 ET cuando es sábado", () => {
      const saturday = new Date("2026-05-02T18:00:00Z");
      const r = nextMarketOpen(saturday);
      // El próximo open es lunes 2026-05-04 09:30 ET = 13:30 UTC (DST)
      expect(r.getUTCDay()).toBe(1); // Monday
      expect(r.getUTCHours()).toBe(13);
      expect(r.getUTCMinutes()).toBe(30);
    });

    it("retorna el mismo día 09:30 ET cuando es lunes pre-open", () => {
      const mondayPre = new Date("2026-05-04T10:00:00Z"); // 06:00 ET
      const r = nextMarketOpen(mondayPre);
      expect(r.getUTCDay()).toBe(1);
      expect(r.getUTCHours()).toBe(13); // 09:30 ET = 13:30 UTC DST
    });

    it("retorna el siguiente día laboral cuando es viernes post-close", () => {
      const fridayPost = new Date("2026-05-08T22:00:00Z"); // 18:00 ET viernes
      const r = nextMarketOpen(fridayPost);
      // Siguiente open = lunes 2026-05-11
      expect(r.getUTCDay()).toBe(1); // Monday
    });
  });

  describe("isPastCutoffEt", () => {
    // Junio 2026 está en DST → ET = UTC-4. 17:00 ET = 21:00 UTC.
    it("Apex 16:59 ET: false a las 16:50 ET (antes)", () => {
      // 16:50 ET = 20:50 UTC en Junio (DST)
      const t = new Date("2026-06-15T20:50:00Z");
      expect(isPastCutoffEt(t, "16:59")).toBe(false);
    });

    it("Apex 16:59 ET: true a las 17:00 ET (después)", () => {
      const t = new Date("2026-06-15T21:00:00Z");
      expect(isPastCutoffEt(t, "16:59")).toBe(true);
    });

    it("Lucid 16:45 ET: true a las 16:46 ET, false a las 16:44 ET", () => {
      const at1646 = new Date("2026-06-15T20:46:00Z");
      const at1644 = new Date("2026-06-15T20:44:00Z");
      expect(isPastCutoffEt(at1646, "16:45")).toBe(true);
      expect(isPastCutoffEt(at1644, "16:45")).toBe(false);
    });

    it("weekend cuenta como past cutoff (no se permiten órdenes)", () => {
      const saturday = new Date("2026-06-13T15:00:00Z");
      expect(isPastCutoffEt(saturday, "16:59")).toBe(true);
    });

    it("formato inválido → false (no bloquea defensivamente)", () => {
      const t = new Date("2026-06-15T18:00:00Z");
      expect(isPastCutoffEt(t, "garbage")).toBe(false);
      expect(isPastCutoffEt(t, "25:99")).toBe(false);
    });

    it("respeta el cambio DST (invierno)", () => {
      // Enero está en STD → ET = UTC-5. 17:00 ET = 22:00 UTC.
      const at1659EST = new Date("2026-01-15T21:59:00Z"); // 16:59 ET
      expect(isPastCutoffEt(at1659EST, "16:59")).toBe(true);
      const at1650EST = new Date("2026-01-15T21:50:00Z"); // 16:50 ET
      expect(isPastCutoffEt(at1650EST, "16:59")).toBe(false);
    });
  });

  describe("nowEtHHMM", () => {
    it("formatea hora ET en DST correctamente", () => {
      const t = new Date("2026-06-15T20:30:00Z"); // 16:30 ET DST
      expect(nowEtHHMM(t)).toBe("16:30");
    });

    it("formatea hora ET en STD correctamente", () => {
      const t = new Date("2026-01-15T21:00:00Z"); // 16:00 ET STD
      expect(nowEtHHMM(t)).toBe("16:00");
    });

    it("zero-pads minutos < 10", () => {
      const t = new Date("2026-06-15T13:35:00Z"); // 09:35 ET DST
      expect(nowEtHHMM(t)).toBe("09:35");
    });
  });
});
