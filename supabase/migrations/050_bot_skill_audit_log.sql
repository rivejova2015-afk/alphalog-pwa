-- Migration 050: Immutable audit log of every skill learning cycle and state transition

CREATE TABLE IF NOT EXISTS public.bot_skill_audit_log (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL DEFAULT '381e268e-a042-4612-8b39-7a120ace17d6',
  skill_id              UUID NOT NULL REFERENCES public.bot_skills(id) ON DELETE CASCADE,
  event_type            TEXT NOT NULL CHECK (event_type IN (
                          'LEARNING_CYCLE',
                          'PARAM_UPDATED',
                          'APPROVAL_REQUESTED',
                          'APPROVED',
                          'REJECTED',
                          'APPLIED_TO_PAPER',
                          'FROZEN'
                        )),
  params_before         JSONB NULL,
  params_after          JSONB NULL,
  performance_delta     JSONB NULL,
  rl_episode_count      INTEGER NULL,
  epsilon_before        DECIMAL(5,4) NULL,
  epsilon_after         DECIMAL(5,4) NULL,
  llm_rules_generated   INTEGER NULL,
  reward_avg            DECIMAL(10,6) NULL,
  notes                 TEXT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_skill_audit_log_skill_created
  ON public.bot_skill_audit_log(skill_id, created_at DESC);

ALTER TABLE public.bot_skill_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY bot_skill_audit_log_select_own ON public.bot_skill_audit_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY bot_skill_audit_log_insert_own ON public.bot_skill_audit_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY bot_skill_audit_log_delete_own ON public.bot_skill_audit_log
  FOR DELETE USING (auth.uid() = user_id);
