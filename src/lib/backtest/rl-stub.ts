// L12 — Reinforcement Learning agents (PPO / DQN / SAC for trading).
//
// Status: NOT AVAILABLE in this Node serverless build. RL training needs a GPU
// and a Python ML stack (Ray RLlib, Stable-Baselines3, CleanRL, or similar).
// Pretending to train an RL policy in pure JS would either be too slow to be
// useful or too small to learn anything meaningful — both options mislead.
//
// To enable:
//   1. Stand up a Python service (FastAPI on a GPU host: Modal, RunPod, Banana,
//      or self-hosted). Endpoint: POST /train -> returns a model artifact path.
//      Endpoint: POST /infer -> takes state features, returns action.
//   2. Define the env: state = recent OHLCV + indicators + position; action =
//      {long, short, flat, scale}; reward = step PnL minus transaction cost.
//   3. From this Node app, POST `extractFeatures` outputs to /infer at each bar
//      and consume the returned action in the engine.
//   4. For training, push a job to that service with the historical bars and
//      poll for completion. Persist the resulting policy weights URL in the
//      `ml_models` table (kind = 'rl_policy').
//
// Until that service exists, every method here throws or reports unavailable so
// the rest of the backtest pipeline stays honest about what's running.

export type RlAction = "long" | "short" | "flat";

export interface RlState {
  features: number[]; // state vector (you choose the encoding)
  position: number;   // current lots, signed (long > 0, short < 0)
  unrealizedPnl: number;
}

export interface RlAgent {
  available: boolean;
  // Returns a model id once training finishes (or polled to completion).
  train(opts: {
    symbol: string;
    from: string;
    to: string;
    timeframe: string;
    episodes: number;
  }): Promise<{ modelId: string; episodes: number; finalReward: number }>;
  act(modelId: string, state: RlState): Promise<RlAction>;
}

export const rlAgent: RlAgent = {
  available: false,
  async train() {
    throw new Error(
      "RL training is not available in this build. See src/lib/backtest/rl-stub.ts header for setup steps.",
    );
  },
  async act() {
    throw new Error("RL inference requires a working RlAgent.");
  },
};
