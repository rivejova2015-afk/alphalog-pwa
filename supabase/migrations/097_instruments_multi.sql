-- Migration 097: instruments DB-backed + multi-select on algorithms.instrument
-- Adds category/market_type to instruments, seeds the full catalog (formerly
-- hardcoded in NewStrategyWizard), and converts algorithms.instrument from
-- text to text[] so each strategy can target multiple symbols.
-- Existing rows are wrapped in a single-element array via USING ARRAY[instrument].

-- 1a. Add columns to instruments
ALTER TABLE public.instruments
  ADD COLUMN IF NOT EXISTS category    text NOT NULL DEFAULT 'Otros',
  ADD COLUMN IF NOT EXISTS market_type text NOT NULL DEFAULT 'forex';

-- 1b. Update the 2 existing instruments
UPDATE public.instruments SET category = 'Metales',  market_type = 'metals'  WHERE symbol = 'XAUUSD';
UPDATE public.instruments SET category = 'Indices',  market_type = 'indices' WHERE symbol = 'US500';

-- 1c. Seed the rest of the catalog (idempotent via ON CONFLICT)
INSERT INTO public.instruments (symbol, display_name, category, market_type, sort_index)
VALUES
  ('XAGUSD', 'XAGUSD (Silver)',    'Metales',  'metals',  3),
  ('XPTUSD', 'XPTUSD (Platinum)',  'Metales',  'metals',  4),
  ('XPDUSD', 'XPDUSD (Palladium)', 'Metales',  'metals',  5),

  ('EURUSD', 'EURUSD',             'Forex Majors', 'forex', 10),
  ('GBPUSD', 'GBPUSD',             'Forex Majors', 'forex', 11),
  ('USDJPY', 'USDJPY',             'Forex Majors', 'forex', 12),
  ('USDCHF', 'USDCHF',             'Forex Majors', 'forex', 13),
  ('AUDUSD', 'AUDUSD',             'Forex Majors', 'forex', 14),
  ('NZDUSD', 'NZDUSD',             'Forex Majors', 'forex', 15),
  ('USDCAD', 'USDCAD',             'Forex Majors', 'forex', 16),

  ('GBPJPY', 'GBPJPY',             'Forex Crosses', 'forex', 20),
  ('EURJPY', 'EURJPY',             'Forex Crosses', 'forex', 21),
  ('EURGBP', 'EURGBP',             'Forex Crosses', 'forex', 22),
  ('AUDJPY', 'AUDJPY',             'Forex Crosses', 'forex', 23),
  ('CHFJPY', 'CHFJPY',             'Forex Crosses', 'forex', 24),
  ('EURAUD', 'EURAUD',             'Forex Crosses', 'forex', 25),
  ('EURCAD', 'EURCAD',             'Forex Crosses', 'forex', 26),
  ('GBPAUD', 'GBPAUD',             'Forex Crosses', 'forex', 27),
  ('GBPCAD', 'GBPCAD',             'Forex Crosses', 'forex', 28),
  ('CADCHF', 'CADCHF',             'Forex Crosses', 'forex', 29),
  ('AUDCAD', 'AUDCAD',             'Forex Crosses', 'forex', 30),
  ('AUDNZD', 'AUDNZD',             'Forex Crosses', 'forex', 31),

  ('NAS100', 'NAS100 (Nasdaq)',    'Indices', 'indices', 40),
  ('GER40',  'GER40 (DAX)',        'Indices', 'indices', 41),
  ('UK100',  'UK100 (FTSE)',       'Indices', 'indices', 42),
  ('JPN225', 'JPN225 (Nikkei)',    'Indices', 'indices', 43),
  ('FRA40',  'FRA40 (CAC)',        'Indices', 'indices', 44),
  ('AUS200', 'AUS200 (ASX)',       'Indices', 'indices', 45),

  ('USOIL',  'USOIL (WTI Crude)',  'Futuros', 'futures', 50),
  ('UKOIL',  'UKOIL (Brent)',      'Futuros', 'futures', 51),
  ('NATGAS', 'NATGAS',             'Futuros', 'futures', 52),
  ('WHEAT',  'WHEAT',              'Futuros', 'futures', 53),
  ('CORN',   'CORN',               'Futuros', 'futures', 54),
  ('COPPER', 'COPPER',             'Futuros', 'futures', 55),

  ('BTCUSD', 'BTCUSD (Bitcoin)',   'Crypto', 'crypto', 60),
  ('ETHUSD', 'ETHUSD (Ethereum)',  'Crypto', 'crypto', 61),
  ('SOLUSD', 'SOLUSD (Solana)',    'Crypto', 'crypto', 62),
  ('BNBUSD', 'BNBUSD (BNB)',       'Crypto', 'crypto', 63)
ON CONFLICT (symbol) DO NOTHING;

-- 1d. Convert algorithms.instrument from text to text[]
DO $$
DECLARE
  current_type text;
BEGIN
  SELECT data_type INTO current_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'algorithms'
    AND column_name = 'instrument';

  IF current_type = 'text' THEN
    EXECUTE 'ALTER TABLE public.algorithms ALTER COLUMN instrument DROP DEFAULT';
    EXECUTE 'ALTER TABLE public.algorithms ALTER COLUMN instrument TYPE text[] USING ARRAY[instrument]';
    EXECUTE 'ALTER TABLE public.algorithms ALTER COLUMN instrument SET DEFAULT ARRAY[''XAUUSD'']::text[]';
  END IF;
END $$;
