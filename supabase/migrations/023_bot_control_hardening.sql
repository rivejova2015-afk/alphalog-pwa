-- 023_bot_control_hardening.sql
-- Hardening: indexes + maintenance helpers

-- Indexes for command lookups
create index if not exists bot_command_status_command_idx
on public.bot_command_status (command_id);

create index if not exists bot_command_status_account_status_idx
on public.bot_command_status (bot_account_id, status);

create index if not exists bot_commands_bot_status_idx
on public.bot_commands (bot_id, status);

create index if not exists bot_events_bot_created_idx
on public.bot_events (bot_id, created_at desc);

create index if not exists bot_instances_last_heartbeat_idx
on public.bot_instances (last_heartbeat_at);

create index if not exists bot_instances_account_idx
on public.bot_instances (bot_account_id);
