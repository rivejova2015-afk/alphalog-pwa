-- 012: Treasury Payout Engine
-- Extends treasury_configs with wallet_id and threshold push tracking
-- Extends treasury_payouts with cycle tracking, breakdown fields, and versioning
-- Enables comprehensive payout calculation and management

-- ============================================================================
-- A) ALTER treasury_configs - Add wallet mapping and threshold tracking
-- ============================================================================

ALTER TABLE treasury_configs
ADD COLUMN IF NOT EXISTS wallet_id UUID REFERENCES treasury_wallets(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS last_threshold_push_cycle_start DATE NULL;

-- Index for wallet_id lookups
CREATE INDEX IF NOT EXISTS idx_treasury_configs_wallet_id ON treasury_configs(wallet_id) WHERE deleted_at IS NULL;

COMMENT ON COLUMN treasury_configs.wallet_id IS 'FK to treasury_wallets: target wallet for payout transfers';
COMMENT ON COLUMN treasury_configs.last_threshold_push_cycle_start IS 'Date when threshold push was last sent for current cycle (to avoid duplicates)';

-- ============================================================================
-- B) ALTER treasury_payouts - Add cycle, breakdown, and versioning
-- ============================================================================

ALTER TABLE treasury_payouts
ADD COLUMN IF NOT EXISTS cycle_start DATE NOT NULL DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS cycle_expected_end DATE NOT NULL DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS calc_cutoff DATE NOT NULL DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS cash_payout_amount NUMERIC NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_reserve_amount NUMERIC NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS bonus_vault_amount NUMERIC NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS blocked_reasons JSONB NOT NULL DEFAULT '[]';

-- Index for version lookups within cycle
CREATE INDEX IF NOT EXISTS idx_treasury_payouts_cycle ON treasury_payouts(user_id, account_id, cycle_start) WHERE deleted_at IS NULL;

-- Unique constraint: one active payout per user+account+cycle+version
ALTER TABLE treasury_payouts
DROP CONSTRAINT IF EXISTS treasury_payouts_unique_version;

ALTER TABLE treasury_payouts
ADD CONSTRAINT treasury_payouts_unique_version UNIQUE (user_id, account_id, cycle_start, version) WHERE deleted_at IS NULL;

COMMENT ON COLUMN treasury_payouts.cycle_start IS 'Start date of the cycle (e.g., withdrawal_day of that month)';
COMMENT ON COLUMN treasury_payouts.cycle_expected_end IS 'Expected end date of the cycle (day before next cycle_start)';
COMMENT ON COLUMN treasury_payouts.calc_cutoff IS 'Date on which calculations were performed (usually TODAY)';
COMMENT ON COLUMN treasury_payouts.version IS 'Version number within the cycle (v1, v2, etc.) for repeated payouts';
COMMENT ON COLUMN treasury_payouts.cash_payout_amount IS 'Cash amount to withdraw: max(0, retirable - tax_reserve - bonus_vault)';
COMMENT ON COLUMN treasury_payouts.tax_reserve_amount IS 'Amount reserved for taxes: retirable * (tax_buffer_percentage/100)';
COMMENT ON COLUMN treasury_payouts.bonus_vault_amount IS 'Amount going to bonus vault (milestone tracker)';
COMMENT ON COLUMN treasury_payouts.blocked_reasons IS 'Array of reasons preventing payout (e.g., ["anti_dd_active", "balance_below_threshold"])';

-- ============================================================================
-- C) TRIGGER - Ensure updated_at is set on treasury_payouts updates
-- ============================================================================

DROP TRIGGER IF EXISTS treasury_payouts_updated_at_trigger ON treasury_payouts;

CREATE TRIGGER treasury_payouts_updated_at_trigger
BEFORE UPDATE ON treasury_payouts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- D) RLS POLICIES - Update treasury_payouts for new columns
-- ============================================================================

-- Policies already exist from migration 010, they apply to all columns

-- ============================================================================
-- Migration completed successfully
-- ============================================================================
