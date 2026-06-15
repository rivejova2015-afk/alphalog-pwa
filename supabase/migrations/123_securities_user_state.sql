-- Per-user gamification / UX state for CyberSec Academy.
--
-- XP, level, mastery, streak and achievements remain DERIVED from the result
-- tables (quiz_results / exam_results / homework_submissions / securities_progress).
-- This table persists the mutable bits that previously lived in localStorage, so
-- they sync across devices and survive a browser wipe:
--   * daily_goal          — the learner's daily XP goal
--   * milestone_snapshot  — last-seen {level, crowns, earned, examPassed} for the
--                           "celebrate once" milestone detection
--   * srs                 — spaced-repetition state (flashcards / failed questions)

create table if not exists public.securities_user_state (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  daily_goal         integer not null default 50,
  milestone_snapshot jsonb,
  srs                jsonb not null default '{}'::jsonb,
  updated_at         timestamptz not null default now()
);

alter table public.securities_user_state enable row level security;

create policy "securities_user_state_select_own" on public.securities_user_state
  for select using (auth.uid() = user_id);

create policy "securities_user_state_insert_own" on public.securities_user_state
  for insert with check (auth.uid() = user_id);

create policy "securities_user_state_update_own" on public.securities_user_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
