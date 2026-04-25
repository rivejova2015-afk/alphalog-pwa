ALTER TABLE public.algorithms
  ADD COLUMN IF NOT EXISTS market_type TEXT NOT NULL DEFAULT 'forex'
    CHECK (market_type IN ('forex','futures','options')),
  ADD COLUMN IF NOT EXISTS direction TEXT NOT NULL DEFAULT 'both'
    CHECK (direction IN ('long','short','both'));
