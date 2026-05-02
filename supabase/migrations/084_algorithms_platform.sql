-- Migration 080: Add platform column to algorithms table
-- Persists the user's MT4/MT5 choice from the NewStrategyWizard so that
-- pairing-token generation uses the correct platform.

ALTER TABLE public.algorithms
  ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'MT5'
    CHECK (platform IN ('MT4', 'MT5'));
