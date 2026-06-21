/**
 * AlphaCore Entity Contracts
 * Defines expected schema for each entity based on Supabase migrations
 * 
 * IMPORTANT: Fields are derived from supabase/migrations/*.sql
 * DO NOT invent fields. If uncertain, mark as optional or commented out.
 */

import type { BaseFields } from './types';

/**
 * Base contract with common fields from all tables
 */
export type EntityContract<T = Record<string, any>> = BaseFields & T;

// ============================================================================
// LOGS MODULE (Sprint 3.1 - 002_logs_schema.sql)
// ============================================================================

export interface Category extends EntityContract {
  name: string;
  name_lower?: string; // Generated column
}

export interface Tag extends EntityContract {
  name: string;
  name_lower?: string; // Generated column
}

export interface Log extends EntityContract {
  title: string;
  notes?: string | null;
  category_id: string; // NOT NULL in schema
  type?: string | null;
  log_date?: string | null; // date
}

export interface LogTag {
  log_id: string;
  tag_id: string;
  created_at: string;
}

export interface LogAttachment extends EntityContract {
  log_id: string;
  file_path: string;
  file_name: string;
  file_size?: number | null;
  mime_type?: string | null;
}

// ============================================================================
// TRADEHUB MODULE
// ============================================================================

// From 003_tradehub_accounts.sql
export interface AccountCategory extends EntityContract {
  name: string;
  name_lower?: string; // Generated column
}

export interface Account extends EntityContract {
  name: string;
  category_id: string; // NOT NULL
  account_size?: number | null;
  current_balance?: number | null;
  operation_state?: string | null;
  phase_status?: string | null;
  role?: string | null;
  withdrawals_enabled: boolean;
}

// From 005_tradehub_trades.sql
export interface Setup extends EntityContract {
  name: string;
  name_lower?: string; // Generated column
  description?: string | null;
}

export interface Trade extends EntityContract {
  account_id: string; // NOT NULL
  symbol: string; // NOT NULL
  direction: string; // NOT NULL
  status: string; // NOT NULL
  entry_date: string; // date, NOT NULL
  entry_price: number; // NOT NULL
  exit_price: number; // NOT NULL
  stop_loss_price: number; // NOT NULL
  take_profit_price: number; // NOT NULL
  lots: number; // NOT NULL
  pnl: number; // NOT NULL
  pnl_percent: number; // NOT NULL
  exit_date?: string | null; // date
  notes?: string | null;
  setup_id?: string | null;
  screenshot_path?: string | null;
  is_featured_in_report: boolean;
}

// From 006_tradehub_evidence_playbook.sql
export interface TVAnalysisEvidence extends EntityContract {
  image_path: string;
  captured_at: string; // timestamptz
  user_notes?: string | null;
  account_id?: string | null;
  trade_id?: string | null;
  validation_status: 'needs_review' | 'valid' | 'invalid';
}

// From 007_tradehub_reports.sql
export interface WeeklyReport extends EntityContract {
  week_start: string; // date
  week_end: string; // date
  content_md: string;
  total_trades: number;
  total_pnl: number;
  win_rate: number;
}

// ============================================================================
// TERMINAL MODULE (Sprint 4.2 - 004_terminal.sql)
// ============================================================================

export interface Instrument {
  id: string;
  name: string;
  symbol: string;
  sort_index: number;
  created_at: string;
  updated_at: string;
  // Note: Global table, no user_id
}

export interface TerminalNews extends EntityContract {
  instrument_id: string; // NOT NULL
  title: string;
  url?: string | null;
  source?: string | null;
  relevance?: number | null; // 0-100
  impact?: string | null; // High/Medium/Low
  timestamp_utc: string; // timestamptz
}

export interface TerminalEvent extends EntityContract {
  instrument_id: string; // NOT NULL
  name: string;
  impact?: string | null;
  timestamp_utc: string; // timestamptz
}

export interface TerminalEvidenceReport extends EntityContract {
  title: string;
  content: string;
  instrument_id?: string | null; // Optional
}

export interface TerminalEvidenceAttachment extends EntityContract {
  report_id: string; // NOT NULL
  file_path: string;
  file_name: string;
  file_size?: number | null;
  mime_type?: string | null;
}

// ============================================================================
// TREASURY MODULE (010_treasury_core.sql)
// ============================================================================

export interface TreasuryConfig extends EntityContract {
  account_id: string; // NOT NULL, FK to accounts
  withdrawal_day: number; // Default 1
  split_mode: 'growth' | 'safe' | 'cash'; // Default 'growth'
  balance_threshold?: number | null;
  anti_drawdown_active: boolean;
  anti_drawdown_threshold: number; // Default 20
  tax_buffer_percentage: number; // Default 30
  tax_buffer_target?: number | null;
  tax_buffer_accumulated: number; // Default 0
  milestone_target?: number | null;
  milestone_bonus_vault: number; // Default 0
}

export interface TreasuryWallet extends EntityContract {
  name: string;
  currency: string;
  starting_balance: number; // Default 0
}

export interface TreasuryTransaction extends EntityContract {
  wallet_id: string; // NOT NULL
  account_id?: string | null; // Optional link to trading account
  type: 'income' | 'expense' | 'transfer' | 'adjustment';
  amount: number;
  occurred_on: string; // date
  description?: string | null;
  notes?: string | null;
}

export interface TreasuryBudget extends EntityContract {
  wallet_id: string;
  period_start: string; // date
  period_end: string; // date
  target_income?: number | null;
  target_expense?: number | null;
  target_payout?: number | null;
  notes?: string | null;
}

export interface TreasuryPayout extends EntityContract {
  account_id: string;
  amount: number;
  payout_date: string; // date
  status: 'pending' | 'completed' | 'cancelled';
  notes?: string | null;
}

export interface TreasuryCalendarEvent extends EntityContract {
  account_id?: string | null;
  title: string;
  event_date: string; // date
  event_type?: string | null;
  notes?: string | null;
}

// ============================================================================
// BUSINESS MODULE (014_business_core.sql)
// ============================================================================

export interface BusinessCost extends EntityContract {
  amount: number;
  category: 'Tools Software' | 'Data' | 'Commissions Fees' | 'Infrastructure' | 'Education' | 'Other';
  description: string;
  vendor: string;
  cost_date: string; // date
  is_recurring_instance: boolean;
  template_id?: string | null;
}

export interface BusinessCostTemplate extends EntityContract {
  amount: number;
  category: 'Tools Software' | 'Data' | 'Commissions Fees' | 'Infrastructure' | 'Education' | 'Other';
  description: string;
  vendor: string;
  day_of_month: number; // 1-31
  start_month: string; // YYYY-MM
  active: boolean;
  last_generated_month?: string | null; // YYYY-MM
}

export interface BusinessMilestone extends EntityContract {
  title: string;
  description: string;
  target_date?: string | null; // date
  status: 'pending' | 'in_progress' | 'completed';
  goal_id?: string | null;
  notes?: string | null;
}

export interface BusinessSOP extends EntityContract {
  name: string;
  description?: string | null;
}

export interface BusinessSOPItem extends EntityContract {
  sop_id: string;
  title: string;
  order_index: number;
}

export interface BusinessSOPRun extends EntityContract {
  sop_id: string;
  started_at: string; // timestamptz
  completed_at?: string | null; // timestamptz
  status: 'in_progress' | 'completed' | 'abandoned';
}

export interface BusinessSOPRunItem extends EntityContract {
  run_id: string;
  sop_item_id: string;
  checked: boolean;
  checked_at?: string | null; // timestamptz
}

export interface BusinessDecisionTask extends EntityContract {
  title: string;
  description?: string | null;
  due_date?: string | null; // date
  status: 'pending' | 'completed';
  notes?: string | null;
}

export interface BusinessLLCInfo extends EntityContract {
  llc_name?: string | null;
  formation_date?: string | null; // date
  state?: string | null;
  ein?: string | null;
  notes?: string | null;
}

// ============================================================================
// ALPHASHIELD MODULE (016_app_logs.sql)
// ============================================================================

export interface AppLog extends EntityContract {
  level: 'debug' | 'info' | 'warn' | 'error';
  area: string; // Module name (e.g., 'tradehub', 'treasury', 'auth')
  message: string;
  meta: Record<string, any>; // JSONB, default '{}'
  fingerprint: string; // Dedupe hash
  url?: string | null;
  user_agent?: string | null;
  resolved_at?: string | null;
}

// ============================================================================
// JOURNAL ENTRIES (journal_entries table)
// ============================================================================

export interface JournalEntry extends EntityContract {
  mood?: 'excellent' | 'good' | 'neutral' | 'bad' | 'terrible' | null;
  mood_score?: number | null; // 1-10 scale
  text: string; // Main journal entry text
  tags?: string[] | null; // JSONB array of tag strings
  market_conditions?: string | null; // Market summary
  focus_areas?: string[] | null; // JSONB array of focus topics
  lessons_learned?: string | null; // Key learnings
  action_items?: string[] | null; // JSONB array of next steps
  trade_id?: string | null; // Optional reference to trade
  edited_at?: string | null; // Last edit timestamp
  is_private: boolean; // default false
}

// ============================================================================
// PUSH SUBSCRIPTIONS (009_push_subscriptions.sql)
// ============================================================================

export interface PushSubscription extends EntityContract {
  endpoint: string;
  p256dh: string;
  auth: string;
  // Additional fields from migration if needed
}

/**
 * Entity name to contract type mapping
 * Used for type-safe entity operations
 */
export type EntityContractMap = {
  // Logs
  categories: Category;
  tags: Tag;
  logs: Log;
  log_attachments: LogAttachment;
  
  // TradeHub
  account_categories: AccountCategory;
  accounts: Account;
  setups: Setup;
  trades: Trade;
  tv_analysis_evidence: TVAnalysisEvidence;
  weekly_reports: WeeklyReport;
  
  // Terminal
  instruments: Instrument;
  terminal_news: TerminalNews;
  terminal_events: TerminalEvent;
  terminal_evidence_reports: TerminalEvidenceReport;
  terminal_evidence_attachments: TerminalEvidenceAttachment;
  
  // Treasury
  treasury_configs: TreasuryConfig;
  treasury_wallets: TreasuryWallet;
  treasury_transactions: TreasuryTransaction;
  treasury_budgets: TreasuryBudget;
  treasury_payouts: TreasuryPayout;
  treasury_calendar_events: TreasuryCalendarEvent;
  
  // Business
  business_costs: BusinessCost;
  business_cost_templates: BusinessCostTemplate;
  business_milestones: BusinessMilestone;
  business_sops: BusinessSOP;
  business_sop_items: BusinessSOPItem;
  business_sop_runs: BusinessSOPRun;
  business_sop_run_items: BusinessSOPRunItem;
  business_decision_tasks: BusinessDecisionTask;
  business_llc_info: BusinessLLCInfo;
  
  // AlphaShield
  app_logs: AppLog;
  
  // Journal
  journal_entries: JournalEntry;
  
  // Push
  push_subscriptions: PushSubscription;
};

/**
 * Get contract for a table (type helper)
 */
export type GetContract<T extends keyof EntityContractMap> = EntityContractMap[T];
