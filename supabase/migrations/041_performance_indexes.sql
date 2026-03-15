-- Migration 041: Composite performance indexes
-- Adds indexes for the most frequently filtered columns
-- across trades, logs, trade_evidence, and tags tables

-- trades: user+exit_date (used in AlphaBrief weekly reports + evidence filter)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trades_user_exit_date
  ON trades (user_id, exit_date)
  WHERE deleted_at IS NULL;

-- trades: user+entry_date (used in bot-telemetry and scheduled reports)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trades_user_entry_date
  ON trades (user_id, entry_date)
  WHERE deleted_at IS NULL;

-- logs: user+deleted_at+created_at (used in GET /api/logs pagination)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_logs_user_active_created
  ON logs (user_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- logs: user+deleted_at+category_id (used when filtering by category)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_logs_user_category
  ON logs (user_id, category_id)
  WHERE deleted_at IS NULL;

-- log_tags: log_id (used in joins from logs query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_log_tags_log_id
  ON log_tags (log_id);

-- tags: user+name_lower (used in tag lookup during log create/update)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tags_user_name_lower
  ON tags (user_id, name_lower)
  WHERE deleted_at IS NULL;

-- trade_evidence: user+created_at (used in GET /api/tradehub/evidence pagination)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trade_evidence_user_created
  ON trade_evidence (user_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- tv_analysis_evidence: user+captured_at (legacy evidence pagination)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tv_evidence_user_captured
  ON tv_analysis_evidence (user_id, captured_at DESC)
  WHERE deleted_at IS NULL;

-- account_categories: user+deleted_at (used in account list joins)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_account_categories_user_active
  ON account_categories (user_id)
  WHERE deleted_at IS NULL;

-- weekly_reports: user+week_start+week_end (used in version lookup)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_weekly_reports_user_week
  ON weekly_reports (user_id, week_start, week_end)
  WHERE deleted_at IS NULL;
