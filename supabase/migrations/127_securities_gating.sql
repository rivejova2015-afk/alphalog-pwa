-- Modo de desbloqueo (gating) del camino de CyberSec Academy, por usuario.
-- 'soft' (default) = todo accesible; 'strict' = lineal; 'block' = por sección.
-- Aditiva e idempotente.

alter table public.securities_user_state
  add column if not exists gating text not null default 'soft';

-- CHECK por separado e idempotente (no soportado IF NOT EXISTS en constraints viejos).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'securities_user_state_gating_chk'
  ) then
    alter table public.securities_user_state
      add constraint securities_user_state_gating_chk
      check (gating in ('soft','strict','block'));
  end if;
end $$;
