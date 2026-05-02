// TPE-lite Bayesian hyperparameter search.
// Proper Optuna-style TPE needs Parzen-window KDE; this is a simplified version
// using gamma-best/gamma-rest sampling — empirically converges in 30-60 trials
// for the param spaces we care about (periods, thresholds, SL/TP).

export type ParamSpace =
  | { type: "int"; min: number; max: number }
  | { type: "float"; min: number; max: number; log?: boolean }
  | { type: "categorical"; choices: (string | number)[] };

export type ParamSet = Record<string, number | string>;

export interface Trial {
  params: ParamSet;
  score: number;
}

interface SearchOpts {
  spaces: Record<string, ParamSpace>;
  maxTrials: number;
  warmupTrials?: number;
  gamma?: number; // top fraction kept as "good"
}

function sampleSpace(space: ParamSpace): number | string {
  switch (space.type) {
    case "int":
      return Math.floor(space.min + Math.random() * (space.max - space.min + 1));
    case "float": {
      if (space.log) {
        const a = Math.log(Math.max(space.min, 1e-9));
        const b = Math.log(Math.max(space.max, 1e-9));
        return Math.exp(a + Math.random() * (b - a));
      }
      return space.min + Math.random() * (space.max - space.min);
    }
    case "categorical":
      return space.choices[Math.floor(Math.random() * space.choices.length)];
  }
}

function sampleNearGood(space: ParamSpace, goodValues: (number | string)[]): number | string {
  if (goodValues.length === 0) return sampleSpace(space);
  if (space.type === "categorical") {
    return goodValues[Math.floor(Math.random() * goodValues.length)];
  }
  // Pick a good value at random as anchor; jitter ±20% of range
  const anchor = goodValues[Math.floor(Math.random() * goodValues.length)] as number;
  const min = (space as { min: number }).min;
  const max = (space as { max: number }).max;
  const jitter = (max - min) * 0.2;
  let v = anchor + (Math.random() * 2 - 1) * jitter;
  if (v < min) v = min;
  if (v > max) v = max;
  return space.type === "int" ? Math.round(v) : v;
}

export async function tpeSearch(
  opts: SearchOpts,
  evaluate: (params: ParamSet) => Promise<number>,
  onTrial?: (i: number, trial: Trial) => Promise<void> | void,
): Promise<Trial[]> {
  const trials: Trial[] = [];
  const warmup = opts.warmupTrials ?? Math.min(10, Math.floor(opts.maxTrials * 0.3));
  const gamma = opts.gamma ?? 0.25;

  for (let i = 0; i < opts.maxTrials; i++) {
    const params: ParamSet = {};
    if (i < warmup) {
      // Pure random warm-up
      for (const [k, sp] of Object.entries(opts.spaces)) params[k] = sampleSpace(sp);
    } else {
      // Split trials into "good" (top gamma) and "rest"; sample near good values
      const sorted = [...trials].sort((a, b) => b.score - a.score);
      const cut = Math.max(1, Math.floor(sorted.length * gamma));
      const good = sorted.slice(0, cut);
      for (const [k, sp] of Object.entries(opts.spaces)) {
        const goodVals = good.map((t) => t.params[k]).filter((v) => v != null) as (number | string)[];
        // 70% sample near good, 30% explore
        params[k] = Math.random() < 0.3 ? sampleSpace(sp) : sampleNearGood(sp, goodVals);
      }
    }

    const score = await evaluate(params);
    const trial: Trial = { params, score };
    trials.push(trial);
    await onTrial?.(i, trial);
  }
  return trials;
}

export function bestTrial(trials: Trial[]): Trial | null {
  if (trials.length === 0) return null;
  return trials.reduce((best, t) => (t.score > best.score ? t : best));
}
