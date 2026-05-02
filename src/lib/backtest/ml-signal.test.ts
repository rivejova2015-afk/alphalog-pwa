import { describe, expect, it } from 'vitest';
import { buildLabels, extractFeatures, predict, trainModel } from './ml-signal';
import type { Bar } from '@/types/backtest';

function makeBars(n: number): Bar[] {
  return Array.from({ length: n }, (_, i) => {
    const c = 100 + Math.sin(i / 5) * 2 + i * 0.05;
    return {
      ts: new Date(2026, 0, 1, 0, i).toISOString(),
      open: c - 0.05, high: c + 0.1, low: c - 0.1, close: c, volume: 1000,
    };
  });
}

describe('ml-signal', () => {
  it('extractFeatures returns one vector per bar with all keys', () => {
    const bars = makeBars(60);
    const feats = extractFeatures(bars);
    expect(feats.length).toBe(60);
    expect(feats[30]).toMatchObject({
      rsi14: expect.any(Number),
      atr14: expect.any(Number),
      emaSlope20: expect.any(Number),
      hourOfDay: expect.any(Number),
      bodyRatio: expect.any(Number),
      upperWickRatio: expect.any(Number),
      lowerWickRatio: expect.any(Number),
    });
  });

  it('buildLabels produces 0/1 binary labels', () => {
    const bars = makeBars(50);
    const labels = buildLabels(bars, 5, 0.001);
    expect(labels.length).toBe(50);
    expect(labels.every((l) => l === 0 || l === 1)).toBe(true);
  });

  it('trainModel produces a model whose predict outputs probabilities in [0,1]', () => {
    const bars = makeBars(120);
    const feats = extractFeatures(bars);
    const labels = buildLabels(bars, 5, 0.001);
    const model = trainModel(feats, labels, { epochs: 50, lr: 0.1 });
    expect(model.weights.length).toBe(7);
    expect(model.featureMeans.length).toBe(7);
    expect(model.featureStds.length).toBe(7);
    const p = predict(model, feats[60]);
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThanOrEqual(1);
  });
});
