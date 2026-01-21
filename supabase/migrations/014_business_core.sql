-- 014: Business Module Core Tables
-- Creates Business, SOPs, Milestones, Decisions, and LLC Info tables
-- Includes RLS, soft delete (deleted_at), and updated_at triggers

-- ============================================================================
-- A) CREATE TABLE business_costs
-- ============================================================================

CREATE TABLE IF NOT EXISTS business_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  vendor TEXT NOT NULL,
  cost_date DATE NOT NULL,
  is_recurring_instance BOOLEAN NOT NULL DEFAULT false,
  template_id UUID NULL REFERENCES business_cost_templates(id) ON DELETE SET NULL,
  sort_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE NULL,
  
  -- Constraints
  CONSTRAINT business_costs_amount_positive CHECK (amount >= 0),
  CONSTRAINT business_costs_category_check CHECK (
    category IN ('Tools Software', 'Data', 'Commissions Fees', 'Infrastructure', 'Education', 'Other')
  )
);

CREATE INDEX idx_business_costs_user ON business_costs(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_business_costs_user_date ON business_costs(user_id, cost_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_business_costs_category ON business_costs(user_id, category) WHERE deleted_at IS NULL;
CREATE INDEX idx_business_costs_template ON business_costs(template_id) WHERE deleted_at IS NULL;

-- Trigger: update updated_at on INSERT/UPDATE
CREATE OR REPLACE TRIGGER business_costs_updated_at_trigger
BEFORE UPDATE ON business_costs
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE business_costs IS 'Monthly business costs with category and vendor tracking';
COMMENT ON COLUMN business_costs.vendor IS 'Vendor/supplier name for cost tracking';
COMMENT ON COLUMN business_costs.template_id IS 'Reference to recurring cost template if auto-generated';

-- ============================================================================
-- B) CREATE TABLE business_cost_templates
-- ============================================================================

CREATE TABLE IF NOT EXISTS business_cost_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  vendor TEXT NOT NULL,
  day_of_month INT NOT NULL,
  start_month TEXT NOT NULL, -- YYYY-MM format
  active BOOLEAN NOT NULL DEFAULT true,
  last_generated_month TEXT NULL, -- YYYY-MM format
  sort_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE NULL,
  
  -- Constraints
  CONSTRAINT business_cost_templates_amount_positive CHECK (amount >= 0),
  CONSTRAINT business_cost_templates_day_valid CHECK (day_of_month >= 1 AND day_of_month <= 31),
  CONSTRAINT business_cost_templates_category_check CHECK (
    category IN ('Tools Software', 'Data', 'Commissions Fees', 'Infrastructure', 'Education', 'Other')
  )
);

CREATE INDEX idx_business_cost_templates_user ON business_cost_templates(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_business_cost_templates_active ON business_cost_templates(user_id, active) WHERE deleted_at IS NULL;

-- Trigger: update updated_at on INSERT/UPDATE
CREATE OR REPLACE TRIGGER business_cost_templates_updated_at_trigger
BEFORE UPDATE ON business_cost_templates
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE business_cost_templates IS 'Recurring monthly cost templates for auto-generation';
COMMENT ON COLUMN business_cost_templates.day_of_month IS 'Day of month to generate cost (1-31)';
COMMENT ON COLUMN business_cost_templates.last_generated_month IS 'Last month this template was auto-generated (YYYY-MM)';

-- ============================================================================
-- C) CREATE TABLE business_milestones
-- ============================================================================

CREATE TABLE IF NOT EXISTS business_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  target_date DATE NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  goal_id UUID NULL REFERENCES tradermap_goals(id) ON DELETE SET NULL,
  notes TEXT NULL,
  sort_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE NULL,
  
  -- Constraints
  CONSTRAINT business_milestones_status_check CHECK (
    status IN ('pending', 'in_progress', 'completed')
  )
);

CREATE INDEX idx_business_milestones_user ON business_milestones(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_business_milestones_status ON business_milestones(user_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_business_milestones_goal ON business_milestones(goal_id) WHERE deleted_at IS NULL;

-- Trigger: update updated_at on INSERT/UPDATE
CREATE OR REPLACE TRIGGER business_milestones_updated_at_trigger
BEFORE UPDATE ON business_milestones
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE business_milestones IS 'Business milestones with status tracking (pending, in_progress, completed)';
COMMENT ON COLUMN business_milestones.goal_id IS 'Optional reference to TraderMap goal (tradermap_goals) for linking objectives';

-- ============================================================================
-- D) CREATE TABLE business_sops
-- ============================================================================

CREATE TABLE IF NOT EXISTS business_sops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'custom',
  content TEXT NOT NULL,
  sort_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE NULL,
  
  -- Constraints
  CONSTRAINT business_sops_type_check CHECK (
    type IN ('pre_session', 'post_session', 'drawdown_protocol', 'withdrawal_protocol', 'weekly_close', 'monthly_close', 'custom')
  )
);

CREATE INDEX idx_business_sops_user ON business_sops(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_business_sops_type ON business_sops(user_id, type) WHERE deleted_at IS NULL;

-- Trigger: update updated_at on INSERT/UPDATE
CREATE OR REPLACE TRIGGER business_sops_updated_at_trigger
BEFORE UPDATE ON business_sops
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE business_sops IS 'Standard Operating Procedures (SOPs) with predefined and custom types';
COMMENT ON COLUMN business_sops.type IS 'SOP type: pre_session, post_session, drawdown_protocol, withdrawal_protocol, weekly_close, monthly_close, custom';

-- ============================================================================
-- E) CREATE TABLE business_sop_items
-- ============================================================================

CREATE TABLE IF NOT EXISTS business_sop_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sop_id UUID NOT NULL REFERENCES business_sops(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  sort_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE NULL
);

CREATE INDEX idx_business_sop_items_sop ON business_sop_items(sop_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_business_sop_items_user ON business_sop_items(user_id) WHERE deleted_at IS NULL;

-- Trigger: update updated_at on INSERT/UPDATE
CREATE OR REPLACE TRIGGER business_sop_items_updated_at_trigger
BEFORE UPDATE ON business_sop_items
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE business_sop_items IS 'Checklist items within a SOP for execution tracking';

-- ============================================================================
-- F) CREATE TABLE business_sop_runs
-- ============================================================================

CREATE TABLE IF NOT EXISTS business_sop_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sop_id UUID NOT NULL REFERENCES business_sops(id) ON DELETE CASCADE,
  run_date DATE NOT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE NULL
);

CREATE INDEX idx_business_sop_runs_user ON business_sop_runs(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_business_sop_runs_sop ON business_sop_runs(sop_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_business_sop_runs_date ON business_sop_runs(run_date DESC) WHERE deleted_at IS NULL;

-- Trigger: update updated_at on INSERT/UPDATE
CREATE OR REPLACE TRIGGER business_sop_runs_updated_at_trigger
BEFORE UPDATE ON business_sop_runs
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE business_sop_runs IS 'Historical record of SOP executions';

-- ============================================================================
-- G) CREATE TABLE business_sop_run_items
-- ============================================================================

CREATE TABLE IF NOT EXISTS business_sop_run_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES business_sop_runs(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES business_sop_items(id) ON DELETE CASCADE,
  checked BOOLEAN NOT NULL DEFAULT false,
  checked_at TIMESTAMP WITH TIME ZONE NULL,
  note TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE NULL,
  
  -- Constraints
  CONSTRAINT business_sop_run_items_unique UNIQUE (run_id, item_id) WHERE deleted_at IS NULL
);

CREATE INDEX idx_business_sop_run_items_run ON business_sop_run_items(run_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_business_sop_run_items_item ON business_sop_run_items(item_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_business_sop_run_items_user ON business_sop_run_items(user_id) WHERE deleted_at IS NULL;

-- Trigger: update updated_at on INSERT/UPDATE
CREATE OR REPLACE TRIGGER business_sop_run_items_updated_at_trigger
BEFORE UPDATE ON business_sop_run_items
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE business_sop_run_items IS 'Execution status of individual items in a SOP run';

-- ============================================================================
-- H) CREATE TABLE business_decisions
-- ============================================================================

CREATE TABLE IF NOT EXISTS business_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  context TEXT NOT NULL,
  decision TEXT NOT NULL,
  rationale TEXT NOT NULL,
  impact TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  priority TEXT NOT NULL DEFAULT 'med',
  sort_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE NULL,
  
  -- Constraints
  CONSTRAINT business_decisions_priority_check CHECK (
    priority IN ('low', 'med', 'high')
  )
);

CREATE INDEX idx_business_decisions_user ON business_decisions(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_business_decisions_priority ON business_decisions(user_id, priority) WHERE deleted_at IS NULL;
CREATE INDEX idx_business_decisions_tags ON business_decisions USING GIN (tags) WHERE deleted_at IS NULL;

-- Trigger: update updated_at on INSERT/UPDATE
CREATE OR REPLACE TRIGGER business_decisions_updated_at_trigger
BEFORE UPDATE ON business_decisions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE business_decisions IS 'Strategic business decisions with context, rationale, and impact';
COMMENT ON COLUMN business_decisions.tags IS 'Array of tags for decision categorization (e.g., {strategy, finance, operations})';

-- ============================================================================
-- I) CREATE TABLE business_decision_tasks
-- ============================================================================

CREATE TABLE IF NOT EXISTS business_decision_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  decision_id UUID NOT NULL REFERENCES business_decisions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT false,
  sort_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE NULL
);

CREATE INDEX idx_business_decision_tasks_decision ON business_decision_tasks(decision_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_business_decision_tasks_user ON business_decision_tasks(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_business_decision_tasks_done ON business_decision_tasks(user_id, done) WHERE deleted_at IS NULL;

-- Trigger: update updated_at on INSERT/UPDATE
CREATE OR REPLACE TRIGGER business_decision_tasks_updated_at_trigger
BEFORE UPDATE ON business_decision_tasks
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE business_decision_tasks IS 'Follow-up tasks associated with strategic decisions';

-- ============================================================================
-- J) CREATE TABLE llc_info
-- ============================================================================

CREATE TABLE IF NOT EXISTS llc_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  llc_name TEXT NOT NULL,
  formation_date DATE NULL,
  annual_report_due_month INT NOT NULL,
  annual_fee_baseline NUMERIC(10,2) NOT NULL DEFAULT 60.00,
  registered_agent_name TEXT NOT NULL,
  ein TEXT NOT NULL,
  notes TEXT NULL,
  last_annual_report_push_year INT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE NULL,
  
  -- Constraints
  CONSTRAINT llc_info_month_valid CHECK (annual_report_due_month >= 1 AND annual_report_due_month <= 12),
  CONSTRAINT llc_info_annual_fee_positive CHECK (annual_fee_baseline >= 0)
);

CREATE INDEX idx_llc_info_user ON llc_info(user_id) WHERE deleted_at IS NULL;

-- Trigger: update updated_at on INSERT/UPDATE
CREATE OR REPLACE TRIGGER llc_info_updated_at_trigger
BEFORE UPDATE ON llc_info
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE llc_info IS 'LLC registration and annual report tracking information';
COMMENT ON COLUMN llc_info.annual_report_due_month IS 'Month (1-12) when annual report is due (state-specific)';
COMMENT ON COLUMN llc_info.last_annual_report_push_year IS 'Year of last annual report push notification';

-- ============================================================================
-- K) CREATE TABLE llc_inbox_items
-- ============================================================================

CREATE TABLE IF NOT EXISTS llc_inbox_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  received_on DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  notes TEXT NULL,
  attachment_path TEXT NULL,
  sort_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE NULL,
  
  -- Constraints
  CONSTRAINT llc_inbox_items_status_check CHECK (
    status IN ('new', 'in_review', 'done', 'archived')
  )
);

CREATE INDEX idx_llc_inbox_items_user ON llc_inbox_items(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_llc_inbox_items_status ON llc_inbox_items(user_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_llc_inbox_items_received ON llc_inbox_items(received_on DESC) WHERE deleted_at IS NULL;

-- Trigger: update updated_at on INSERT/UPDATE
CREATE OR REPLACE TRIGGER llc_inbox_items_updated_at_trigger
BEFORE UPDATE ON llc_inbox_items
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE llc_inbox_items IS 'LLC-related inbox items (annual reports, documents, notices, etc.)';
COMMENT ON COLUMN llc_inbox_items.status IS 'Item status: new, in_review, done, archived';

-- ============================================================================
-- L) ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE business_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_cost_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_sops ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_sop_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_sop_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_sop_run_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_decision_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE llc_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE llc_inbox_items ENABLE ROW LEVEL SECURITY;

-- business_costs: owner-only
CREATE POLICY "business_costs_owner_select" ON business_costs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "business_costs_owner_insert" ON business_costs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "business_costs_owner_update" ON business_costs
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "business_costs_owner_delete" ON business_costs
  FOR DELETE
  USING (auth.uid() = user_id);

-- business_cost_templates: owner-only
CREATE POLICY "business_cost_templates_owner_select" ON business_cost_templates
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "business_cost_templates_owner_insert" ON business_cost_templates
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "business_cost_templates_owner_update" ON business_cost_templates
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "business_cost_templates_owner_delete" ON business_cost_templates
  FOR DELETE
  USING (auth.uid() = user_id);

-- business_milestones: owner-only
CREATE POLICY "business_milestones_owner_select" ON business_milestones
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "business_milestones_owner_insert" ON business_milestones
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "business_milestones_owner_update" ON business_milestones
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "business_milestones_owner_delete" ON business_milestones
  FOR DELETE
  USING (auth.uid() = user_id);

-- business_sops: owner-only
CREATE POLICY "business_sops_owner_select" ON business_sops
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "business_sops_owner_insert" ON business_sops
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "business_sops_owner_update" ON business_sops
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "business_sops_owner_delete" ON business_sops
  FOR DELETE
  USING (auth.uid() = user_id);

-- business_sop_items: owner-only (check user_id)
CREATE POLICY "business_sop_items_owner_select" ON business_sop_items
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "business_sop_items_owner_insert" ON business_sop_items
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "business_sop_items_owner_update" ON business_sop_items
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "business_sop_items_owner_delete" ON business_sop_items
  FOR DELETE
  USING (auth.uid() = user_id);

-- business_sop_runs: owner-only
CREATE POLICY "business_sop_runs_owner_select" ON business_sop_runs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "business_sop_runs_owner_insert" ON business_sop_runs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "business_sop_runs_owner_update" ON business_sop_runs
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "business_sop_runs_owner_delete" ON business_sop_runs
  FOR DELETE
  USING (auth.uid() = user_id);

-- business_sop_run_items: owner-only
CREATE POLICY "business_sop_run_items_owner_select" ON business_sop_run_items
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "business_sop_run_items_owner_insert" ON business_sop_run_items
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "business_sop_run_items_owner_update" ON business_sop_run_items
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "business_sop_run_items_owner_delete" ON business_sop_run_items
  FOR DELETE
  USING (auth.uid() = user_id);

-- business_decisions: owner-only
CREATE POLICY "business_decisions_owner_select" ON business_decisions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "business_decisions_owner_insert" ON business_decisions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "business_decisions_owner_update" ON business_decisions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "business_decisions_owner_delete" ON business_decisions
  FOR DELETE
  USING (auth.uid() = user_id);

-- business_decision_tasks: owner-only
CREATE POLICY "business_decision_tasks_owner_select" ON business_decision_tasks
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "business_decision_tasks_owner_insert" ON business_decision_tasks
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "business_decision_tasks_owner_update" ON business_decision_tasks
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "business_decision_tasks_owner_delete" ON business_decision_tasks
  FOR DELETE
  USING (auth.uid() = user_id);

-- llc_info: owner-only (UNIQUE user_id enforces one per user)
CREATE POLICY "llc_info_owner_select" ON llc_info
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "llc_info_owner_insert" ON llc_info
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "llc_info_owner_update" ON llc_info
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "llc_info_owner_delete" ON llc_info
  FOR DELETE
  USING (auth.uid() = user_id);

-- llc_inbox_items: owner-only
CREATE POLICY "llc_inbox_items_owner_select" ON llc_inbox_items
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "llc_inbox_items_owner_insert" ON llc_inbox_items
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "llc_inbox_items_owner_update" ON llc_inbox_items
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "llc_inbox_items_owner_delete" ON llc_inbox_items
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- M) CREATE TABLE business_alert_history
-- ============================================================================

CREATE TABLE IF NOT EXISTS business_alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  alert_month TEXT NULL, -- YYYY-MM format for monthly alerts
  subscriptions_sent INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT business_alert_history_alert_type_check CHECK (
    alert_type IN ('low_runway', 'annual_report')
  ),
  CONSTRAINT business_alert_history_unique_monthly UNIQUE (user_id, alert_type, alert_month) WHERE alert_month IS NOT NULL
);

CREATE INDEX idx_business_alert_history_user ON business_alert_history(user_id) WHERE alert_month IS NOT NULL;
CREATE INDEX idx_business_alert_history_type ON business_alert_history(alert_type, alert_month) WHERE alert_month IS NOT NULL;

COMMENT ON TABLE business_alert_history IS 'Track business alerts sent to users (low runway, annual reports) to prevent spam';
COMMENT ON COLUMN business_alert_history.alert_month IS 'Month alert was triggered (YYYY-MM) for monthly alerts';
COMMENT ON COLUMN business_alert_history.subscriptions_sent IS 'Count of push subscriptions notified';

-- ============================================================================
-- N) ENABLE RLS ON business_alert_history
-- ============================================================================

ALTER TABLE business_alert_history ENABLE ROW LEVEL SECURITY;

-- business_alert_history: owner-only
CREATE POLICY "business_alert_history_owner_select" ON business_alert_history
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "business_alert_history_owner_insert" ON business_alert_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
