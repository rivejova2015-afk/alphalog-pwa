-- Migration 066: Canary (honeypot) fields in sensitive tables
-- These fields contain known values. If they change, it signals DB tampering.
-- The app checks canary values on read and triggers an alert if they differ.

BEGIN;

ALTER TABLE public.treasury_payouts
  ADD COLUMN IF NOT EXISTS _canary TEXT DEFAULT 'CANARY_TREASURY_2026';

ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS _canary TEXT DEFAULT 'CANARY_TRADES_2026';

ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS _canary TEXT DEFAULT 'CANARY_JOURNAL_2026';

COMMIT;
