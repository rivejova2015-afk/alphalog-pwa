-- Sprint 7: Advanced Lab Environments Schema
-- Supports Docker provisioning, snapshots, and multi-user collaboration

-- Lab Environments Table
CREATE TABLE securities_lab_environments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lab_id UUID NOT NULL,
  container_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'provisioning'
    CHECK (status IN ('provisioning', 'running', 'paused', 'terminated')),
  docker_image TEXT NOT NULL,
  exposed_ports JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_activity_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT valid_lab_id CHECK (lab_id IS NOT NULL)
);

-- Lab Snapshots Table
CREATE TABLE securities_lab_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id UUID NOT NULL REFERENCES securities_lab_environments(id) ON DELETE CASCADE,
  snapshot_name TEXT NOT NULL,
  description TEXT,
  disk_size_mb BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  restored_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  UNIQUE (environment_id, snapshot_name),
  CONSTRAINT valid_disk_size CHECK (disk_size_mb >= 0)
);

-- Lab Collaboration Sessions Table
CREATE TABLE securities_lab_collaboration_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id UUID NOT NULL REFERENCES securities_lab_environments(id) ON DELETE CASCADE,
  session_key TEXT NOT NULL UNIQUE,
  participants UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  max_participants INT NOT NULL DEFAULT 4,
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT valid_max_participants CHECK (max_participants BETWEEN 1 AND 10),
  CONSTRAINT valid_participant_count CHECK (ARRAY_LENGTH(participants, 1) <= max_participants)
);

-- Lab Activity Log Table
CREATE TABLE securities_lab_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id UUID NOT NULL REFERENCES securities_lab_environments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  activity_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),

  INDEX idx_environment_activity ON securities_lab_activity_logs(environment_id, created_at DESC),
  INDEX idx_user_activity ON securities_lab_activity_logs(user_id, created_at DESC)
);

-- RLS Policies
ALTER TABLE securities_lab_environments ENABLE ROW LEVEL SECURITY;
ALTER TABLE securities_lab_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE securities_lab_collaboration_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE securities_lab_activity_logs ENABLE ROW LEVEL SECURITY;

-- Lab Environments RLS
CREATE POLICY lab_env_user_access ON securities_lab_environments
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY lab_env_collab_access ON securities_lab_environments
  FOR SELECT USING (
    auth.uid() = user_id OR
    id IN (
      SELECT environment_id FROM securities_lab_collaboration_sessions
      WHERE auth.uid() = ANY(participants)
    )
  );

-- Lab Snapshots RLS
CREATE POLICY lab_snap_user_access ON securities_lab_snapshots
  FOR ALL USING (
    environment_id IN (
      SELECT id FROM securities_lab_environments WHERE user_id = auth.uid()
    )
  );

-- Lab Collaboration RLS
CREATE POLICY lab_collab_participant_access ON securities_lab_collaboration_sessions
  FOR ALL USING (auth.uid() = ANY(participants));

-- Activity Logs RLS
CREATE POLICY lab_activity_user_access ON securities_lab_activity_logs
  FOR ALL USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_lab_env_user ON securities_lab_environments(user_id, status);
CREATE INDEX idx_lab_env_status ON securities_lab_environments(status, last_activity_at DESC);
CREATE INDEX idx_lab_snapshots_env ON securities_lab_snapshots(environment_id, created_at DESC);
CREATE INDEX idx_collab_session_key ON securities_lab_collaboration_sessions(session_key);
CREATE INDEX idx_collab_participants ON securities_lab_collaboration_sessions USING GIN(participants);

-- Cache table for snapshot counts
CREATE MATERIALIZED VIEW lab_environment_stats AS
SELECT
  le.id as environment_id,
  le.user_id,
  le.status,
  COUNT(DISTINCT ls.id) as snapshot_count,
  MAX(ls.created_at) as latest_snapshot_at,
  COALESCE(SUM(ls.disk_size_mb), 0) as total_snapshot_size_mb
FROM securities_lab_environments le
LEFT JOIN securities_lab_snapshots ls ON le.id = ls.environment_id AND ls.deleted_at IS NULL
WHERE le.deleted_at IS NULL
GROUP BY le.id, le.user_id, le.status;

CREATE INDEX idx_lab_stats_user ON lab_environment_stats(user_id);
