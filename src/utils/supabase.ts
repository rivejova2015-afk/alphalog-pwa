// Re-export the existing browser Supabase client
export { createClient } from '@/lib/supabase/browser';

// AlphaLog 2.1 Type Definitions

export type AgentType = 'polymarket' | 'custom_ia';
export type AgentStatus = 'ACTIVE' | 'PAUSED' | 'ERROR';

export type Agent = {
  id: string;
  user_id: string;
  name: string;
  type: AgentType;
  status: AgentStatus;
  portfolio_value: number;
  win_rate: number;
  roi: number;
  sharpe_ratio: number;
  max_drawdown: number;
  last_trade_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type AgentOperation = {
  id: string;
  agent_id: string;
  market: string;
  outcome_amount: number;
  outcome_type: 'WIN' | 'LOSS';
  entry_time: string;
  exit_time: string;
  confidence_score: number;
  reasoning: string | null;
  created_at: string;
};

export type MarketType = 'forex' | 'futures' | 'options';
export type AlgorithmStatus = 'ACTIVE' | 'PAUSED' | 'ERROR';

export type Algorithm = {
  id: string;
  user_id: string;
  name: string;
  market_type: MarketType;
  instrument: string;
  status: AlgorithmStatus;
  pnl_today: number;
  win_rate: number;
  total_trades: number;
  last_trade_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type AlgoTrade = {
  id: string;
  algorithm_id: string;
  trade_number: number;
  direction: 'BUY' | 'SELL';
  entry_price: number;
  exit_price: number;
  entry_time: string;
  exit_time: string;
  lot_size: number;
  stop_loss: number;
  take_profit: number;
  pnl: number;
  duration_seconds: number;
  created_at: string;
};

export type GoalTimeframe = 'annual' | 'quarterly' | 'monthly' | 'weekly';
export type GoalStatus = 'ON_TRACK' | 'BELOW_PACE' | 'EXCEEDED' | 'WARNING';

export type Goal = {
  id: string;
  user_id: string;
  name: string;
  timeframe: GoalTimeframe;
  target_value: number;
  current_value: number;
  status: GoalStatus;
  linked_algo_ids: string[] | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type BusinessDecision = {
  id: string;
  user_id: string;
  decision_text: string;
  expected_impact: string;
  status: 'ACTIVE' | 'COMPLETED' | 'PENDING';
  linked_algos: string[] | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type JournalEntry = {
  id: string;
  user_id: string;
  content: string;
  tags: string[] | null;
  linked_to: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type SOP = {
  id: string;
  user_id: string;
  name: string;
  content: string;
  effectiveness_percent: number;
  linked_trades: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};
