CREATE TABLE public.bot_monitor_state (
  bot_instance_id  uuid PRIMARY KEY REFERENCES public.bot_instances ON DELETE CASCADE,
  is_down          boolean NOT NULL DEFAULT false,
  down_since       timestamptz,
  last_alerted_at  timestamptz,
  recovery_cmd_id  uuid,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bot_monitor_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only"
  ON public.bot_monitor_state FOR ALL
  USING (true) WITH CHECK (true);
