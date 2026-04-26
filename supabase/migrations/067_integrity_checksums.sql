-- Migration 067: HMAC-SHA256 integrity checksums for critical financial records
-- On write: app computes hash of critical fields and stores it.
-- On read: app recomputes and compares — mismatch = tampering detected.

BEGIN;

ALTER TABLE public.treasury_payouts
  ADD COLUMN IF NOT EXISTS _integrity_hash TEXT;

ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS _integrity_hash TEXT;

COMMIT;
