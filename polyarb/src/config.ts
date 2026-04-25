/**
 * Agent configuration — loaded from env vars + Supabase polyarb_agents row.
 */

import { getSupabase } from './supabase.js';
import { decryptText } from './crypto/encryption.js';

export interface AgentConfig {
  agentId: string;
  userId: string;
  name: string;
  walletAddress: string | null;
  walletPrivateKey: string | null;   // for EIP-712 order signing
  apiKey: string | null;
  apiSecret: string | null;
  apiPassphrase: string | null;
  startingCapitalUsd: number;
  dryRun: boolean;                   // POLYARB_DRY_RUN=true → simulate, don't send orders
  params: TradingParams;
}

export interface TradingParams {
  loopIntervalMs: number;
  minEdgePercent: number;
  maxKellyFraction: number;
  maxLeverage: number;
  dailyDrawdownLimit: number;
  hourlyDrawdownLimit: number;
  consecutiveLossLimit: number;
  maxSlippage: number;
  maxLatencyMs: number;
  minRiskReward: number;
  winStreakBonus: number;
  priceHistoryWindowMs: number;
  accelerationThreshold: number;
  jerkReversalThreshold: number;
  minPositionSizeUsd: number;       // Minimum bet size in USD
  lossStreakRiskReduction: number;  // Kelly multiplier when >= 10 consecutive losses (0–1)
  lossStreakThreshold: number;      // How many consecutive losses trigger reduction
}

const DEFAULT_PARAMS: TradingParams = {
  loopIntervalMs: 250,
  minEdgePercent: 0.001,       // require at least 0.1% detectable edge
  maxKellyFraction: 0.10,      // cap at 10% of balance per trade
  maxLeverage: 1.0,            // no leverage in binary markets
  dailyDrawdownLimit: -0.90,   // 90% daily loss before hard stop
  hourlyDrawdownLimit: -0.60,  // 60% hourly
  consecutiveLossLimit: 30,    // allow long losing streaks
  maxSlippage: 0.05,           // tolerate high slippage
  maxLatencyMs: 500,           // tolerate slower execution
  minRiskReward: 0.0,          // Kelly manages R:R implicitly — no separate floor
  winStreakBonus: 1.0,         // no win-streak size bonus (Kelly handles sizing)
  priceHistoryWindowMs: 60_000,
  accelerationThreshold: 0.00005,
  jerkReversalThreshold: -0.0001,
  minPositionSizeUsd: 0.01,   // effectively no floor — Kelly determines exact size
  lossStreakRiskReduction: 0.4, // reduce Kelly to 40% after streak
  lossStreakThreshold: 10,    // trigger after 10 consecutive losses
};

export async function loadAgentConfig(): Promise<AgentConfig> {
  const agentId = process.env.POLYARB_AGENT_ID;
  const userId = process.env.POLYARB_USER_ID;
  if (!agentId || !userId) throw new Error('Missing POLYARB_AGENT_ID or POLYARB_USER_ID');

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('polyarb_agents')
    .select('*')
    .eq('id', agentId)
    .single();

  if (error || !data) throw new Error(`Failed to load agent ${agentId}: ${error?.message}`);

  const configJson = (data.config ?? {}) as Record<string, unknown>;

  const params: TradingParams = {
    loopIntervalMs:         (configJson.loop_interval_ms as number)         ?? DEFAULT_PARAMS.loopIntervalMs,
    minEdgePercent:          (configJson.min_edge_percent as number)         ?? DEFAULT_PARAMS.minEdgePercent,
    maxKellyFraction:        (configJson.max_kelly_fraction as number)       ?? DEFAULT_PARAMS.maxKellyFraction,
    maxLeverage:             (configJson.max_leverage as number)             ?? DEFAULT_PARAMS.maxLeverage,
    dailyDrawdownLimit:      (configJson.daily_drawdown_limit as number)     ?? DEFAULT_PARAMS.dailyDrawdownLimit,
    hourlyDrawdownLimit:     (configJson.hourly_drawdown_limit as number)    ?? DEFAULT_PARAMS.hourlyDrawdownLimit,
    consecutiveLossLimit:    (configJson.consecutive_loss_limit as number)   ?? DEFAULT_PARAMS.consecutiveLossLimit,
    maxSlippage:             (configJson.max_slippage as number)             ?? DEFAULT_PARAMS.maxSlippage,
    maxLatencyMs:            (configJson.max_latency_ms as number)           ?? DEFAULT_PARAMS.maxLatencyMs,
    minRiskReward:           (configJson.min_risk_reward as number)          ?? DEFAULT_PARAMS.minRiskReward,
    winStreakBonus:           (configJson.win_streak_bonus as number)         ?? DEFAULT_PARAMS.winStreakBonus,
    priceHistoryWindowMs:    (configJson.price_history_window_ms as number)  ?? DEFAULT_PARAMS.priceHistoryWindowMs,
    accelerationThreshold:   (configJson.acceleration_threshold as number)   ?? DEFAULT_PARAMS.accelerationThreshold,
    jerkReversalThreshold:   (configJson.jerk_reversal_threshold as number)  ?? DEFAULT_PARAMS.jerkReversalThreshold,
    minPositionSizeUsd:      (configJson.min_position_size_usd as number)    ?? DEFAULT_PARAMS.minPositionSizeUsd,
    lossStreakRiskReduction: (configJson.loss_streak_risk_reduction as number) ?? DEFAULT_PARAMS.lossStreakRiskReduction,
    lossStreakThreshold:     (configJson.loss_streak_threshold as number)    ?? DEFAULT_PARAMS.lossStreakThreshold,
  };

  return {
    agentId,
    userId,
    name: data.name as string,
    walletAddress: decryptText(data.wallet_address as string | null),
    walletPrivateKey: process.env.POLYARB_WALLET_PRIVATE_KEY ?? null,
    apiKey: decryptText(data.api_key_encrypted as string | null),
    apiSecret: decryptText(data.api_secret_encrypted as string | null),
    apiPassphrase: decryptText(data.api_passphrase_encrypted as string | null),
    startingCapitalUsd: Number(data.starting_capital_usd) || 50,
    dryRun: process.env.POLYARB_DRY_RUN === 'true',
    params,
  };
}
