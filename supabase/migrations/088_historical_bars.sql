-- 088_historical_bars.sql
-- Historical OHLCV data for MT4/MT5/Dukascopy backtesting

CREATE TABLE IF NOT EXISTS public.historical_bars (
  id              bigserial,
  symbol          text         NOT NULL,
  timeframe       text         NOT NULL CHECK (timeframe IN ('M1','M5','M15','M30','H1','H4','D1','W1','MN1')),
  ts              timestamptz  NOT NULL,
  open            numeric(18,6) NOT NULL,
  high            numeric(18,6) NOT NULL,
  low             numeric(18,6) NOT NULL,
  close           numeric(18,6) NOT NULL,
  volume          bigint       NOT NULL DEFAULT 0,
  spread          integer,
  source          text         NOT NULL CHECK (source IN ('mt4','mt5','dukascopy','histdata')),
  uploaded_by     uuid         REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  PRIMARY KEY (symbol, timeframe, ts)
);

CREATE INDEX IF NOT EXISTS historical_bars_ts_brin
  ON public.historical_bars USING brin (ts);

CREATE INDEX IF NOT EXISTS historical_bars_symbol_tf
  ON public.historical_bars (symbol, timeframe, ts DESC);

ALTER TABLE public.historical_bars ENABLE ROW LEVEL SECURITY;

-- Read: any authenticated user can query historical data
CREATE POLICY historical_bars_select_all ON public.historical_bars FOR SELECT
  USING (auth.role() = 'authenticated');

-- Insert/update: only service role (via /api/historical-bars/ingest with HMAC)
CREATE POLICY historical_bars_service_only ON public.historical_bars FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Coverage tracker: which symbol/tf ranges are loaded
CREATE TABLE IF NOT EXISTS public.historical_bars_coverage (
  symbol         text NOT NULL,
  timeframe      text NOT NULL,
  source         text NOT NULL,
  range_start    timestamptz NOT NULL,
  range_end      timestamptz NOT NULL,
  bar_count      bigint NOT NULL,
  last_ingest_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (symbol, timeframe, source)
);

ALTER TABLE public.historical_bars_coverage ENABLE ROW LEVEL SECURITY;

CREATE POLICY historical_bars_coverage_select_all ON public.historical_bars_coverage FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY historical_bars_coverage_service_only ON public.historical_bars_coverage FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
