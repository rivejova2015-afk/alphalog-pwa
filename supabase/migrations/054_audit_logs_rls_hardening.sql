-- 054_audit_logs_rls_hardening.sql
-- Harden audit_logs RLS policies and fix missing constraint values

BEGIN;

-- 1) Remove the open insert policy that allowed any authenticated user to inject audit entries
DROP POLICY IF EXISTS audit_logs_insert ON public.audit_logs;

-- 2) Remove the recursive admin select policy (performance hazard, unnecessary)
-- All read access via log_audit_event() which is security definer
DROP POLICY IF EXISTS audit_logs_select_admin ON public.audit_logs;

-- 3) Fix action check constraint: add bot_signal_generated (present in TypeScript but missing in DB)
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;

ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_action_check CHECK (action IN (
  'create', 'read', 'update', 'delete',
  'export', 'import', 'download', 'upload',
  'login', 'logout', 'stepup', 'device_trust',
  'api_call', 'webhook', 'report_generate',
  'bot_signal_generated'  -- newly added
));

-- 4) Fix status check constraint: add skipped (present in TypeScript but missing in DB)
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_status_check;

ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_status_check CHECK (status IN (
  'success', 'failure', 'partial', 'skipped'  -- 'skipped' newly added
));

COMMIT;
