-- 024_copy_groups_capital_algorithm.sql
-- Sprint UPDATE_09: Capital Algorithm (CopyGroups + Árbol + Journal Mirroring + Versionado/Timeline)
-- Decisiones:
-- - CopyGroups por usuario (owner_id)
-- - 1 master activo por CopyGroup
-- - Links SOLID con anti-loop y 1 parent SOLID por child
-- - Versionado + snapshots por CopyGroup
-- - Timeline de eventos
-- - Replicación idempotente (master_trade_id + slave_account_id)
-- - Experimental flags (scaffolding)

create extension if not exists pgcrypto;

-- ============================================================================
-- TABLA: copy_groups
-- ============================================================================
create table if not exists public.copy_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  active_version int not null default 1,
  sync_mode text not null default 'hard',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint copy_groups_name_not_empty check (length(trim(name)) > 0),
  constraint copy_groups_sync_mode_valid check (sync_mode in ('hard', 'soft'))
);

comment on table public.copy_groups is 'CopyGroups de capital (1 master activo por grupo)';
comment on column public.copy_groups.active_version is 'Version activa de configuración';
comment on column public.copy_groups.sync_mode is 'Modo sync de mirrors: hard|soft';

create index if not exists copy_groups_owner_id_idx
  on public.copy_groups(owner_id);

drop trigger if exists copy_groups_updated_at on public.copy_groups;
create trigger copy_groups_updated_at
  before update on public.copy_groups
  for each row
  execute function public.set_updated_at();

alter table public.copy_groups enable row level security;

drop policy if exists copy_groups_owner_select on public.copy_groups;
create policy copy_groups_owner_select
  on public.copy_groups for select
  using (auth.uid() = owner_id);

drop policy if exists copy_groups_owner_insert on public.copy_groups;
create policy copy_groups_owner_insert
  on public.copy_groups for insert
  with check (auth.uid() = owner_id);

drop policy if exists copy_groups_owner_update on public.copy_groups;
create policy copy_groups_owner_update
  on public.copy_groups for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists copy_groups_owner_delete on public.copy_groups;
create policy copy_groups_owner_delete
  on public.copy_groups for delete
  using (auth.uid() = owner_id);

-- ============================================================================
-- TABLA: copy_group_nodes
-- ============================================================================
create table if not exists public.copy_group_nodes (
  id uuid primary key default gen_random_uuid(),
  copy_group_id uuid not null references public.copy_groups(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  role text not null check (role in ('master', 'slave')),
  status text not null default 'active' check (status in ('active', 'paused', 'read_only')),
  risk_pct numeric(6,3) not null default 0,
  risk_node jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.copy_group_nodes is 'Nodos de CopyGroup (rol/estado/riesgo)';

create unique index if not exists copy_group_nodes_unique_account
  on public.copy_group_nodes(copy_group_id, account_id);

create unique index if not exists copy_group_nodes_master_active
  on public.copy_group_nodes(copy_group_id)
  where role = 'master' and status = 'active';

create index if not exists copy_group_nodes_group_idx
  on public.copy_group_nodes(copy_group_id);

drop trigger if exists copy_group_nodes_updated_at on public.copy_group_nodes;
create trigger copy_group_nodes_updated_at
  before update on public.copy_group_nodes
  for each row
  execute function public.set_updated_at();

alter table public.copy_group_nodes enable row level security;

drop policy if exists copy_group_nodes_owner_select on public.copy_group_nodes;
create policy copy_group_nodes_owner_select
  on public.copy_group_nodes for select
  using (
    exists (
      select 1 from public.copy_groups cg
      where cg.id = copy_group_id and cg.owner_id = auth.uid()
    )
  );

drop policy if exists copy_group_nodes_owner_insert on public.copy_group_nodes;
create policy copy_group_nodes_owner_insert
  on public.copy_group_nodes for insert
  with check (
    exists (
      select 1 from public.copy_groups cg
      where cg.id = copy_group_id and cg.owner_id = auth.uid()
    )
  );

drop policy if exists copy_group_nodes_owner_update on public.copy_group_nodes;
create policy copy_group_nodes_owner_update
  on public.copy_group_nodes for update
  using (
    exists (
      select 1 from public.copy_groups cg
      where cg.id = copy_group_id and cg.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.copy_groups cg
      where cg.id = copy_group_id and cg.owner_id = auth.uid()
    )
  );

drop policy if exists copy_group_nodes_owner_delete on public.copy_group_nodes;
create policy copy_group_nodes_owner_delete
  on public.copy_group_nodes for delete
  using (
    exists (
      select 1 from public.copy_groups cg
      where cg.id = copy_group_id and cg.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- TABLA: copy_group_links
-- ============================================================================
create table if not exists public.copy_group_links (
  id uuid primary key default gen_random_uuid(),
  copy_group_id uuid not null references public.copy_groups(id) on delete cascade,
  parent_account_id uuid not null references public.accounts(id) on delete cascade,
  child_account_id uuid not null references public.accounts(id) on delete cascade,
  copy_multiplier numeric(10,4) not null default 1,
  link_type text not null default 'solid' check (link_type in ('solid', 'shadow')),
  created_at timestamptz not null default now(),

  constraint copy_group_links_no_self check (parent_account_id <> child_account_id)
);

comment on table public.copy_group_links is 'Links jerárquicos entre cuentas (solid/shadow)';

create index if not exists copy_group_links_group_idx
  on public.copy_group_links(copy_group_id);

create unique index if not exists copy_group_links_solid_parent_unique
  on public.copy_group_links(copy_group_id, child_account_id)
  where link_type = 'solid';

alter table public.copy_group_links enable row level security;

drop policy if exists copy_group_links_owner_select on public.copy_group_links;
create policy copy_group_links_owner_select
  on public.copy_group_links for select
  using (
    exists (
      select 1 from public.copy_groups cg
      where cg.id = copy_group_id and cg.owner_id = auth.uid()
    )
  );

drop policy if exists copy_group_links_owner_insert on public.copy_group_links;
create policy copy_group_links_owner_insert
  on public.copy_group_links for insert
  with check (
    exists (
      select 1 from public.copy_groups cg
      where cg.id = copy_group_id and cg.owner_id = auth.uid()
    )
  );

drop policy if exists copy_group_links_owner_update on public.copy_group_links;
create policy copy_group_links_owner_update
  on public.copy_group_links for update
  using (
    exists (
      select 1 from public.copy_groups cg
      where cg.id = copy_group_id and cg.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.copy_groups cg
      where cg.id = copy_group_id and cg.owner_id = auth.uid()
    )
  );

drop policy if exists copy_group_links_owner_delete on public.copy_group_links;
create policy copy_group_links_owner_delete
  on public.copy_group_links for delete
  using (
    exists (
      select 1 from public.copy_groups cg
      where cg.id = copy_group_id and cg.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- ANTI-LOOP: Functions + Trigger
-- ============================================================================
create or replace function public.copy_group_would_create_cycle(
  p_copy_group_id uuid,
  p_parent_account_id uuid,
  p_child_account_id uuid
) returns boolean
language sql
stable
as $$
  with recursive descendants as (
    select l.child_account_id
    from public.copy_group_links l
    where l.copy_group_id = p_copy_group_id
      and l.parent_account_id = p_child_account_id
      and l.link_type = 'solid'

    union

    select l.child_account_id
    from public.copy_group_links l
    join descendants d on d.child_account_id = l.parent_account_id
    where l.copy_group_id = p_copy_group_id
      and l.link_type = 'solid'
  )
  select exists (
    select 1 from descendants where child_account_id = p_parent_account_id
  );
$$;

create or replace function public.copy_group_links_guard()
returns trigger
language plpgsql
as $$
begin
  if new.link_type = 'solid' then
    if public.copy_group_would_create_cycle(new.copy_group_id, new.parent_account_id, new.child_account_id) then
      raise exception 'Cycle detected in copy_group_links';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists copy_group_links_guard on public.copy_group_links;
create trigger copy_group_links_guard
  before insert or update on public.copy_group_links
  for each row
  execute function public.copy_group_links_guard();

-- ============================================================================
-- DESCENDANTS: RPC helper
-- ============================================================================
create or replace function public.copy_group_get_solid_descendants(
  p_copy_group_id uuid,
  p_root_account_id uuid
)
returns table (
  account_id uuid,
  multiplier_path numeric,
  depth int,
  parent_account_id uuid
)
language sql
stable
as $$
  with recursive tree as (
    select
      l.child_account_id as account_id,
      l.copy_multiplier as multiplier_path,
      1 as depth,
      l.parent_account_id as parent_account_id
    from public.copy_group_links l
    where l.copy_group_id = p_copy_group_id
      and l.parent_account_id = p_root_account_id
      and l.link_type = 'solid'

    union all

    select
      l.child_account_id,
      (t.multiplier_path * l.copy_multiplier) as multiplier_path,
      t.depth + 1,
      l.parent_account_id
    from public.copy_group_links l
    join tree t on t.account_id = l.parent_account_id
    where l.copy_group_id = p_copy_group_id
      and l.link_type = 'solid'
  )
  select * from tree;
$$;

-- ============================================================================
-- TABLA: copy_group_versions
-- ============================================================================
create table if not exists public.copy_group_versions (
  id uuid primary key default gen_random_uuid(),
  copy_group_id uuid not null references public.copy_groups(id) on delete cascade,
  version_int int not null,
  message text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists copy_group_versions_unique
  on public.copy_group_versions(copy_group_id, version_int);

alter table public.copy_group_versions enable row level security;

drop policy if exists copy_group_versions_owner_select on public.copy_group_versions;
create policy copy_group_versions_owner_select
  on public.copy_group_versions for select
  using (
    exists (
      select 1 from public.copy_groups cg
      where cg.id = copy_group_id and cg.owner_id = auth.uid()
    )
  );

drop policy if exists copy_group_versions_owner_insert on public.copy_group_versions;
create policy copy_group_versions_owner_insert
  on public.copy_group_versions for insert
  with check (
    exists (
      select 1 from public.copy_groups cg
      where cg.id = copy_group_id and cg.owner_id = auth.uid()
    )
  );

drop policy if exists copy_group_versions_owner_update on public.copy_group_versions;
create policy copy_group_versions_owner_update
  on public.copy_group_versions for update
  using (
    exists (
      select 1 from public.copy_groups cg
      where cg.id = copy_group_id and cg.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.copy_groups cg
      where cg.id = copy_group_id and cg.owner_id = auth.uid()
    )
  );

drop policy if exists copy_group_versions_owner_delete on public.copy_group_versions;
create policy copy_group_versions_owner_delete
  on public.copy_group_versions for delete
  using (
    exists (
      select 1 from public.copy_groups cg
      where cg.id = copy_group_id and cg.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- TABLA: copy_group_snapshots
-- ============================================================================
create table if not exists public.copy_group_snapshots (
  id uuid primary key default gen_random_uuid(),
  copy_group_id uuid not null references public.copy_groups(id) on delete cascade,
  version_int int not null,
  snapshot_json jsonb not null,
  checksum text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists copy_group_snapshots_unique
  on public.copy_group_snapshots(copy_group_id, version_int);

alter table public.copy_group_snapshots enable row level security;

drop policy if exists copy_group_snapshots_owner_select on public.copy_group_snapshots;
create policy copy_group_snapshots_owner_select
  on public.copy_group_snapshots for select
  using (
    exists (
      select 1 from public.copy_groups cg
      where cg.id = copy_group_id and cg.owner_id = auth.uid()
    )
  );

drop policy if exists copy_group_snapshots_owner_insert on public.copy_group_snapshots;
create policy copy_group_snapshots_owner_insert
  on public.copy_group_snapshots for insert
  with check (
    exists (
      select 1 from public.copy_groups cg
      where cg.id = copy_group_id and cg.owner_id = auth.uid()
    )
  );

drop policy if exists copy_group_snapshots_owner_update on public.copy_group_snapshots;
create policy copy_group_snapshots_owner_update
  on public.copy_group_snapshots for update
  using (
    exists (
      select 1 from public.copy_groups cg
      where cg.id = copy_group_id and cg.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.copy_groups cg
      where cg.id = copy_group_id and cg.owner_id = auth.uid()
    )
  );

drop policy if exists copy_group_snapshots_owner_delete on public.copy_group_snapshots;
create policy copy_group_snapshots_owner_delete
  on public.copy_group_snapshots for delete
  using (
    exists (
      select 1 from public.copy_groups cg
      where cg.id = copy_group_id and cg.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- TABLA: copy_group_events
-- ============================================================================
create table if not exists public.copy_group_events (
  id uuid primary key default gen_random_uuid(),
  copy_group_id uuid not null references public.copy_groups(id) on delete cascade,
  event_type text not null,
  actor_id uuid null references auth.users(id) on delete set null,
  payload_json jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists copy_group_events_group_idx
  on public.copy_group_events(copy_group_id, created_at desc);

alter table public.copy_group_events enable row level security;

drop policy if exists copy_group_events_owner_select on public.copy_group_events;
create policy copy_group_events_owner_select
  on public.copy_group_events for select
  using (
    exists (
      select 1 from public.copy_groups cg
      where cg.id = copy_group_id and cg.owner_id = auth.uid()
    )
  );

drop policy if exists copy_group_events_owner_insert on public.copy_group_events;
create policy copy_group_events_owner_insert
  on public.copy_group_events for insert
  with check (
    exists (
      select 1 from public.copy_groups cg
      where cg.id = copy_group_id and cg.owner_id = auth.uid()
    )
  );

drop policy if exists copy_group_events_owner_update on public.copy_group_events;
create policy copy_group_events_owner_update
  on public.copy_group_events for update
  using (
    exists (
      select 1 from public.copy_groups cg
      where cg.id = copy_group_id and cg.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.copy_groups cg
      where cg.id = copy_group_id and cg.owner_id = auth.uid()
    )
  );

drop policy if exists copy_group_events_owner_delete on public.copy_group_events;
create policy copy_group_events_owner_delete
  on public.copy_group_events for delete
  using (
    exists (
      select 1 from public.copy_groups cg
      where cg.id = copy_group_id and cg.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- TABLA: trade_replication_map
-- ============================================================================
create table if not exists public.trade_replication_map (
  id uuid primary key default gen_random_uuid(),
  master_trade_id uuid not null references public.trades(id) on delete cascade,
  master_account_id uuid not null references public.accounts(id) on delete cascade,
  copy_group_id uuid not null references public.copy_groups(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists trade_replication_map_unique
  on public.trade_replication_map(master_trade_id, copy_group_id);

alter table public.trade_replication_map enable row level security;

drop policy if exists trade_replication_map_owner_select on public.trade_replication_map;
create policy trade_replication_map_owner_select
  on public.trade_replication_map for select
  using (
    exists (
      select 1 from public.copy_groups cg
      where cg.id = copy_group_id and cg.owner_id = auth.uid()
    )
  );

drop policy if exists trade_replication_map_owner_insert on public.trade_replication_map;
create policy trade_replication_map_owner_insert
  on public.trade_replication_map for insert
  with check (
    exists (
      select 1 from public.copy_groups cg
      where cg.id = copy_group_id and cg.owner_id = auth.uid()
    )
  );

drop policy if exists trade_replication_map_owner_update on public.trade_replication_map;
create policy trade_replication_map_owner_update
  on public.trade_replication_map for update
  using (
    exists (
      select 1 from public.copy_groups cg
      where cg.id = copy_group_id and cg.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.copy_groups cg
      where cg.id = copy_group_id and cg.owner_id = auth.uid()
    )
  );

drop policy if exists trade_replication_map_owner_delete on public.trade_replication_map;
create policy trade_replication_map_owner_delete
  on public.trade_replication_map for delete
  using (
    exists (
      select 1 from public.copy_groups cg
      where cg.id = copy_group_id and cg.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- TABLA: slave_trade_links
-- ============================================================================
create table if not exists public.slave_trade_links (
  id uuid primary key default gen_random_uuid(),
  master_trade_id uuid not null references public.trades(id) on delete cascade,
  slave_trade_id uuid not null references public.trades(id) on delete cascade,
  slave_account_id uuid not null references public.accounts(id) on delete cascade,
  status text not null default 'replicated' check (status in ('replicated', 'pending', 'failed', 'need_resync')),
  last_error text null,
  updated_at timestamptz not null default now()
);

create unique index if not exists slave_trade_links_unique
  on public.slave_trade_links(master_trade_id, slave_account_id);

create index if not exists slave_trade_links_slave_idx
  on public.slave_trade_links(slave_account_id);

drop trigger if exists slave_trade_links_updated_at on public.slave_trade_links;
create trigger slave_trade_links_updated_at
  before update on public.slave_trade_links
  for each row
  execute function public.set_updated_at();

alter table public.slave_trade_links enable row level security;

drop policy if exists slave_trade_links_owner_select on public.slave_trade_links;
create policy slave_trade_links_owner_select
  on public.slave_trade_links for select
  using (
    exists (
      select 1 from public.copy_groups cg
      where cg.id = (
        select copy_group_id from public.trade_replication_map tr
        where tr.master_trade_id = slave_trade_links.master_trade_id
        limit 1
      ) and cg.owner_id = auth.uid()
    )
  );

drop policy if exists slave_trade_links_owner_insert on public.slave_trade_links;
create policy slave_trade_links_owner_insert
  on public.slave_trade_links for insert
  with check (
    exists (
      select 1 from public.trade_replication_map tr
      join public.copy_groups cg on cg.id = tr.copy_group_id
      where tr.master_trade_id = slave_trade_links.master_trade_id
        and cg.owner_id = auth.uid()
    )
  );

drop policy if exists slave_trade_links_owner_update on public.slave_trade_links;
create policy slave_trade_links_owner_update
  on public.slave_trade_links for update
  using (
    exists (
      select 1 from public.trade_replication_map tr
      join public.copy_groups cg on cg.id = tr.copy_group_id
      where tr.master_trade_id = slave_trade_links.master_trade_id
        and cg.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.trade_replication_map tr
      join public.copy_groups cg on cg.id = tr.copy_group_id
      where tr.master_trade_id = slave_trade_links.master_trade_id
        and cg.owner_id = auth.uid()
    )
  );

drop policy if exists slave_trade_links_owner_delete on public.slave_trade_links;
create policy slave_trade_links_owner_delete
  on public.slave_trade_links for delete
  using (
    exists (
      select 1 from public.trade_replication_map tr
      join public.copy_groups cg on cg.id = tr.copy_group_id
      where tr.master_trade_id = slave_trade_links.master_trade_id
        and cg.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- TABLA: copy_group_experiments
-- ============================================================================
create table if not exists public.copy_group_experiments (
  id uuid primary key default gen_random_uuid(),
  copy_group_id uuid not null references public.copy_groups(id) on delete cascade,
  flags_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists copy_group_experiments_unique
  on public.copy_group_experiments(copy_group_id);

drop trigger if exists copy_group_experiments_updated_at on public.copy_group_experiments;
create trigger copy_group_experiments_updated_at
  before update on public.copy_group_experiments
  for each row
  execute function public.set_updated_at();

alter table public.copy_group_experiments enable row level security;

drop policy if exists copy_group_experiments_owner_select on public.copy_group_experiments;
create policy copy_group_experiments_owner_select
  on public.copy_group_experiments for select
  using (
    exists (
      select 1 from public.copy_groups cg
      where cg.id = copy_group_id and cg.owner_id = auth.uid()
    )
  );

drop policy if exists copy_group_experiments_owner_insert on public.copy_group_experiments;
create policy copy_group_experiments_owner_insert
  on public.copy_group_experiments for insert
  with check (
    exists (
      select 1 from public.copy_groups cg
      where cg.id = copy_group_id and cg.owner_id = auth.uid()
    )
  );

drop policy if exists copy_group_experiments_owner_update on public.copy_group_experiments;
create policy copy_group_experiments_owner_update
  on public.copy_group_experiments for update
  using (
    exists (
      select 1 from public.copy_groups cg
      where cg.id = copy_group_id and cg.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.copy_groups cg
      where cg.id = copy_group_id and cg.owner_id = auth.uid()
    )
  );

drop policy if exists copy_group_experiments_owner_delete on public.copy_group_experiments;
create policy copy_group_experiments_owner_delete
  on public.copy_group_experiments for delete
  using (
    exists (
      select 1 from public.copy_groups cg
      where cg.id = copy_group_id and cg.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- TABLA: replication_jobs (retry queue)
-- ============================================================================
create table if not exists public.replication_jobs (
  id uuid primary key default gen_random_uuid(),
  copy_group_id uuid not null references public.copy_groups(id) on delete cascade,
  master_trade_id uuid not null references public.trades(id) on delete cascade,
  slave_account_id uuid not null references public.accounts(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'processing', 'failed', 'done')),
  attempts int not null default 0,
  last_error text null,
  scheduled_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists replication_jobs_group_idx
  on public.replication_jobs(copy_group_id, status, scheduled_at);

drop trigger if exists replication_jobs_updated_at on public.replication_jobs;
create trigger replication_jobs_updated_at
  before update on public.replication_jobs
  for each row
  execute function public.set_updated_at();

alter table public.replication_jobs enable row level security;

drop policy if exists replication_jobs_owner_select on public.replication_jobs;
create policy replication_jobs_owner_select
  on public.replication_jobs for select
  using (
    exists (
      select 1 from public.copy_groups cg
      where cg.id = copy_group_id and cg.owner_id = auth.uid()
    )
  );

drop policy if exists replication_jobs_owner_insert on public.replication_jobs;
create policy replication_jobs_owner_insert
  on public.replication_jobs for insert
  with check (
    exists (
      select 1 from public.copy_groups cg
      where cg.id = copy_group_id and cg.owner_id = auth.uid()
    )
  );

drop policy if exists replication_jobs_owner_update on public.replication_jobs;
create policy replication_jobs_owner_update
  on public.replication_jobs for update
  using (
    exists (
      select 1 from public.copy_groups cg
      where cg.id = copy_group_id and cg.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.copy_groups cg
      where cg.id = copy_group_id and cg.owner_id = auth.uid()
    )
  );

drop policy if exists replication_jobs_owner_delete on public.replication_jobs;
create policy replication_jobs_owner_delete
  on public.replication_jobs for delete
  using (
    exists (
      select 1 from public.copy_groups cg
      where cg.id = copy_group_id and cg.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- SNAPSHOT RESTORE: RPC helper
-- ============================================================================
create or replace function public.copy_group_apply_snapshot(
  p_copy_group_id uuid,
  p_snapshot jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.copy_group_links where copy_group_id = p_copy_group_id;
  delete from public.copy_group_nodes where copy_group_id = p_copy_group_id;
  delete from public.copy_group_experiments where copy_group_id = p_copy_group_id;

  -- Nodes
  insert into public.copy_group_nodes (
    id,
    copy_group_id,
    account_id,
    role,
    status,
    risk_pct,
    risk_node,
    created_at,
    updated_at
  )
  select
    coalesce((node_item->>'id')::uuid, gen_random_uuid()),
    p_copy_group_id,
    (node_item->>'account_id')::uuid,
    coalesce(node_item->>'role', 'slave'),
    coalesce(node_item->>'status', 'active'),
    coalesce((node_item->>'risk_pct')::numeric, 0),
    node_item->'risk_node',
    now(),
    now()
  from jsonb_array_elements(coalesce(p_snapshot->'nodes', '[]'::jsonb)) as node_item;

  -- Links
  insert into public.copy_group_links (
    id,
    copy_group_id,
    parent_account_id,
    child_account_id,
    copy_multiplier,
    link_type,
    created_at
  )
  select
    coalesce((link_item->>'id')::uuid, gen_random_uuid()),
    p_copy_group_id,
    (link_item->>'parent_account_id')::uuid,
    (link_item->>'child_account_id')::uuid,
    coalesce((link_item->>'copy_multiplier')::numeric, 1),
    coalesce(link_item->>'link_type', 'solid'),
    now()
  from jsonb_array_elements(coalesce(p_snapshot->'links', '[]'::jsonb)) as link_item;

  -- Experiments
  insert into public.copy_group_experiments (copy_group_id, flags_json, created_at, updated_at)
  values (
    p_copy_group_id,
    coalesce(p_snapshot->'experiments', '{}'::jsonb),
    now(),
    now()
  )
  on conflict (copy_group_id) do update set
    flags_json = excluded.flags_json,
    updated_at = now();
end;
$$;
