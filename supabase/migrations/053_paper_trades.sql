-- Migration 053: Paper trades — exact mirror of trades table for simulation (separate isolation)

CREATE TABLE IF NOT EXISTS public.paper_trades (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id              UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,

  symbol                  TEXT NOT NULL,
  direction               TEXT NOT NULL,
  status                  TEXT NOT NULL,
  entry_date              DATE NOT NULL,
  entry_price             NUMERIC NOT NULL,
  exit_price              NUMERIC NOT NULL,
  stop_loss_price         NUMERIC NOT NULL,
  take_profit_price       NUMERIC NOT NULL,
  lots                    NUMERIC NOT NULL,
  pnl                     NUMERIC NOT NULL,
  pnl_percent             NUMERIC NOT NULL,

  exit_date               DATE NULL,
  notes                   TEXT NULL,
  setup_id                UUID NULL REFERENCES public.setups(id) ON DELETE SET NULL,
  screenshot_path         TEXT NULL,
  is_featured_in_report   BOOLEAN NOT NULL DEFAULT false,
  sort_index              INT NOT NULL DEFAULT 0,

  is_paper                BOOLEAN NOT NULL DEFAULT true,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at              TIMESTAMPTZ NULL,

  CONSTRAINT paper_trades_symbol_not_empty
    CHECK (length(trim(symbol)) > 0),
  CONSTRAINT paper_trades_direction_not_empty
    CHECK (length(trim(direction)) > 0),
  CONSTRAINT paper_trades_status_not_empty
    CHECK (length(trim(status)) > 0),
  CONSTRAINT paper_trades_lots_positive
    CHECK (lots > 0),
  CONSTRAINT paper_trades_prices_reasonable
    CHECK (entry_price >= 0 AND exit_price >= 0 AND stop_loss_price >= 0 AND take_profit_price >= 0)
);

CREATE INDEX IF NOT EXISTS idx_paper_trades_user_created
  ON public.paper_trades(user_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_paper_trades_symbol_created
  ON public.paper_trades(symbol, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_paper_trades_account_created
  ON public.paper_trades(account_id, created_at DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE public.paper_trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY paper_trades_select_own ON public.paper_trades
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY paper_trades_insert_own ON public.paper_trades
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY paper_trades_update_own ON public.paper_trades
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY paper_trades_delete_own ON public.paper_trades
  FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS paper_trades_updated_at ON public.paper_trades;
CREATE TRIGGER paper_trades_updated_at
  BEFORE UPDATE ON public.paper_trades
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
