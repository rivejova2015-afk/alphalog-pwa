-- Migration 042: Terminal Chat (AI Financial Assistant)
-- Tables: terminal_chat_sessions, terminal_chat_messages,
--         terminal_assistant_memory, terminal_assistant_settings

-- ============================================================
-- terminal_chat_sessions
-- ============================================================
CREATE TABLE public.terminal_chat_sessions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text        NOT NULL DEFAULT 'Nueva sesión',
  asset       text        NOT NULL DEFAULT 'XAUUSD'
              CHECK (asset IN ('XAUUSD', 'US500')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

CREATE INDEX idx_chat_sessions_user
  ON public.terminal_chat_sessions (user_id, created_at DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE public.terminal_chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_sessions_owner" ON public.terminal_chat_sessions
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- terminal_chat_messages
-- ============================================================
CREATE TABLE public.terminal_chat_messages (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       uuid        NOT NULL
                   REFERENCES public.terminal_chat_sessions(id) ON DELETE CASCADE,
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role             text        NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content          text        NOT NULL,  -- AES-256-GCM encrypted (enc:v1:...)
  image_path       text,                  -- V2: chart image attachment (NULL in V1)
  rating           integer     CHECK (rating IN (-1, 1)),  -- 👍=1  👎=-1
  context_snapshot jsonb,                 -- { price, news_count, events_count }
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_messages_session
  ON public.terminal_chat_messages (session_id, created_at ASC);

CREATE INDEX idx_chat_messages_user
  ON public.terminal_chat_messages (user_id, created_at DESC);

ALTER TABLE public.terminal_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_messages_owner" ON public.terminal_chat_messages
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- terminal_assistant_memory
-- ============================================================
CREATE TABLE public.terminal_assistant_memory (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  memory_type       text        NOT NULL
                    CHECK (memory_type IN ('pattern', 'preference', 'error', 'insight', 'style')),
  content           text        NOT NULL,  -- plain text, no PII
  importance_score  integer     NOT NULL DEFAULT 50
                    CHECK (importance_score BETWEEN 1 AND 100),
  asset             text        CHECK (asset IN ('XAUUSD', 'US500')),  -- NULL = both
  source_session_id uuid
                    REFERENCES public.terminal_chat_sessions(id) ON DELETE SET NULL,
  last_accessed_at  timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_assistant_memory_user
  ON public.terminal_assistant_memory (user_id, importance_score DESC);

ALTER TABLE public.terminal_assistant_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assistant_memory_owner" ON public.terminal_assistant_memory
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- terminal_assistant_settings
-- ============================================================
CREATE TABLE public.terminal_assistant_settings (
  user_id        uuid  PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  assistant_name text  NOT NULL DEFAULT 'AlphaAnalyst',
  default_asset  text  NOT NULL DEFAULT 'XAUUSD'
                 CHECK (default_asset IN ('XAUUSD', 'US500')),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.terminal_assistant_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assistant_settings_owner" ON public.terminal_assistant_settings
  FOR ALL USING (auth.uid() = user_id);
