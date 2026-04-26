-- Migration 068: Shadow ciphertext columns for financial fields
-- Numeric columns remain for DB-level calculations (dashboard metrics, payout math).
-- New _enc TEXT columns store AES-256-GCM encrypted values for client-facing API responses.
-- Phase B (separate migration): backfill all rows + null out numeric columns.

BEGIN;

-- Trades: encrypt P&L and price fields
ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS pnl_enc         TEXT,
  ADD COLUMN IF NOT EXISTS entry_price_enc TEXT,
  ADD COLUMN IF NOT EXISTS exit_price_enc  TEXT,
  ADD COLUMN IF NOT EXISTS pnl_percent_enc TEXT;

-- Treasury payouts: encrypt payout amount
ALTER TABLE public.treasury_payouts
  ADD COLUMN IF NOT EXISTS amount_enc TEXT;

COMMIT;
