import { describe, it, expect } from "vitest";
import { validatePulse } from "../../arbitrage/pulse-validator";
import { makeArbTick, makeSkewSignal, makePulseConfig, makePulseTicksAligned } from "../fixtures";

describe("pulse-validator", () => {
  describe("validatePulse", () => {
    it("retorna invalid cuando hay menos ticks que min_pulse_ticks", () => {
      const signal = makeSkewSignal();
      const ticks = makePulseTicksAligned("BUY", 3, 2000, signal.detected_at);
      const r = validatePulse(ticks, signal, makePulseConfig({ min_pulse_ticks: 5 }));
      expect(r.valid).toBe(false);
      expect(r.reason).toContain("ticks en ventana");
    });

    it("retorna valid cuando 100% de deltas alineados con BUY", () => {
      const signal = makeSkewSignal({ direction: "BUY" });
      const ticks = makePulseTicksAligned("BUY", 6, 2000, signal.detected_at);
      const r = validatePulse(ticks, signal, makePulseConfig({ min_alignment: 0.8 }));
      expect(r.valid).toBe(true);
      expect(r.alignment).toBe(1);
      expect(r.ticks_used).toBe(6);
    });

    it("retorna valid cuando 100% de deltas alineados con SELL", () => {
      const signal = makeSkewSignal({ direction: "SELL" });
      const ticks = makePulseTicksAligned("SELL", 6, 2000, signal.detected_at);
      const r = validatePulse(ticks, signal, makePulseConfig({ min_alignment: 0.8 }));
      expect(r.valid).toBe(true);
      expect(r.alignment).toBe(1);
    });

    it("retorna invalid cuando deltas opuestos al signal", () => {
      const signal = makeSkewSignal({ direction: "BUY" });
      // SELL ticks pero signal BUY → alignment = 0
      const ticks = makePulseTicksAligned("SELL", 6, 2000, signal.detected_at);
      const r = validatePulse(ticks, signal, makePulseConfig({ min_alignment: 0.8 }));
      expect(r.valid).toBe(false);
      expect(r.alignment).toBe(0);
    });

    it("retorna invalid cuando todos los ticks son idénticos (zero deltas)", () => {
      const signal = makeSkewSignal({ direction: "BUY", detected_at: 1000 });
      const ticks = Array.from({ length: 6 }, (_, i) =>
        makeArbTick({ bid: 2000, ask: 2000.02, ts_ms: 900 + i * 10 })
      );
      const r = validatePulse(ticks, signal, makePulseConfig());
      expect(r.valid).toBe(false);
      expect(r.reason).toContain("zero deltas");
    });

    it("filtra ticks fuera de la ventana pulse_window_ms", () => {
      const signal = makeSkewSignal({ direction: "BUY", detected_at: 10_000 });
      const insideWindow = makePulseTicksAligned("BUY", 6, 2000, 10_000);
      const outsideWindow = makePulseTicksAligned("BUY", 6, 2000, 5_000); // 5s antes
      const r = validatePulse(
        [...insideWindow, ...outsideWindow],
        signal,
        makePulseConfig({ pulse_window_ms: 2000 })
      );
      // Sólo cuenta los 6 dentro de la ventana
      expect(r.ticks_used).toBe(6);
    });

    it("filtra ticks de símbolos distintos", () => {
      const signal = makeSkewSignal({ symbol: "XAUUSD", direction: "BUY" });
      const xauTicks = makePulseTicksAligned("BUY", 6, 2000, signal.detected_at);
      const eurTicks = xauTicks.map((t) => ({ ...t, symbol: "EURUSD" }));
      const r = validatePulse([...xauTicks, ...eurTicks], signal, makePulseConfig());
      // Sólo cuenta los XAUUSD
      expect(r.ticks_used).toBe(6);
    });

    it("alignment exactamente en el threshold = valid", () => {
      const signal = makeSkewSignal({ direction: "BUY" });
      // 4 alineados + 1 opuesto = 0.8 alignment
      const ticks = [
        ...makePulseTicksAligned("BUY", 5, 2000, signal.detected_at),
      ];
      // Modificar el último para opuesto: hacer que delta sea negativo
      ticks[4] = { ...ticks[4], bid: ticks[3].bid - 0.05 };
      const r = validatePulse(ticks, signal, makePulseConfig({ min_alignment: 0.75 }));
      expect(r.valid).toBe(true);
    });
  });
});
