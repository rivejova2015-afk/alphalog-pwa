import { describe, it, expect } from "vitest";
import { isMarketHours, nextMarketOpen } from "../market-hours";

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
});
