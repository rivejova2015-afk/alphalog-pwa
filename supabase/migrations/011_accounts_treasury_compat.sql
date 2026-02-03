-- 011: Accounts Treasury Compatibility
-- Add optional treasury-related fields to accounts table for advanced filtering/status

-- ============================================================================
-- A) ADD COLUMNS TO ACCOUNTS TABLE
-- ============================================================================

ALTER TABLE accounts 
ADD COLUMN IF NOT EXISTS account_size NUMERIC NULL,  -- Account size classification (micro, small, medium, large)
ADD COLUMN IF NOT EXISTS current_balance NUMERIC NULL,  -- Current account balance (denormalized for quick access)
ADD COLUMN IF NOT EXISTS withdrawals_enabled BOOLEAN NOT NULL DEFAULT TRUE,  -- Can user withdraw from this account?
ADD COLUMN IF NOT EXISTS phase_status TEXT NULL;  -- Phase tracking for multi-phase strategies

-- ============================================================================
-- B) BACKFILL DATA (if needed)
-- ============================================================================

-- Backfill current_balance/account_size from balance column (if it exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'accounts'
      AND column_name = 'balance'
  ) THEN
    -- This ensures we have a non-null value for existing accounts
    UPDATE accounts
    SET current_balance = COALESCE(balance, 0)
    WHERE current_balance IS NULL;

    -- Backfill account_size based on balance (optional categorization)
    -- Micro: < 5k, Small: 5k-50k, Medium: 50k-500k, Large: 500k+
    UPDATE accounts
    SET account_size = 
      CASE 
        WHEN COALESCE(balance, 0) < 5000 THEN 1  -- Micro
        WHEN COALESCE(balance, 0) < 50000 THEN 2  -- Small
        WHEN COALESCE(balance, 0) < 500000 THEN 3  -- Medium
        ELSE 4  -- Large
      END
    WHERE account_size IS NULL AND balance IS NOT NULL;
  END IF;
END $$;

-- ============================================================================
-- C) COMMENTS - Documentation
-- ============================================================================

COMMENT ON COLUMN accounts.account_size IS 'Account size classification: 1=Micro(<5k), 2=Small(5k-50k), 3=Medium(50k-500k), 4=Large(500k+)';
COMMENT ON COLUMN accounts.current_balance IS 'Current account balance (denormalized from balance for quick treasury queries)';
COMMENT ON COLUMN accounts.withdrawals_enabled IS 'Whether withdrawals are enabled for this account (default: true)';
COMMENT ON COLUMN accounts.phase_status IS 'Phase status for multi-phase strategies or account lifecycle tracking';

-- ============================================================================
-- Migration completed successfully
-- ============================================================================
