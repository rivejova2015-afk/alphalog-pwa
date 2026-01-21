/**
 * Business Module Types
 * Data structures for Business costs, SOPs, milestones, decisions, and LLC info
 */

// ============================================================================
// BUSINESS COSTS
// ============================================================================

export interface BusinessCost {
  id: string;
  user_id: string;
  amount: number;
  category: 'Tools Software' | 'Data' | 'Commissions Fees' | 'Infrastructure' | 'Education' | 'Other';
  description: string;
  vendor: string;
  cost_date: string; // DATE
  is_recurring_instance: boolean;
  template_id?: string | null;
  sort_index: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface BusinessCostTemplate {
  id: string;
  user_id: string;
  amount: number;
  category: 'Tools Software' | 'Data' | 'Commissions Fees' | 'Infrastructure' | 'Education' | 'Other';
  description: string;
  vendor: string;
  day_of_month: number; // 1-31
  start_month: string; // YYYY-MM format
  active: boolean;
  last_generated_month?: string | null; // YYYY-MM format
  sort_index: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

// ============================================================================
// BUSINESS MILESTONES
// ============================================================================

export interface BusinessMilestone {
  id: string;
  user_id: string;
  title: string;
  description: string;
  target_date?: string | null; // DATE
  status: 'pending' | 'in_progress' | 'completed';
  goal_id?: string | null; // Reference to tradermap_goals
  notes?: string | null;
  sort_index: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

// ============================================================================
// BUSINESS SOPs (Standard Operating Procedures)
// ============================================================================

export interface BusinessSOP {
  id: string;
  user_id: string;
  title: string;
  type: 'pre_session' | 'post_session' | 'drawdown_protocol' | 'withdrawal_protocol' | 'weekly_close' | 'monthly_close' | 'custom';
  content: string;
  sort_index: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface BusinessSOPItem {
  id: string;
  sop_id: string;
  user_id: string;
  label: string;
  sort_index: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface BusinessSOPRun {
  id: string;
  user_id: string;
  sop_id: string;
  run_date: string; // DATE
  notes?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface BusinessSOPRunItem {
  id: string;
  user_id: string;
  run_id: string;
  item_id: string;
  checked: boolean;
  checked_at?: string | null; // TIMESTAMPTZ
  note?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

// ============================================================================
// BUSINESS DECISIONS
// ============================================================================

export interface BusinessDecision {
  id: string;
  user_id: string;
  title: string;
  context: string;
  decision: string;
  rationale: string;
  impact: string;
  tags: string[];
  priority: 'low' | 'med' | 'high';
  sort_index: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface BusinessDecisionTask {
  id: string;
  user_id: string;
  decision_id: string;
  title: string;
  done: boolean;
  sort_index: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

// ============================================================================
// LLC INFO
// ============================================================================

export interface LLCInfo {
  id: string;
  user_id: string;
  llc_name: string;
  formation_date?: string | null; // DATE
  annual_report_due_month: number; // 1-12
  annual_fee_baseline: number;
  registered_agent_name: string;
  ein: string;
  notes?: string | null;
  last_annual_report_push_year?: number | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface LLCInboxItem {
  id: string;
  user_id: string;
  title: string;
  received_on: string; // DATE
  status: 'new' | 'in_review' | 'done' | 'archived';
  notes?: string | null;
  attachment_path?: string | null;
  sort_index: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

// ============================================================================
// COST CATEGORIES
// ============================================================================

export const COST_CATEGORIES = [
  'Tools Software',
  'Data',
  'Commissions Fees',
  'Infrastructure',
  'Education',
  'Other'
] as const;

export const SOP_TYPES = [
  'pre_session',
  'post_session',
  'drawdown_protocol',
  'withdrawal_protocol',
  'weekly_close',
  'monthly_close',
  'custom'
] as const;

export const MILESTONE_STATUSES = [
  'pending',
  'in_progress',
  'completed'
] as const;

export const DECISION_PRIORITIES = [
  'low',
  'med',
  'high'
] as const;

export const LLC_INBOX_STATUSES = [
  'new',
  'in_review',
  'done',
  'archived'
] as const;
