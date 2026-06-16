-- Rama/especialización de carrera elegida por el usuario en CyberSec Academy.
-- Alimenta el recomendador de certificaciones (escalera nivel 1→5 por track) y
-- se recuerda entre sesiones. Uno de los 8 tracks de carrera. Aditiva e idempotente
-- (espeja 127_securities_gating.sql).

alter table public.securities_user_state
  add column if not exists specialization text;

-- CHECK por separado e idempotente.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'securities_user_state_specialization_chk'
  ) then
    alter table public.securities_user_state
      add constraint securities_user_state_specialization_chk
      check (specialization is null or specialization in
        ('foundations','offensive','defensive','dfir','appsec','cloud','grc','infra'));
  end if;
end $$;
