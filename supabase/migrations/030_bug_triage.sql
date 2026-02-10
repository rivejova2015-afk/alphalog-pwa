-- 030_bug_triage.sql
-- Bug triage for auto-classification

create table if not exists public.bug_triage (
  id uuid primary key default gen_random_uuid(),
  bug_report_id uuid not null references public.bug_reports(id) on delete cascade,
  category text not null,
  severity text not null,
  fingerprint text not null,
  suggestion text,
  created_at timestamptz not null default now(),

  constraint bug_triage_severity_check check (severity in ('low', 'medium', 'high', 'critical'))
);

create index if not exists bug_triage_report_idx
  on public.bug_triage(bug_report_id, created_at desc);

create index if not exists bug_triage_fingerprint_idx
  on public.bug_triage(fingerprint, created_at desc);

alter table public.bug_triage enable row level security;

create policy bug_triage_select_own
  on public.bug_triage for select
  using (
    exists (
      select 1
      from public.bug_reports
      where bug_reports.id = bug_triage.bug_report_id
        and bug_reports.user_id = auth.uid()
    )
  );

create policy bug_triage_insert
  on public.bug_triage for insert
  with check (true);

create or replace function public.log_bug_triage(
  p_bug_report_id uuid,
  p_category text,
  p_severity text,
  p_fingerprint text,
  p_suggestion text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  triage_id uuid;
begin
  insert into public.bug_triage (
    bug_report_id,
    category,
    severity,
    fingerprint,
    suggestion
  )
  values (
    p_bug_report_id,
    p_category,
    p_severity,
    p_fingerprint,
    p_suggestion
  )
  returning id into triage_id;

  return triage_id;
end;
$$;
