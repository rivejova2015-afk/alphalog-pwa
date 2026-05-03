/**
 * Agent configuration for coinarb — Coinbase ultra-aggressive trading engine.
 *
 * Loads from env vars + Supabase coinarb_agents row (dedicated table — does not
 * share data with PolyArb). Replaces the Polymarket EIP-712 wallet fields with
 * Coinbase CDP (Advanced Trade) and INTX (International Exchange) credentials.
 */

import { getSupabase } from './supabase.js';
import { decryptText } from './crypto/encryption.js';

export interface CoinarbAgentConfig {
  agentId: string;
  userId: string;
  name: string;

  /** Coinbase Advanced Trade (spot, US): JWT ES256 via CDP key. */
  cdpKeyName: string | null;
  cdpPrivateKey: string | null;

  /** Coinbase International Exchange (perps): HMAC-SHA256 + passphrase. */
  intxApiKey: string | null;
  intxSecret: string | null;
  intxPassphrase: string | null;
  intxPortfolioId: string | null;

  startingCapitalUsd: number;
  paperMode: boolean;            // COINARB_50X_PAPER_MODE=1 → simulated fills, no real orders
  params: TradingParams;
}

export interface TradingParams {
  loopIntervalMs: number;
  /** Hard cap on Kelly fraction per trade (0.25 = max 25% capital). */
  maxKellyFraction: number;
  /** Perp leverage cap (5x default). */
  maxLeverage: number;
  /** Aggregate exposure cap as fraction of capital (1.0 = 100%). */
  maxAggregateExposurePct: number;
  /** Spot capital allocation share (0.60 = 60% of capital reserved for spot). */
  spotAllocationPct: number;
  /** Perp capital allocation share (0.40 = 40% of capital reserved for perps). */
  perpAllocationPct: number;
  /** Daily trade cap (resets each UTC day). */
  dailyTradeCap: number;
  /** Cooldown after any losing close, in ms. */
  lossCooldownMs: number;
  /** Drawdown breaker — close everything + pause when DD from peak ≥ this. */
  drawdownBreakerPct: number;
  /** Cooldown after drawdown breaker fires, in ms. */
  drawdownBreakerCooldownMs: number;
  /** Funding-rate adverse threshold (per hour). Skip entries above this. */
  fundingAdverseThreshold: number;
  /** Maker-only post-only orders (true) vs allow taker fills (false). */
  postOnly: boolean;
  /** Watchdog: restart loop if no WS tick for this many ms. */
  wsStaleTimeoutMs: number;
}

const DEFAULT_PARAMS: TradingParams = {
  loopIntervalMs: 250,
  maxKellyFraction: 0.25,
  maxLeverage: 5.0,
  maxAggregateExposurePct: 1.0,
  spotAllocationPct: 0.60,
  perpAllocationPct: 0.40,
  dailyTradeCap: 7,
  lossCooldownMs: 2_400_000,            // 40 min
  drawdownBreakerPct: 0.25,
  drawdownBreakerCooldownMs: 86_400_000, // 24 h
  fundingAdverseThreshold: 0.0005,       // 0.05% / h
  postOnly: true,
  wsStaleTimeoutMs: 60_000,
};

function envNum(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function envBool(key: string, fallback: boolean): boolean {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  return raw === 'true' || raw === '1' || raw.toLowerCase() === 'yes';
}

export async function loadCoinarbConfig(): Promise<CoinarbAgentConfig> {
  const agentId = process.env.COINARB_AGENT_ID ?? process.env.COINARB_50X_AGENT_ID ?? 'coinarb-50x';
  const userId = process.env.COINARB_USER_ID;
  if (!userId) throw new Error('Missing COINARB_USER_ID');

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('coinarb_agents')
    .select('*')
    .eq('id', agentId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load agent ${agentId}: ${error.message}`);

  const startingCapital = data?.starting_capital_usd
    ? Number(data.starting_capital_usd)
    : envNum('COINARB_50X_TOTAL_CAPITAL_USD', 100);

  const params: TradingParams = {
    loopIntervalMs:            envNum('COINARB_50X_TICK_MS',                    DEFAULT_PARAMS.loopIntervalMs),
    maxKellyFraction:          envNum('COINARB_50X_MAX_KELLY_FRACTION',         DEFAULT_PARAMS.maxKellyFraction),
    maxLeverage:               envNum('COINARB_50X_MAX_LEVERAGE',               DEFAULT_PARAMS.maxLeverage),
    maxAggregateExposurePct:   envNum('COINARB_50X_MAX_AGGREGATE_EXPOSURE_PCT', DEFAULT_PARAMS.maxAggregateExposurePct),
    spotAllocationPct:         envNum('COINARB_50X_SPOT_ALLOCATION_PCT',        DEFAULT_PARAMS.spotAllocationPct),
    perpAllocationPct:         envNum('COINARB_50X_PERP_ALLOCATION_PCT',        DEFAULT_PARAMS.perpAllocationPct),
    dailyTradeCap:             envNum('COINARB_50X_DAILY_TRADE_CAP',            DEFAULT_PARAMS.dailyTradeCap),
    lossCooldownMs:            envNum('COINARB_50X_LOSS_COOLDOWN_MS',           DEFAULT_PARAMS.lossCooldownMs),
    drawdownBreakerPct:        envNum('COINARB_50X_DRAWDOWN_BREAKER_PCT',       DEFAULT_PARAMS.drawdownBreakerPct),
    drawdownBreakerCooldownMs: envNum('COINARB_50X_DRAWDOWN_BREAKER_COOLDOWN_MS', DEFAULT_PARAMS.drawdownBreakerCooldownMs),
    fundingAdverseThreshold:   envNum('COINARB_50X_FUNDING_ADVERSE_THRESHOLD',  DEFAULT_PARAMS.fundingAdverseThreshold),
    postOnly:                  envBool('COINARB_50X_POST_ONLY',                 DEFAULT_PARAMS.postOnly),
    wsStaleTimeoutMs:          envNum('COINARB_50X_WS_STALE_TIMEOUT_MS',        DEFAULT_PARAMS.wsStaleTimeoutMs),
  };

  return {
    agentId,
    userId,
    name: (data?.name as string) ?? 'Coinarb 50x',
    cdpKeyName:      process.env.COINBASE_CDP_KEY_NAME      ?? decryptText(data?.api_key_encrypted as string | null),
    cdpPrivateKey:   process.env.COINBASE_CDP_PRIVATE_KEY   ?? decryptText(data?.api_secret_encrypted as string | null),
    intxApiKey:      process.env.COINBASE_INTX_API_KEY      ?? null,
    intxSecret:      process.env.COINBASE_INTX_SECRET       ?? null,
    intxPassphrase:  process.env.COINBASE_INTX_PASSPHRASE   ?? decryptText(data?.api_passphrase_encrypted as string | null),
    intxPortfolioId: process.env.COINBASE_INTX_PORTFOLIO_ID ?? null,
    startingCapitalUsd: startingCapital,
    paperMode: envBool('COINARB_50X_PAPER_MODE', true),
    params,
  };
}
