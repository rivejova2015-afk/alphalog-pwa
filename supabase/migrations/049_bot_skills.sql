-- Migration 049: RL/LLM skills with approval gate before live activation

CREATE TABLE IF NOT EXISTS public.bot_skills (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL DEFAULT '381e268e-a042-4612-8b39-7a120ace17d6',
  instrument              TEXT NOT NULL DEFAULT 'XAUUSD',
  skill_type              TEXT NOT NULL DEFAULT 'HYBRID'
                            CHECK (skill_type IN ('RL_POLICY', 'LLM_RULES', 'HYBRID')),
  environment             TEXT NOT NULL DEFAULT 'paper'
                            CHECK (environment IN ('paper', 'live')),
  status                  TEXT NOT NULL DEFAULT 'learning'
                            CHECK (status IN ('learning', 'pending_approval', 'approved', 'rejected', 'frozen')),
  model_blob_path         TEXT NULL,
  model_version           INTEGER NOT NULL DEFAULT 1,
  epsilon_current         DECIMAL(5,4) NOT NULL DEFAULT 0.3,
  performance_before      JSONB NULL,
  performance_after       JSONB NULL,
  approval_requested_at   TIMESTAMPTZ NULL,
  approved_at             TIMESTAMPTZ NULL,
  notes                   TEXT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at              TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_bot_skills_instrument_env_status
  ON public.bot_skills(instrument, environment, status)
  WHERE deleted_at IS NULL;

ALTER TABLE public.bot_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY bot_skills_select_own ON public.bot_skills
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY bot_skills_insert_own ON public.bot_skills
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY bot_skills_update_own ON public.bot_skills
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY bot_skills_delete_own ON public.bot_skills
  FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS bot_skills_updated_at ON public.bot_skills;
CREATE TRIGGER bot_skills_updated_at
  BEFORE UPDATE ON public.bot_skills
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
