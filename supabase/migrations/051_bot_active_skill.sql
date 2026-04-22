-- Migration 051: Active skill per instrument — connects approved skill to signal engine

CREATE TABLE IF NOT EXISTS public.bot_active_skill (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL DEFAULT '381e268e-a042-4612-8b39-7a120ace17d6',
  instrument    TEXT NOT NULL DEFAULT 'XAUUSD',
  skill_id      UUID NULL REFERENCES public.bot_skills(id) ON DELETE SET NULL,
  q_table_path  TEXT NULL,
  llm_rules     JSONB NULL DEFAULT '[]',
  activated_at  TIMESTAMPTZ NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT bot_active_skill_instrument_unique UNIQUE (instrument)
);

ALTER TABLE public.bot_active_skill ENABLE ROW LEVEL SECURITY;

CREATE POLICY bot_active_skill_select_own ON public.bot_active_skill
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY bot_active_skill_insert_own ON public.bot_active_skill
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY bot_active_skill_update_own ON public.bot_active_skill
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY bot_active_skill_delete_own ON public.bot_active_skill
  FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS bot_active_skill_updated_at ON public.bot_active_skill;
CREATE TRIGGER bot_active_skill_updated_at
  BEFORE UPDATE ON public.bot_active_skill
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
