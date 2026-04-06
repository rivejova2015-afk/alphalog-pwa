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
  apiKey: string | null;
  apiSecret: string | null;
  apiPassphrase: string | null;
  startingCapitalUsd: number;
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
}

const DEFAULT_PARAMS: TradingParams = {
  loopIntervalMs: 250,
  minEdgePercent: 0.005,
  maxKellyFraction: 0.50,
  maxLeverage: 3.0,
  dailyDrawdownLimit: -0.35,
  hourlyDrawdownLimit: -0.20,
  consecutiveLossLimit: 7,
  maxSlippage: 0.015,
  maxLatencyMs: 100,
  minRiskReward: 1.2,
  winStreakBonus: 1.5,
  priceHistoryWindowMs: 60_000,
  accelerationThreshold: 0.00005,
  jerkReversalThreshold: -0.0001,
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
  };

  return {
    agentId,
    userId,
    name: data.name as string,
    walletAddress: decryptText(data.wallet_address as string | null),
    apiKey: decryptText(data.api_key_encrypted as string | null),
    apiSecret: decryptText(data.api_secret_encrypted as string | null),
    apiPassphrase: decryptText(data.api_passphrase_encrypted as string | null),
    startingCapitalUsd: Number(data.starting_capital_usd) || 50,
    params,
  };
}
