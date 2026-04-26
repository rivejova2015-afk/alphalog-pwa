CREATE TABLE public.bot_open_positions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  bot_account_id   uuid NOT NULL REFERENCES public.bot_accounts ON DELETE CASCADE,
  algorithm_id     uuid REFERENCES public.trading_algorithms ON DELETE SET NULL,
  ticket           bigint NOT NULL,
  symbol           text NOT NULL,
  direction        text NOT NULL CHECK (direction IN ('BUY','SELL')),
  lots             numeric(10,4) NOT NULL,
  open_price       numeric(12,5) NOT NULL,
  current_price    numeric(12,5),
  profit           numeric(12,2) NOT NULL DEFAULT 0,
  sl               numeric(12,5),
  tp               numeric(12,5),
  open_time        timestamptz,
  status           text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  close_price      numeric(12,5),
  closed_at        timestamptz,
  last_updated_at  timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bot_account_id, ticket)
);

ALTER TABLE public.bot_open_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own open positions"
  ON public.bot_open_positions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_bop_algo    ON public.bot_open_positions (algorithm_id, status);
CREATE INDEX idx_bop_account ON public.bot_open_positions (bot_account_id, status);
