import type {
  SkillState,
  SkillAction,
  QTable,
  SkillLearningResult,
  PaperTrade,
} from "./types";
import type { RegimeCode, SessionStatus } from "@/lib/bot/signal-engine/types";

export function stateToIndex(state: SkillState): number {
  return (
    state.regimeBucket * (4 * 4 * 4) +
    state.confidenceBucket * (4 * 4) +
    state.volBucket * 4 +
    state.sessionBucket
  );
}

export function contextToState(
  regime: RegimeCode | string,
  confidence: number,
  vol15m: number,
  session: SessionStatus | "CLOSED"
): SkillState {
  // Regime bucket (0-6)
  const regimeBuckets: Record<string, number> = {
    BULL_TREND_STRONG: 0,
    BULL_TREND_WEAK: 1,
    BEAR_TREND_STRONG: 2,
    BEAR_TREND_WEAK: 3,
    SIDEWAYS_LOW_VOL: 4,
    SIDEWAYS_HIGH_VOL: 5,
    BREAKOUT_IMMINENT: 6,
  };
  const regimeBucket = regimeBuckets[regime] ?? 4;

  // Confidence bucket (0-3)
  const confidenceBucket =
    confidence < 0.6 ? 0 : confidence < 0.7 ? 1 : confidence < 0.85 ? 2 : 3;

  // Vol bucket (0-3): <0.002, 0.002-0.005, 0.005-0.010, >0.010
  const volBucket =
    vol15m < 0.002 ? 0 : vol15m < 0.005 ? 1 : vol15m < 0.01 ? 2 : 3;

  // Session bucket (0-3)
  const sessionBuckets: Record<string, number> = {
    CLOSED: 0,
    NY: 1,
    LONDON: 2,
    OVERLAP: 3,
  };
  const sessionBucket = sessionBuckets[session as string] ?? 0;

  return { regimeBucket, confidenceBucket, volBucket, sessionBucket };
}

export function chooseAction(
  qTable: number[][],
  stateIdx: number,
  epsilon: number
): SkillAction {
  if (Math.random() < epsilon) {
    // Exploration: random action
    return (Math.floor(Math.random() * 3) as unknown as SkillAction);
  }
  // Exploitation: argmax
  const qValues = qTable[stateIdx];
  let maxIdx = 0;
  let maxVal = qValues[0];
  for (let i = 1; i < qValues.length; i++) {
    if (qValues[i] > maxVal) {
      maxVal = qValues[i];
      maxIdx = i;
    }
  }
  return (maxIdx as unknown as SkillAction);
}

export function calculateReward(trade: {
  pnl: number | null;
  maxAdverseExcursion?: number;
  lots?: number;
}): number {
  const pnl = trade.pnl ?? 0;
  const mae = Math.abs(trade.maxAdverseExcursion ?? 0);
  const riskTaken = mae + 0.0001; // epsilon to avoid division by zero
  return pnl / riskTaken;
}

export function updateQTable(
  qTable: number[][],
  state: number,
  action: SkillAction,
  reward: number,
  nextState: number,
  alpha = 0.1,
  gamma = 0.9
): number[][] {
  const nextMax = Math.max(...qTable[nextState]);
  const oldQ = qTable[state][action];
  qTable[state][action] += alpha * (reward + gamma * nextMax - oldQ);
  return qTable;
}

export function decayEpsilon(epsilon: number): number {
  return Math.max(0.05, epsilon * 0.995);
}

export function createEmptyQTable(instrument: string): QTable {
  return {
    table: Array(448)
      .fill(null)
      .map(() => [0, 0, 0]),
    epsilon: 0.3,
    version: 1,
    instrument,
    trainedAt: new Date().toISOString(),
  };
}

export interface RunLearningCycleParams {
  closedTrades: PaperTrade[];
  currentQTable: QTable;
  regimeHistory: string[];
  sessionHistory: string[];
}

export function runLearningCycle({
  closedTrades,
  currentQTable,
  regimeHistory,
  sessionHistory,
}: RunLearningCycleParams): SkillLearningResult {
  const qTable = currentQTable.table.map((row) => [...row]);
  let improvedActions = 0;
  const rewards: number[] = [];

  for (let i = 0; i < closedTrades.length; i++) {
    const trade = closedTrades[i];
    if (!trade) continue;

    const state = stateToIndex(
      contextToState(
        trade.regime ?? "SIDEWAYS_LOW_VOL",
        trade.confidence ?? 0.5,
        trade.vol15m ?? 0.003,
        (trade.session ?? "CLOSED") as never
      )
    );

    const action: SkillAction =
      trade.direction === "BUY" ? 0 : trade.direction === "SELL" ? 1 : 2;

    const reward = calculateReward(trade);
    rewards.push(reward);

    const nextRegime = regimeHistory[i + 1] ?? "SIDEWAYS_LOW_VOL";
    const nextSession = sessionHistory[i + 1] ?? "CLOSED";
    const nextState = stateToIndex(contextToState(nextRegime, 0.5, 0.003, nextSession as never));

    const oldQ = qTable[state][action];
    updateQTable(qTable, state, action, reward, nextState);
    if (Math.abs(qTable[state][action] - oldQ) > 0.001) {
      improvedActions++;
    }
  }

  const avgReward = rewards.length > 0 ? rewards.reduce((s, r) => s + r, 0) / rewards.length : 0;

  return {
    updatedQTable: {
      ...currentQTable,
      table: qTable,
      epsilon: decayEpsilon(currentQTable.epsilon),
      version: currentQTable.version + 1,
      trainedAt: new Date().toISOString(),
    },
    episodeCount: closedTrades.length,
    avgReward,
    improvedActions,
    llmRules: [],
  };
}
