-- Migration 046: Add platform and paper mode support to bot_instances
-- is_paper_mode is determined server-side ONLY, never from the EA payload

ALTER TABLE public.bot_instances
  ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'MT5'
    CHECK (platform IN ('MT4', 'MT5')),
  ADD COLUMN IF NOT EXISTS is_paper_mode BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_bot_instances_platform
  ON public.bot_instances(platform);
