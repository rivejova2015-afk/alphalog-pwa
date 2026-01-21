-- 013: Treasury Calendar Events + Withdrawal Reminders
-- Creates treasury_calendar_events table for custom events and withdrawal day tracking
-- Alters treasury_configs to support withdrawal day push notifications with cooldown

-- ============================================================================
-- A) CREATE TABLE treasury_calendar_events
-- ============================================================================

CREATE TABLE IF NOT EXISTS treasury_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  event_date DATE NOT NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'payout_day', -- payout_cycle | payout_day | note
  push_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE NULL,
  
  -- Constraints
  CONSTRAINT treasury_calendar_events_user_account_fk FOREIGN KEY (user_id, account_id) 
    REFERENCES accounts(user_id, id) ON DELETE CASCADE
);

-- Unique constraint: one event per user+account+date+kind (active only)
CREATE UNIQUE INDEX idx_treasury_calendar_events_unique 
  ON treasury_calendar_events(user_id, account_id, event_date, kind) 
  WHERE deleted_at IS NULL;

-- Indexes for queries
CREATE INDEX idx_treasury_calendar_events_user ON treasury_calendar_events(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_treasury_calendar_events_account ON treasury_calendar_events(user_id, account_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_treasury_calendar_events_date ON treasury_calendar_events(event_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_treasury_calendar_events_kind ON treasury_calendar_events(kind) WHERE deleted_at IS NULL;

-- Trigger: update updated_at on INSERT/UPDATE
CREATE OR REPLACE TRIGGER treasury_calendar_events_updated_at_trigger
BEFORE UPDATE ON treasury_calendar_events
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Comments
COMMENT ON TABLE treasury_calendar_events IS 'Custom calendar events per account (withdrawal days, notes, etc.) for push notifications';
COMMENT ON COLUMN treasury_calendar_events.kind IS 'Event type: payout_cycle (monthly reminder), payout_day (withdrawal day), note (custom)';
COMMENT ON COLUMN treasury_calendar_events.push_enabled IS 'Enable push notification for this event';

-- ============================================================================
-- B) ALTER treasury_configs - Add withdrawal day push settings
-- ============================================================================

ALTER TABLE treasury_configs
ADD COLUMN IF NOT EXISTS push_withdrawal_day_enabled BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS last_withdrawal_push_cycle_start DATE NULL;

-- Index for push notification queries
CREATE INDEX IF NOT EXISTS idx_treasury_configs_push_enabled 
  ON treasury_configs(push_withdrawal_day_enabled) 
  WHERE deleted_at IS NULL AND push_withdrawal_day_enabled = true;

-- Comments
COMMENT ON COLUMN treasury_configs.push_withdrawal_day_enabled IS 'Enable push notifications for withdrawal day reminders';
COMMENT ON COLUMN treasury_configs.last_withdrawal_push_cycle_start IS 'Date of last withdrawal push for this cycle (prevents duplicate notifications)';

-- ============================================================================
-- C) RLS POLICIES - treasury_calendar_events
-- ============================================================================

ALTER TABLE treasury_calendar_events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see/modify their own events
CREATE POLICY "Users can manage own calendar events" ON treasury_calendar_events
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- D) SEED DATA - Example withdrawal day events (optional, commented out)
-- ============================================================================

-- For demonstration: create payout_day events for known withdrawal dates
-- NOTE: This will be created dynamically by API, not via seed

-- ============================================================================
-- Migration completed successfully
-- ============================================================================
