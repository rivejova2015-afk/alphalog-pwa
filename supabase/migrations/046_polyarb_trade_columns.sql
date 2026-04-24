-- Migration 046: Add missing columns to polyarb_trades + enable Realtime
--
-- Root cause: order-manager inserts market_slug, condition_id, outcome, size_usd
-- into polyarb_trades, but those columns didn't exist → inserts silently failed
-- → zero trade records were being created in the dashboard.
--
-- Also adds pnl_usd (EXIT trades) and trade_type (ENTRY/EXIT/SIMULATED) for
-- complete audit trail without requiring JOIN to polyarb_positions.

ALTER TABLE polyarb_trades ADD COLUMN IF NOT EXISTS market_slug      text;
ALTER TABLE polyarb_trades ADD COLUMN IF NOT EXISTS condition_id     text;
ALTER TABLE polyarb_trades ADD COLUMN IF NOT EXISTS outcome          text;
ALTER TABLE polyarb_trades ADD COLUMN IF NOT EXISTS size_usd         numeric(18,6);
ALTER TABLE polyarb_trades ADD COLUMN IF NOT EXISTS pnl_usd          numeric(18,6);
ALTER TABLE polyarb_trades ADD COLUMN IF NOT EXISTS trade_type       text NOT NULL DEFAULT 'ENTRY'
  CHECK (trade_type IN ('ENTRY','EXIT','SIMULATED'));

-- Back-fill trade_type for existing simulated rows (status='SIMULATED')
UPDATE polyarb_trades SET trade_type = 'SIMULATED' WHERE status = 'SIMULATED';

-- Indexes for dashboard queries
CREATE INDEX IF NOT EXISTS polyarb_trades_agent_type_idx
  ON polyarb_trades(agent_id, trade_type, executed_at DESC);

CREATE INDEX IF NOT EXISTS polyarb_trades_market_idx
  ON polyarb_trades(agent_id, market_slug, executed_at DESC);

-- Enable Supabase Realtime so the dashboard can subscribe to live updates
ALTER PUBLICATION supabase_realtime ADD TABLE polyarb_positions;
ALTER PUBLICATION supabase_realtime ADD TABLE polyarb_trades;
