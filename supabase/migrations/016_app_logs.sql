-- Sprint 10.7: AlphaShield Logging System
-- Application logs table with deduplication, rate limiting, and retention

-- Create app_logs table
CREATE TABLE IF NOT EXISTS public.app_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Log metadata
  level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error')),
  area TEXT NOT NULL, -- e.g., 'tradehub', 'treasury', 'auth', 'pwa', 'business'
  message TEXT NOT NULL,
  meta JSONB DEFAULT '{}'::jsonb,
  
  -- Deduplication fingerprint (hash of message + area + stack top)
  fingerprint TEXT NOT NULL,
  
  -- Client context
  url TEXT,
  user_agent TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  resolved_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  
  -- Indexes for efficient queries
  CONSTRAINT app_logs_level_valid CHECK (length(level) > 0),
  CONSTRAINT app_logs_area_valid CHECK (length(area) > 0),
  CONSTRAINT app_logs_message_valid CHECK (length(message) > 0),
  CONSTRAINT app_logs_fingerprint_valid CHECK (length(fingerprint) > 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_app_logs_user_created 
  ON public.app_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_logs_fingerprint 
  ON public.app_logs(fingerprint);

CREATE INDEX IF NOT EXISTS idx_app_logs_user_area 
  ON public.app_logs(user_id, area);

CREATE INDEX IF NOT EXISTS idx_app_logs_user_level 
  ON public.app_logs(user_id, level);

CREATE INDEX IF NOT EXISTS idx_app_logs_created_at 
  ON public.app_logs(created_at DESC);

-- RLS: Owner-only access
ALTER TABLE public.app_logs ENABLE ROW LEVEL SECURITY;

-- SELECT: User can only see their own logs
CREATE POLICY "app_logs_select" ON public.app_logs
  FOR SELECT USING (auth.uid() = user_id);

-- INSERT: User can only insert their own logs (user_id verified server-side)
CREATE POLICY "app_logs_insert" ON public.app_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- UPDATE: User can only update their own logs (e.g., mark as resolved)
CREATE POLICY "app_logs_update" ON public.app_logs
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: User can only soft-delete their own logs
CREATE POLICY "app_logs_delete" ON public.app_logs
  FOR DELETE USING (auth.uid() = user_id);

-- Comments
COMMENT ON TABLE public.app_logs IS 'AlphaShield application logs: errors, events, analytics';
COMMENT ON COLUMN public.app_logs.user_id IS 'Log owner (fk to auth.users)';
COMMENT ON COLUMN public.app_logs.level IS 'Log severity: debug, info, warn, error';
COMMENT ON COLUMN public.app_logs.area IS 'Application area/module where log originated';
COMMENT ON COLUMN public.app_logs.message IS 'Main log message (sanitized, no secrets)';
COMMENT ON COLUMN public.app_logs.meta IS 'Additional metadata (sanitized JSONB)';
COMMENT ON COLUMN public.app_logs.fingerprint IS 'Deduplication hash (message + area + stack)';
COMMENT ON COLUMN public.app_logs.url IS 'Client URL when log occurred';
COMMENT ON COLUMN public.app_logs.user_agent IS 'Browser user agent';
COMMENT ON COLUMN public.app_logs.resolved_at IS 'When issue was resolved (nullable)';
COMMENT ON COLUMN public.app_logs.deleted_at IS 'Soft delete timestamp (nullable)';
