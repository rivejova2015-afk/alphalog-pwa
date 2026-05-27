import { describe, it, expect } from "vitest";
import { computeVolumeProfile, priceInValueArea } from "../src/validators/volume-profile.js";
import type { PriceSample } from "../src/feeds/coinbase-ws.js";

const sample = (price: number, ts = Date.now()): PriceSample => ({
  price,
  ts,
} as PriceSample);

describe("volume-profile", () => {
  describe("computeVolumeProfile", () => {
    it("returns nulls when sample count is below the 50 threshold", () => {
      const samples = Array.from({ length: 49 }, (_, i) => sample(100 + i));
      const vp = computeVolumeProfile(samples);
      expect(vp.poc).toBeNull();
      expect(vp.vahigh).toBeNull();
      expect(vp.valow).toBeNull();
      expect(vp.confidence).toBe(0);
    });

    it("returns nulls when all samples share the same price (no range)", () => {
      const samples = Array.from({ length: 100 }, () => sample(50));
      const vp = computeVolumeProfile(samples);
      expect(vp.poc).toBeNull();
      expect(vp.confidence).toBe(0);
    });

    it("computes a POC near the cluster center for a bimodal distribution", () => {
      // Heavy cluster at 100 (300 samples) + sparse tail at 200 (60 samples).
      const samples: PriceSample[] = [
        ...Array.from({ length: 300 }, (_, i) => sample(100 + (i % 5) * 0.1)),
        ...Array.from({ length: 60 }, (_, i) => sample(200 + (i % 5) * 0.1)),
      ];
      const vp = computeVolumeProfile(samples);
      expect(vp.poc).not.toBeNull();
      // POC should land in the dense cluster region, not in the sparse tail
      expect(vp.poc!).toBeLessThan(150);
    });

    it("computes a valid value area that surrounds the POC", () => {
      const samples = Array.from({ length: 200 }, (_, i) => sample(100 + Math.sin(i / 10) * 5));
      const vp = computeVolumeProfile(samples);
      expect(vp.valow).not.toBeNull();
      expect(vp.vahigh).not.toBeNull();
      expect(vp.valow!).toBeLessThanOrEqual(vp.poc!);
      expect(vp.vahigh!).toBeGreaterThanOrEqual(vp.poc!);
    });

    it("confidence saturates at 1.0 when samples >= 500", () => {
      const samples = Array.from({ length: 800 }, (_, i) => sample(100 + (i % 10)));
      const vp = computeVolumeProfile(samples);
      expect(vp.confidence).toBe(1);
    });
  });

  describe("priceInValueArea", () => {
    it("returns true when the profile is empty (no rejection)", () => {
      const empty = { poc: null, vahigh: null, valow: null, confidence: 0 };
      expect(priceInValueArea(123, empty)).toBe(true);
    });

    it("returns true for a price inside [valow, vahigh]", () => {
      const vp = { poc: 100, valow: 95, vahigh: 105, confidence: 1 };
      expect(priceInValueArea(100, vp)).toBe(true);
      expect(priceInValueArea(95, vp)).toBe(true);
      expect(priceInValueArea(105, vp)).toBe(true);
    });

    it("returns false when price is outside the value area", () => {
      const vp = { poc: 100, valow: 95, vahigh: 105, confidence: 1 };
      expect(priceInValueArea(94.99, vp)).toBe(false);
      expect(priceInValueArea(105.01, vp)).toBe(false);
    });
  });
});
