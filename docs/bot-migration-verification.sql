-- Bot Intelligence Layer Migration Verification Queries
-- Run these after applying migrations 046-056 to verify setup

-- =============================================================================
-- 1. Verify all new tables exist and RLS is enabled
-- =============================================================================

SELECT
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
  'bot_signal_engine_state',
  'bot_regime_states',
  'bot_skills',
  'bot_skill_audit_log',
  'bot_active_skill',
  'iv_surface_snapshots',
  'paper_trades'
)
ORDER BY tablename;

-- Expected: 7 rows, all with rls_enabled = true


-- =============================================================================
-- 2. Verify bot_instances columns added (platform, is_paper_mode)
-- =============================================================================

SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'bot_instances'
AND column_name IN ('platform', 'is_paper_mode')
ORDER BY column_name;

-- Expected: 2 rows
-- platform: TEXT, NOT NULL, default 'MT5'
-- is_paper_mode: BOOLEAN, NOT NULL, default false


-- =============================================================================
-- 3. Verify indexes exist on performance-critical queries
-- =============================================================================

SELECT
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN (
  'bot_signal_engine_state',
  'bot_regime_states',
  'bot_skills',
  'bot_skill_audit_log',
  'bot_active_skill',
  'iv_surface_snapshots',
  'paper_trades'
)
ORDER BY tablename, indexname;

-- Expected indexes:
-- bot_signal_engine_state: idx_bot_signal_engine_state_instance_date
-- bot_regime_states: idx_bot_regime_states_instance_detected
-- bot_skills: idx_bot_skills_instrument_env_status
-- bot_skill_audit_log: idx_bot_skill_audit_log_skill_created
-- iv_surface_snapshots: idx_iv_surface_snapshots_instrument_at
-- paper_trades: idx_paper_trades_user_created, idx_paper_trades_symbol_created, idx_paper_trades_account_created


-- =============================================================================
-- 4. Verify RLS policies exist for each table
-- =============================================================================

SELECT
  schemaname,
  tablename,
  policyname,
  qual as policy_expression
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN (
  'bot_signal_engine_state',
  'bot_regime_states',
  'bot_skills',
  'bot_skill_audit_log',
  'bot_active_skill',
  'iv_surface_snapshots',
  'paper_trades'
)
ORDER BY tablename, policyname;

-- Expected: Each table should have 3-4 policies (SELECT, INSERT, UPDATE, DELETE)
-- All policies should reference auth.uid() = user_id


-- =============================================================================
-- 5. Verify triggers exist for updated_at columns
-- =============================================================================

SELECT
  trigger_schema,
  trigger_name,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND event_object_table IN (
  'bot_signal_engine_state',
  'bot_skills',
  'bot_active_skill',
  'paper_trades'
)
AND trigger_name LIKE '%updated_at%'
ORDER BY event_object_table, trigger_name;

-- Expected: 4 triggers using set_updated_at() function
-- - bot_signal_engine_state_updated_at
-- - bot_skills_updated_at
-- - bot_active_skill_updated_at
-- - paper_trades_updated_at


-- =============================================================================
-- 6. Verify storage bucket 'skills' exists with proper RLS
-- =============================================================================

SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'skills';

-- Expected: 1 row, public=false, file_size_limit=52428800


-- =============================================================================
-- 7. Verify storage policies for 'skills' bucket
-- =============================================================================

SELECT
  policyname,
  definition
FROM pg_policies
WHERE schemaname = 'storage'
AND tablename = 'objects'
AND policyname LIKE '%skills%'
ORDER BY policyname;

-- Expected: 3 policies (read, write, delete)
-- All should check: bucket_id = 'skills' AND user_id folder match


-- =============================================================================
-- 8. Verify CHECK constraints on bot_skills status
-- =============================================================================

SELECT
  constraint_name,
  constraint_definition
FROM information_schema.check_constraints
WHERE constraint_schema = 'public'
AND constraint_name LIKE '%bot_skills%'
ORDER BY constraint_name;

-- Expected: constraint for status IN ('learning', 'pending_approval', 'approved', 'rejected', 'frozen')
-- Expected: constraint for skill_type IN ('RL_POLICY', 'LLM_RULES', 'HYBRID')
-- Expected: constraint for environment IN ('paper', 'live')


-- =============================================================================
-- 9. Verify bot_regime_states regime_code enum values
-- =============================================================================

SELECT
  constraint_name,
  constraint_definition
FROM information_schema.check_constraints
WHERE constraint_schema = 'public'
AND constraint_name LIKE '%regime_code%'
ORDER BY constraint_name;

-- Expected: constraint for regime_code IN (
--   'BULL_TREND_STRONG',
--   'BULL_TREND_WEAK',
--   'BEAR_TREND_STRONG',
--   'BEAR_TREND_WEAK',
--   'SIDEWAYS_LOW_VOL',
--   'SIDEWAYS_HIGH_VOL',
--   'BREAKOUT_IMMINENT'
-- )


-- =============================================================================
-- 10. Verify foreign key relationships
-- =============================================================================

SELECT
  constraint_name,
  table_name,
  column_name,
  referenced_table_name,
  referenced_column_name
FROM information_schema.referential_constraints
WHERE constraint_schema = 'public'
AND (table_name IN (
  'bot_signal_engine_state',
  'bot_regime_states',
  'bot_skills',
  'bot_skill_audit_log',
  'bot_active_skill',
  'iv_surface_snapshots',
  'paper_trades'
) OR referenced_table_name = 'bot_skills')
ORDER BY table_name, constraint_name;

-- Expected relationships:
-- bot_signal_engine_state → bot_instances (bot_instance_id)
-- bot_regime_states → bot_instances (bot_instance_id)
-- bot_skill_audit_log → bot_skills (skill_id)
-- bot_active_skill → bot_skills (skill_id)
-- paper_trades → accounts (account_id)
-- paper_trades → setups (setup_id)
-- paper_trades → auth.users (user_id)


-- =============================================================================
-- 11. Quick Health Check: Count records in each new table
-- =============================================================================

SELECT
  'bot_signal_engine_state' as table_name,
  COUNT(*) as row_count,
  MAX(created_at) as latest_record
FROM bot_signal_engine_state
UNION ALL
SELECT
  'bot_regime_states',
  COUNT(*),
  MAX(created_at)
FROM bot_regime_states
UNION ALL
SELECT
  'bot_skills',
  COUNT(*),
  MAX(created_at)
FROM bot_skills
UNION ALL
SELECT
  'bot_skill_audit_log',
  COUNT(*),
  MAX(created_at)
FROM bot_skill_audit_log
UNION ALL
SELECT
  'bot_active_skill',
  COUNT(*),
  MAX(created_at)
FROM bot_active_skill
UNION ALL
SELECT
  'iv_surface_snapshots',
  COUNT(*),
  MAX(created_at)
FROM iv_surface_snapshots
UNION ALL
SELECT
  'paper_trades',
  COUNT(*),
  MAX(created_at)
FROM paper_trades
ORDER BY table_name;

-- Expected: All tables should exist (may be empty if no data yet)


-- =============================================================================
-- 12. Verify set_updated_at() trigger function exists
-- =============================================================================

SELECT
  routinename,
  routine_type,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routinename = 'set_updated_at'
AND routine_type = 'FUNCTION';

-- Expected: 1 row with function that updates updated_at = now()
