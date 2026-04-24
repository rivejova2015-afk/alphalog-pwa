-- Migration 058: trading_algorithms — diseño de estrategias para MT5/MT4
-- 50 slots por plataforma, tipos: scalping | grid_basket | arbitrage

CREATE TABLE public.trading_algorithms (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id),
  platform      TEXT        NOT NULL CHECK (platform IN ('MT4', 'MT5')),
  name          TEXT        NOT NULL CHECK (name <> ''),
  description   TEXT,
  algo_type     TEXT        NOT NULL CHECK (algo_type IN ('scalping', 'grid_basket', 'arbitrage')),
  status        TEXT        NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'paper', 'approved', 'live', 'paused', 'archived')),
  parameters    JSONB       NOT NULL DEFAULT '{}',
  slot_number   INTEGER     NOT NULL CHECK (slot_number BETWEEN 1 AND 50),
  sort_index    INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

-- Un slot por plataforma por usuario (ignora archivados/borrados)
CREATE UNIQUE INDEX idx_trading_algorithms_slot
  ON public.trading_algorithms(user_id, platform, slot_number)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_trading_algorithms_user_platform
  ON public.trading_algorithms(user_id, platform, status)
  WHERE deleted_at IS NULL;

ALTER TABLE public.trading_algorithms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "algorithms_all_own"
  ON public.trading_algorithms FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_trading_algorithms_updated_at
  BEFORE UPDATE ON public.trading_algorithms
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
