-- 010: Treasury Core Tables
-- Tesorería: configs, wallets, transactions, budgets, payouts
-- RLS: owner-only access (auth.uid() = user_id)

-- ============================================================================
-- A) TREASURY_CONFIGS - Configuración de retiros y protecciones por cuenta
-- ============================================================================
CREATE TABLE IF NOT EXISTS treasury_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  
  -- Withdrawal settings
  withdrawal_day INT NOT NULL DEFAULT 1,  -- Day of month for withdrawal
  
  -- Split mode: growth (50% retirable), safe (40%), cash (100%)
  split_mode TEXT NOT NULL DEFAULT 'growth' CHECK (split_mode IN ('growth', 'safe', 'cash')),
  
  -- Balance protection
  balance_threshold NUMERIC NULL,  -- Min balance before alert
  
  -- Anti-drawdown protection
  anti_drawdown_active BOOLEAN NOT NULL DEFAULT FALSE,
  anti_drawdown_threshold NUMERIC NOT NULL DEFAULT 20,  -- % threshold
  
  -- Tax buffer (quarterly/annual reserve)
  tax_buffer_percentage NUMERIC NOT NULL DEFAULT 30,  -- % of profits
  tax_buffer_target NUMERIC NULL,  -- Annual target ($)
  tax_buffer_accumulated NUMERIC NOT NULL DEFAULT 0,  -- Already saved ($)
  
  -- Milestone tracking (50k+ bonus vault)
  milestone_target NUMERIC NULL,  -- Target balance (default 50000)
  milestone_bonus_vault NUMERIC NOT NULL DEFAULT 0,  -- Accumulated bonus
  
  -- UI state
  sort_index INT NOT NULL DEFAULT 0,
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE NULL

  -- Unique: one config per user+account (handled via partial index below)
);

CREATE UNIQUE INDEX IF NOT EXISTS treasury_configs_user_account_uq ON treasury_configs(user_id, account_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_treasury_configs_user_id ON treasury_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_treasury_configs_account_id ON treasury_configs(account_id);
CREATE INDEX IF NOT EXISTS idx_treasury_configs_user_account ON treasury_configs(user_id, account_id) WHERE deleted_at IS NULL;

-- ============================================================================
-- B) TREASURY_WALLETS - Multi-currency wallets (cash, savings, crypto, etc)
-- ============================================================================
CREATE TABLE IF NOT EXISTS treasury_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,  -- "Cash Wallet", "Savings", "Crypto", etc.
  currency TEXT NOT NULL,  -- "USD", "EUR", "BTC", etc.
  
  -- Starting balance for this wallet (baseline)
  starting_balance NUMERIC NOT NULL DEFAULT 0,
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE NULL

  -- Unique: one wallet per user+name (case-insensitive) handled via partial index below
);

CREATE UNIQUE INDEX IF NOT EXISTS treasury_wallets_user_name_uq ON treasury_wallets(user_id, LOWER(name)) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_treasury_wallets_user_id ON treasury_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_treasury_wallets_user_name ON treasury_wallets(user_id, name) WHERE deleted_at IS NULL;

-- ============================================================================
-- C) TREASURY_TRANSACTIONS - Income, expenses, transfers, adjustments
-- ============================================================================
CREATE TABLE IF NOT EXISTS treasury_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES treasury_wallets(id) ON DELETE CASCADE,
  account_id UUID NULL REFERENCES accounts(id) ON DELETE SET NULL,  -- Optional: link to trading account
  
  -- Transaction type
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer', 'adjustment')),
  
  -- Amount and date
  amount NUMERIC NOT NULL,  -- Can be positive or negative
  occurred_on DATE NOT NULL,
  
  -- Context
  description TEXT NULL,  -- "Profit from XAU account", "Monthly rent", etc.
  notes TEXT NULL,
  
  -- UI state
  sort_index INT NOT NULL DEFAULT 0,
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE NULL
);

CREATE INDEX IF NOT EXISTS idx_treasury_transactions_user_id ON treasury_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_treasury_transactions_wallet_id ON treasury_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_treasury_transactions_account_id ON treasury_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_treasury_transactions_user_date ON treasury_transactions(user_id, occurred_on DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_treasury_transactions_user_wallet ON treasury_transactions(user_id, wallet_id) WHERE deleted_at IS NULL;

-- ============================================================================
-- D) TREASURY_BUDGETS - Period-based budgets (income/expense targets)
-- ============================================================================
CREATE TABLE IF NOT EXISTS treasury_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES treasury_wallets(id) ON DELETE CASCADE,
  
  -- Budget period (e.g., Jan 1 - Jan 31, Q1, etc.)
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Targets for this period
  target_income NUMERIC NULL,  -- Expected income
  target_expense NUMERIC NULL,  -- Expected expenses
  target_payout NUMERIC NULL,  -- Expected withdrawals
  
  -- Notes
  notes TEXT NULL,
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE NULL
);

CREATE INDEX IF NOT EXISTS idx_treasury_budgets_user_id ON treasury_budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_treasury_budgets_wallet_id ON treasury_budgets(wallet_id);
CREATE INDEX IF NOT EXISTS idx_treasury_budgets_user_period ON treasury_budgets(user_id, period_start DESC) WHERE deleted_at IS NULL;

-- ============================================================================
-- E) TREASURY_PAYOUTS - Withdrawal plan and tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS treasury_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES treasury_wallets(id) ON DELETE CASCADE,
  
  -- Payout details
  payout_date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  
  -- Status: planned → sent → received (or canceled)
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'sent', 'received', 'canceled')),
  
  -- Method: bank transfer, crypto, cash, etc.
  method TEXT NULL,
  
  -- Context
  notes TEXT NULL,
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE NULL
);

CREATE INDEX IF NOT EXISTS idx_treasury_payouts_user_id ON treasury_payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_treasury_payouts_account_id ON treasury_payouts(account_id);
CREATE INDEX IF NOT EXISTS idx_treasury_payouts_wallet_id ON treasury_payouts(wallet_id);
CREATE INDEX IF NOT EXISTS idx_treasury_payouts_user_date ON treasury_payouts(user_id, payout_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_treasury_payouts_user_account ON treasury_payouts(user_id, account_id) WHERE deleted_at IS NULL;

-- ============================================================================
-- RLS POLICIES - Owner-only access for all treasury tables
-- ============================================================================

-- treasury_configs RLS
ALTER TABLE treasury_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own treasury configs" ON treasury_configs;
CREATE POLICY "Users can insert own treasury configs"
  ON treasury_configs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own treasury configs" ON treasury_configs;
CREATE POLICY "Users can read own treasury configs"
  ON treasury_configs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own treasury configs" ON treasury_configs;
CREATE POLICY "Users can update own treasury configs"
  ON treasury_configs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own treasury configs" ON treasury_configs;
CREATE POLICY "Users can delete own treasury configs"
  ON treasury_configs FOR DELETE
  USING (auth.uid() = user_id);

-- treasury_wallets RLS
ALTER TABLE treasury_wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own treasury wallets" ON treasury_wallets;
CREATE POLICY "Users can insert own treasury wallets"
  ON treasury_wallets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own treasury wallets" ON treasury_wallets;
CREATE POLICY "Users can read own treasury wallets"
  ON treasury_wallets FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own treasury wallets" ON treasury_wallets;
CREATE POLICY "Users can update own treasury wallets"
  ON treasury_wallets FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own treasury wallets" ON treasury_wallets;
CREATE POLICY "Users can delete own treasury wallets"
  ON treasury_wallets FOR DELETE
  USING (auth.uid() = user_id);

-- treasury_transactions RLS
ALTER TABLE treasury_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own treasury transactions" ON treasury_transactions;
CREATE POLICY "Users can insert own treasury transactions"
  ON treasury_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own treasury transactions" ON treasury_transactions;
CREATE POLICY "Users can read own treasury transactions"
  ON treasury_transactions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own treasury transactions" ON treasury_transactions;
CREATE POLICY "Users can update own treasury transactions"
  ON treasury_transactions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own treasury transactions" ON treasury_transactions;
CREATE POLICY "Users can delete own treasury transactions"
  ON treasury_transactions FOR DELETE
  USING (auth.uid() = user_id);

-- treasury_budgets RLS
ALTER TABLE treasury_budgets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own treasury budgets" ON treasury_budgets;
CREATE POLICY "Users can insert own treasury budgets"
  ON treasury_budgets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own treasury budgets" ON treasury_budgets;
CREATE POLICY "Users can read own treasury budgets"
  ON treasury_budgets FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own treasury budgets" ON treasury_budgets;
CREATE POLICY "Users can update own treasury budgets"
  ON treasury_budgets FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own treasury budgets" ON treasury_budgets;
CREATE POLICY "Users can delete own treasury budgets"
  ON treasury_budgets FOR DELETE
  USING (auth.uid() = user_id);

-- treasury_payouts RLS
ALTER TABLE treasury_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own treasury payouts" ON treasury_payouts;
CREATE POLICY "Users can insert own treasury payouts"
  ON treasury_payouts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own treasury payouts" ON treasury_payouts;
CREATE POLICY "Users can read own treasury payouts"
  ON treasury_payouts FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own treasury payouts" ON treasury_payouts;
CREATE POLICY "Users can update own treasury payouts"
  ON treasury_payouts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own treasury payouts" ON treasury_payouts;
CREATE POLICY "Users can delete own treasury payouts"
  ON treasury_payouts FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- TRIGGERS - Auto-update updated_at timestamps
-- ============================================================================

-- Reuse existing set_updated_at function if it exists, else create
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- treasury_configs updated_at trigger
DROP TRIGGER IF EXISTS treasury_configs_updated_at_trigger ON treasury_configs;
CREATE TRIGGER treasury_configs_updated_at_trigger
BEFORE UPDATE ON treasury_configs
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- treasury_wallets updated_at trigger
DROP TRIGGER IF EXISTS treasury_wallets_updated_at_trigger ON treasury_wallets;
CREATE TRIGGER treasury_wallets_updated_at_trigger
BEFORE UPDATE ON treasury_wallets
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- treasury_transactions updated_at trigger
DROP TRIGGER IF EXISTS treasury_transactions_updated_at_trigger ON treasury_transactions;
CREATE TRIGGER treasury_transactions_updated_at_trigger
BEFORE UPDATE ON treasury_transactions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- treasury_budgets updated_at trigger
DROP TRIGGER IF EXISTS treasury_budgets_updated_at_trigger ON treasury_budgets;
CREATE TRIGGER treasury_budgets_updated_at_trigger
BEFORE UPDATE ON treasury_budgets
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- treasury_payouts updated_at trigger
DROP TRIGGER IF EXISTS treasury_payouts_updated_at_trigger ON treasury_payouts;
CREATE TRIGGER treasury_payouts_updated_at_trigger
BEFORE UPDATE ON treasury_payouts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- COMMENTS - Documentation
-- ============================================================================

COMMENT ON TABLE treasury_configs IS 'Treasury configuration per account: withdrawal day, split mode, protections, tax buffer, milestone tracking';
COMMENT ON TABLE treasury_wallets IS 'Multi-currency wallets: cash, savings, crypto, etc. One wallet can hold multiple transaction types.';
COMMENT ON TABLE treasury_transactions IS 'All treasury transactions: income, expenses, transfers, adjustments. Links wallet and optional trading account.';
COMMENT ON TABLE treasury_budgets IS 'Period-based budget targets: income/expense/payout goals for a wallet during a time period.';
COMMENT ON TABLE treasury_payouts IS 'Payout planning and tracking: planned/sent/received/canceled withdrawals from trading accounts.';

-- ============================================================================
-- Migration completed successfully
-- ============================================================================
