import { describe, it, expect } from "vitest";
import { buildHourlyVolumeProfile, sliceWeightsFromHourlyProfile } from "../volume-profile";
import type { Bar } from "@/types/backtest";

function bar(ts: string, volume: number): Bar {
  return { ts, open: 1, high: 1, low: 1, close: 1, volume };
}

describe("buildHourlyVolumeProfile", () => {
  it("promedia volumen por hora UTC across múltiples días", () => {
    const bars = [
      bar("2026-06-15T14:00:00Z", 100), // hora 14
      bar("2026-06-16T14:00:00Z", 200), // hora 14, otro día
      bar("2026-06-15T20:00:00Z", 50),  // hora 20
    ];
    const profile = buildHourlyVolumeProfile(bars);
    expect(profile).toHaveLength(24);
    expect(profile[14]).toBeCloseTo(150, 5); // (100+200)/2
    expect(profile[20]).toBeCloseTo(50, 5);
    expect(profile[0]).toBe(0); // sin datos
  });

  it("[] de entrada → perfil todo en cero", () => {
    const profile = buildHourlyVolumeProfile([]);
    expect(profile).toHaveLength(24);
    expect(profile.every((v) => v === 0)).toBe(true);
  });

  it("ignora timestamps inválidos sin throw", () => {
    const bars = [bar("not-a-date", 100), bar("2026-06-15T14:00:00Z", 50)];
    const profile = buildHourlyVolumeProfile(bars);
    expect(profile[14]).toBeCloseTo(50, 5);
  });
});

describe("sliceWeightsFromHourlyProfile", () => {
  it("mapea cada slice al peso de su hora UTC programada", () => {
    const hourly = new Array(24).fill(0);
    hourly[10] = 100;
    hourly[11] = 50;

    // 2 slices, 60 min de duración, empezando a las 10:00 UTC → slice 0 en
    // hora 10, slice 1 (60min después) en hora 11.
    const startAt = new Date("2026-06-15T10:00:00Z");
    const weights = sliceWeightsFromHourlyProfile(hourly, 2, 60, startAt);
    expect(weights).toEqual([100, 50]);
  });

  it("sliceCount=1 → un solo peso, en la hora de startAt", () => {
    const hourly = new Array(24).fill(0);
    hourly[9] = 42;
    const weights = sliceWeightsFromHourlyProfile(hourly, 1, 20, new Date("2026-06-15T09:00:00Z"));
    expect(weights).toEqual([42]);
  });

  it("sliceCount < 1 → []", () => {
    expect(sliceWeightsFromHourlyProfile([], 0, 20, new Date())).toEqual([]);
  });

  it("hora sin datos en el profile → peso 0", () => {
    const hourly = new Array(24).fill(0);
    const weights = sliceWeightsFromHourlyProfile(hourly, 3, 40, new Date("2026-06-15T00:00:00Z"));
    expect(weights).toEqual([0, 0, 0]);
  });
});
