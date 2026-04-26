-- Migration 064: Replace plaintext webhook_secret with SHA-256 hash
-- Prevents credential exposure if DB is compromised.
-- The EA sends the raw secret; server hashes it before comparison.

BEGIN;

ALTER TABLE public.bot_instances
  ADD COLUMN IF NOT EXISTS webhook_secret_hash TEXT;

-- Populate hashes for existing rows that have a plaintext secret
UPDATE public.bot_instances
  SET webhook_secret_hash = encode(digest(webhook_secret, 'sha256'), 'hex')
  WHERE webhook_secret IS NOT NULL AND webhook_secret_hash IS NULL;

-- Remove the plaintext column after backfill
ALTER TABLE public.bot_instances
  DROP COLUMN IF EXISTS webhook_secret;

COMMIT;
