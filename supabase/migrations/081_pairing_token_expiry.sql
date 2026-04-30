-- Migration 081: Add pairing token expiry to bot_instances
-- Tokens expire 10 minutes after generation if not paired by the EA.
-- Prevents stale tokens from being used after the user's session ends.

ALTER TABLE public.bot_instances
  ADD COLUMN IF NOT EXISTS pairing_token_expires_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_bot_instances_pairing_expires
  ON public.bot_instances(pairing_token_expires_at)
  WHERE pairing_token_used_at IS NULL;
