-- Opt-in de notificaciones de hábito para CyberSec Academy.
--   * notify_streak     — el usuario activó los recordatorios de racha/meta
--   * last_notified_on  — última fecha (UTC) en que se le envió, para dedup diario
-- Aditiva e idempotente.

alter table public.securities_user_state
  add column if not exists notify_streak boolean not null default false;

alter table public.securities_user_state
  add column if not exists last_notified_on date;
