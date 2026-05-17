import { describe, it, expect } from "vitest";
import { isSessionActive } from "../../signal-engine/session-guard";

describe("session-guard", () => {
  describe("isSessionActive", () => {
    it("CLOSED en domingo", () => {
      const sunday = new Date("2026-05-03T12:00:00Z"); // Sunday
      const r = isSessionActive(sunday);
      expect(r.active).toBe(false);
      expect(r.session).toBe("CLOSED");
      expect(r.minutesUntilClose).toBe(0);
    });

    it("CLOSED en sábado", () => {
      const saturday = new Date("2026-05-02T12:00:00Z"); // Saturday
      const r = isSessionActive(saturday);
      expect(r.active).toBe(false);
      expect(r.session).toBe("CLOSED");
    });

    it("LONDON entre 08:00 y 13:00 UTC en día laboral", () => {
      const mondayLondon = new Date("2026-05-04T10:00:00Z"); // Monday 10am UTC
      const r = isSessionActive(mondayLondon);
      expect(r.active).toBe(true);
      expect(r.session).toBe("LONDON");
      expect(r.minutesUntilClose).toBeGreaterThan(0);
    });

    it("OVERLAP entre 13:00 y 17:00 UTC en día laboral", () => {
      const mondayOverlap = new Date("2026-05-04T14:30:00Z"); // Monday 14:30 UTC
      const r = isSessionActive(mondayOverlap);
      expect(r.active).toBe(true);
      expect(r.session).toBe("OVERLAP");
      // 17:00 - 14:30 = 150 min
      expect(r.minutesUntilClose).toBe(150);
    });

    it("NY entre 17:00 y 22:00 UTC en día laboral", () => {
      const mondayNY = new Date("2026-05-04T18:00:00Z"); // Monday 18:00 UTC
      const r = isSessionActive(mondayNY);
      expect(r.active).toBe(true);
      expect(r.session).toBe("NY");
      // 22:00 - 18:00 = 240 min
      expect(r.minutesUntilClose).toBe(240);
    });

    it("CLOSED después de 22:00 UTC en día laboral", () => {
      const mondayClosed = new Date("2026-05-04T23:00:00Z");
      const r = isSessionActive(mondayClosed);
      expect(r.active).toBe(false);
      expect(r.session).toBe("CLOSED");
    });

    it("CLOSED antes de 08:00 UTC en día laboral", () => {
      const mondayPreOpen = new Date("2026-05-04T05:00:00Z");
      const r = isSessionActive(mondayPreOpen);
      expect(r.active).toBe(false);
      expect(r.session).toBe("CLOSED");
    });

    it("transición OVERLAP → NY justo en 17:00", () => {
      const at17 = new Date("2026-05-04T17:00:00Z");
      const r = isSessionActive(at17);
      // 17:00 ya no es overlap (cerrado en LONDON_CLOSE), entonces es NY
      expect(r.session).toBe("NY");
      expect(r.active).toBe(true);
    });
  });
});
