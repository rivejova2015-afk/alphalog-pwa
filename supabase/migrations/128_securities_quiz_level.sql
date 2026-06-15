-- Quizzes por nivel (Fase A): nivel del intento de quiz en CyberSec Academy.
-- 'b' (básico, default para histórico) | 'i' (intermedio) | 'a' (avanzado).
-- La maestría deriva del mejor intento por (lección, nivel). Aditiva e idempotente.

alter table public.securities_quiz_results
  add column if not exists level text not null default 'b';

-- CHECK por separado e idempotente.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'securities_quiz_results_level_chk'
  ) then
    alter table public.securities_quiz_results
      add constraint securities_quiz_results_level_chk
      check (level in ('b','i','a'));
  end if;
end $$;

-- Índice para el lookup "mejor por (usuario, lección, nivel)" del summary.
create index if not exists idx_securities_quiz_results_user_lesson_level
  on public.securities_quiz_results (user_id, lesson_id, level, taken_at desc);
