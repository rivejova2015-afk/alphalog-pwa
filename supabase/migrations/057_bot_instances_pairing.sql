-- Migration 057: Add pairing token + session secrets to bot_instances
-- Enables the 1-token pairing flow: EA sends GOLD-XXXX-XXXX → receives all credentials

ALTER TABLE public.bot_instances
  ADD COLUMN IF NOT EXISTS pairing_token_hash  TEXT NULL,
  ADD COLUMN IF NOT EXISTS pairing_token_used_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS signal_secret_hash  TEXT NULL,
  ADD COLUMN IF NOT EXISTS webhook_secret      TEXT NULL;

-- Fast lookup by pairing token hash (SHA-256 hex)
CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_instances_pairing_token_hash
  ON public.bot_instances(pairing_token_hash)
  WHERE pairing_token_hash IS NOT NULL;
