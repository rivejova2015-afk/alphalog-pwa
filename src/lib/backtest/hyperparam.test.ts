import { describe, expect, it } from 'vitest';
import { bestTrial, tpeSearch } from './hyperparam';

describe('hyperparam', () => {
  it('bestTrial returns null on empty', () => {
    expect(bestTrial([])).toBeNull();
  });

  it('bestTrial picks the highest-scoring trial', () => {
    const winner = bestTrial([
      { params: { x: 1 }, score: 0.5 },
      { params: { x: 2 }, score: 1.5 },
      { params: { x: 3 }, score: 0.9 },
    ]);
    expect(winner?.params.x).toBe(2);
  });

  it('tpeSearch converges towards optimum on a simple objective', async () => {
    // Objective: maximize -((x - 5)^2). True optimum at x = 5.
    const trials = await tpeSearch(
      { spaces: { x: { type: 'float', min: 0, max: 10 } }, maxTrials: 30, warmupTrials: 8 },
      async (params) => -((Number(params.x) - 5) ** 2),
    );
    expect(trials.length).toBe(30);
    const best = bestTrial(trials);
    expect(best).not.toBeNull();
    expect(Math.abs(Number(best!.params.x) - 5)).toBeLessThan(3);
  });

  it('tpeSearch handles int and categorical spaces', async () => {
    const trials = await tpeSearch(
      {
        spaces: {
          period: { type: 'int', min: 5, max: 50 },
          mode: { type: 'categorical', choices: ['ema', 'sma'] },
        },
        maxTrials: 12,
      },
      async () => Math.random(),
    );
    for (const t of trials) {
      expect(Number.isInteger(t.params.period)).toBe(true);
      expect(['ema', 'sma']).toContain(t.params.mode);
    }
  });
});
