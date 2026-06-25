-- Coinarb Strategy DD (Daily Direction Scalper) — Phase Owner-Spec
--
-- La columna `coinarb_positions.strategy_id` (migration 131) es `text not null
-- default 'A'` sin CHECK constraint, así que cualquier valor de StrategyId
-- — incluyendo 'DD' — se acepta sin migración adicional. Esta migración
-- existe solo para extender la CHECK constraint en `bot_commands.target_strategy`
-- que migration 131 limitaba a ('all', 'A', 'B'). Con la integración de M, P
-- y DD necesitamos permitir esos valores también.
--
-- Idempotente: drop + recreate del check si existe.

do $$
begin
  if exists (
    select 1 from information_schema.constraint_column_usage
    where table_name = 'bot_commands' and constraint_name = 'bot_commands_target_strategy_check'
  ) then
    alter table bot_commands
      drop constraint bot_commands_target_strategy_check;
  end if;

  alter table bot_commands
    add constraint bot_commands_target_strategy_check
    check (target_strategy in ('all', 'A', 'B', 'M', 'P', 'DD'));
end $$;
