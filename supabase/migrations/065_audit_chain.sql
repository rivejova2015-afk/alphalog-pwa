-- Migration 065: Add HMAC chain to audit_logs for tamper-evident trail
-- Each log stores prev_hash (pointer to previous entry) and chain_hash (HMAC of this entry).
-- If any log is modified, the chain breaks — detectable via verify-audit-chain script.

BEGIN;

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS prev_hash TEXT,
  ADD COLUMN IF NOT EXISTS chain_hash TEXT;

-- Existing rows get GENESIS marker (no previous entry)
UPDATE public.audit_logs
  SET prev_hash = 'GENESIS',
      chain_hash = 'LEGACY'
  WHERE prev_hash IS NULL;

COMMIT;
