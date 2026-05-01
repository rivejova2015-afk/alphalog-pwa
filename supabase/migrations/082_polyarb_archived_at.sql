-- Migration 078: Soft-archive support for PolyArb operational tables.
--
-- polyarb_trades and polyarb_equity_snapshots are append-only by design (no
-- deleted_at + INSERT-only RLS). To support a clean "start fresh" without
-- losing the audit trail, we add archived_at + UPDATE RLS so the owner can
-- mark their own rows archived in place. polyarb_positions already has
-- deleted_at + UPDATE policy from migration 043 -- untouched here.
--
-- The archive flow itself lives in /api/polyarb/archive-history. It uploads
-- a PDF + CSV snapshot to the EvidenceVault before flipping these flags so
-- the data remains queryable as an immutable artefact even after the
-- dashboard resets to zero.

ALTER TABLE polyarb_trades
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE polyarb_equity_snapshots
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS polyarb_trades_archived_idx
  ON polyarb_trades(agent_id, archived_at);

CREATE INDEX IF NOT EXISTS polyarb_equity_snapshots_archived_idx
  ON polyarb_equity_snapshots(agent_id, archived_at);

CREATE POLICY "owner_update_archived"
  ON polyarb_trades FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "owner_update_archived"
  ON polyarb_equity_snapshots FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
