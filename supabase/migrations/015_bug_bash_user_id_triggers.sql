-- Bug Bash: Auto-set user_id triggers for RLS-protected tables
-- This ensures that any INSERT without explicit user_id gets auth.uid() set automatically
-- Prevents RLS policy failures due to missing/null user_id

-- ============================================================================
-- Helper Function: auto_set_user_id (BEFORE INSERT trigger)
-- ============================================================================
-- Sets NEW.user_id = auth.uid() if user_id is NULL
-- Allows explicit user_id to pass through if provided (for testing/admin)

CREATE OR REPLACE FUNCTION auto_set_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id = auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Business Module Tables
-- ============================================================================

-- business_costs: auto-set user_id
DROP TRIGGER IF EXISTS business_costs_auto_user_id ON business_costs;
CREATE TRIGGER business_costs_auto_user_id
BEFORE INSERT ON business_costs
FOR EACH ROW
EXECUTE FUNCTION auto_set_user_id();

-- business_cost_templates: auto-set user_id
DROP TRIGGER IF EXISTS business_cost_templates_auto_user_id ON business_cost_templates;
CREATE TRIGGER business_cost_templates_auto_user_id
BEFORE INSERT ON business_cost_templates
FOR EACH ROW
EXECUTE FUNCTION auto_set_user_id();

-- business_milestones: auto-set user_id
DROP TRIGGER IF EXISTS business_milestones_auto_user_id ON business_milestones;
CREATE TRIGGER business_milestones_auto_user_id
BEFORE INSERT ON business_milestones
FOR EACH ROW
EXECUTE FUNCTION auto_set_user_id();

-- business_sops: auto-set user_id
DROP TRIGGER IF EXISTS business_sops_auto_user_id ON business_sops;
CREATE TRIGGER business_sops_auto_user_id
BEFORE INSERT ON business_sops
FOR EACH ROW
EXECUTE FUNCTION auto_set_user_id();

-- business_sop_items: auto-set user_id
DROP TRIGGER IF EXISTS business_sop_items_auto_user_id ON business_sop_items;
CREATE TRIGGER business_sop_items_auto_user_id
BEFORE INSERT ON business_sop_items
FOR EACH ROW
EXECUTE FUNCTION auto_set_user_id();

-- business_sop_runs: auto-set user_id
DROP TRIGGER IF EXISTS business_sop_runs_auto_user_id ON business_sop_runs;
CREATE TRIGGER business_sop_runs_auto_user_id
BEFORE INSERT ON business_sop_runs
FOR EACH ROW
EXECUTE FUNCTION auto_set_user_id();

-- business_sop_run_items: auto-set user_id
DROP TRIGGER IF EXISTS business_sop_run_items_auto_user_id ON business_sop_run_items;
CREATE TRIGGER business_sop_run_items_auto_user_id
BEFORE INSERT ON business_sop_run_items
FOR EACH ROW
EXECUTE FUNCTION auto_set_user_id();

-- business_decisions: auto-set user_id
DROP TRIGGER IF EXISTS business_decisions_auto_user_id ON business_decisions;
CREATE TRIGGER business_decisions_auto_user_id
BEFORE INSERT ON business_decisions
FOR EACH ROW
EXECUTE FUNCTION auto_set_user_id();

-- business_decision_tasks: auto-set user_id
DROP TRIGGER IF EXISTS business_decision_tasks_auto_user_id ON business_decision_tasks;
CREATE TRIGGER business_decision_tasks_auto_user_id
BEFORE INSERT ON business_decision_tasks
FOR EACH ROW
EXECUTE FUNCTION auto_set_user_id();

-- llc_info: auto-set user_id
DROP TRIGGER IF EXISTS llc_info_auto_user_id ON llc_info;
CREATE TRIGGER llc_info_auto_user_id
BEFORE INSERT ON llc_info
FOR EACH ROW
EXECUTE FUNCTION auto_set_user_id();

-- llc_inbox_items: auto-set user_id
DROP TRIGGER IF EXISTS llc_inbox_items_auto_user_id ON llc_inbox_items;
CREATE TRIGGER llc_inbox_items_auto_user_id
BEFORE INSERT ON llc_inbox_items
FOR EACH ROW
EXECUTE FUNCTION auto_set_user_id();

-- ============================================================================
-- Journal/Logs Module Tables
-- ============================================================================

-- logs: auto-set user_id
DO $$
BEGIN
  IF to_regclass('public.logs') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS logs_auto_user_id ON public.logs;
    CREATE TRIGGER logs_auto_user_id
    BEFORE INSERT ON public.logs
    FOR EACH ROW
    EXECUTE FUNCTION auto_set_user_id();
  END IF;
END $$;

-- categories: auto-set user_id
DO $$
BEGIN
  IF to_regclass('public.categories') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS categories_auto_user_id ON public.categories;
    CREATE TRIGGER categories_auto_user_id
    BEFORE INSERT ON public.categories
    FOR EACH ROW
    EXECUTE FUNCTION auto_set_user_id();
  END IF;
END $$;

-- tags: auto-set user_id (if exists)
DO $$
BEGIN
  IF to_regclass('public.tags') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS tags_auto_user_id ON public.tags;
    CREATE TRIGGER tags_auto_user_id
    BEFORE INSERT ON public.tags
    FOR EACH ROW
    WHEN (NEW.user_id IS NOT NULL)
    EXECUTE FUNCTION auto_set_user_id();
  END IF;
END $$;

-- log_attachments: auto-set user_id
DO $$
BEGIN
  IF to_regclass('public.log_attachments') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS log_attachments_auto_user_id ON public.log_attachments;
    CREATE TRIGGER log_attachments_auto_user_id
    BEFORE INSERT ON public.log_attachments
    FOR EACH ROW
    EXECUTE FUNCTION auto_set_user_id();
  END IF;
END $$;

-- ============================================================================
-- Treasury Module Tables (if they support user_id)
-- ============================================================================

-- treasury_transactions: auto-set user_id (if applicable)
DO $$
BEGIN
  IF to_regclass('public.treasury_transactions') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS treasury_transactions_auto_user_id ON public.treasury_transactions;
    CREATE TRIGGER treasury_transactions_auto_user_id
    BEFORE INSERT ON public.treasury_transactions
    FOR EACH ROW
    WHEN (NEW.user_id IS NOT NULL)
    EXECUTE FUNCTION auto_set_user_id();
  END IF;
END $$;

-- treasury_budgets: auto-set user_id (if applicable)
DO $$
BEGIN
  IF to_regclass('public.treasury_budgets') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS treasury_budgets_auto_user_id ON public.treasury_budgets;
    CREATE TRIGGER treasury_budgets_auto_user_id
    BEFORE INSERT ON public.treasury_budgets
    FOR EACH ROW
    WHEN (NEW.user_id IS NOT NULL)
    EXECUTE FUNCTION auto_set_user_id();
  END IF;
END $$;

-- ============================================================================
-- TradeHub Module Tables
-- ============================================================================

-- trades: auto-set user_id (if applicable)
DO $$
BEGIN
  IF to_regclass('public.trades') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trades_auto_user_id ON public.trades;
    CREATE TRIGGER trades_auto_user_id
    BEFORE INSERT ON public.trades
    FOR EACH ROW
    WHEN (NEW.user_id IS NOT NULL)
    EXECUTE FUNCTION auto_set_user_id();
  END IF;
END $$;

-- tradehub evidence: auto-set user_id (if applicable)
DO $$
BEGIN
  IF to_regclass('public.tv_analysis_evidence') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS tv_analysis_evidence_auto_user_id ON public.tv_analysis_evidence;
    CREATE TRIGGER tv_analysis_evidence_auto_user_id
    BEFORE INSERT ON public.tv_analysis_evidence
    FOR EACH ROW
    WHEN (NEW.user_id IS NOT NULL)
    EXECUTE FUNCTION auto_set_user_id();
  END IF;
END $$;

-- ============================================================================
-- Terminal Module Tables
-- ============================================================================

-- terminal_news: auto-set user_id (if applicable)
DO $$
BEGIN
  IF to_regclass('public.terminal_news') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS terminal_news_auto_user_id ON public.terminal_news;
    CREATE TRIGGER terminal_news_auto_user_id
    BEFORE INSERT ON public.terminal_news
    FOR EACH ROW
    WHEN (NEW.user_id IS NOT NULL)
    EXECUTE FUNCTION auto_set_user_id();
  END IF;
END $$;

-- terminal_events: auto-set user_id (if applicable)
DO $$
BEGIN
  IF to_regclass('public.terminal_events') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS terminal_events_auto_user_id ON public.terminal_events;
    CREATE TRIGGER terminal_events_auto_user_id
    BEFORE INSERT ON public.terminal_events
    FOR EACH ROW
    WHEN (NEW.user_id IS NOT NULL)
    EXECUTE FUNCTION auto_set_user_id();
  END IF;
END $$;

-- terminal_evidence_reports: auto-set user_id (if applicable)
DO $$
BEGIN
  IF to_regclass('public.terminal_evidence_reports') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS terminal_evidence_reports_auto_user_id ON public.terminal_evidence_reports;
    CREATE TRIGGER terminal_evidence_reports_auto_user_id
    BEFORE INSERT ON public.terminal_evidence_reports
    FOR EACH ROW
    WHEN (NEW.user_id IS NOT NULL)
    EXECUTE FUNCTION auto_set_user_id();
  END IF;
END $$;

-- ============================================================================
-- TraderMap Module Tables
-- ============================================================================

-- tradermap_goals: auto-set user_id (if applicable)
DO $$
BEGIN
  IF to_regclass('public.tradermap_goals') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS tradermap_goals_auto_user_id ON public.tradermap_goals;
    CREATE TRIGGER tradermap_goals_auto_user_id
    BEFORE INSERT ON public.tradermap_goals
    FOR EACH ROW
    WHEN (NEW.user_id IS NOT NULL)
    EXECUTE FUNCTION auto_set_user_id();
  END IF;
END $$;

-- ============================================================================
-- Comment for Documentation
-- ============================================================================

COMMENT ON FUNCTION auto_set_user_id() IS 
'Automatically sets user_id = auth.uid() on INSERT if user_id is NULL.
Attached via BEFORE INSERT triggers to RLS-protected user-scoped tables.
Prevents RLS policy violations due to missing user_id while allowing explicit values for testing.';

