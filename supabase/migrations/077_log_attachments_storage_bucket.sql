-- 077_log_attachments_storage_bucket.sql
-- Create the `log_attachments` Supabase Storage bucket that has been
-- referenced by every upload path in the app since migration 021 but
-- was never actually provisioned (021 left it as a commented-out
-- "apply in dashboard" snippet). All uploads to this bucket have
-- silently failed; PolyArb archive flow surfaced the regression.
--
-- Path convention enforced by RLS:
--   ${user_id}/<anything>/...
-- so split_part(name, '/', 1) must equal auth.uid()::text.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'log_attachments',
  'log_attachments',
  false,
  52428800,  -- 50 MB per object
  null       -- no mime restriction; route handlers gate uploads
)
on conflict (id) do nothing;

drop policy if exists log_attachments_select_own on storage.objects;
create policy log_attachments_select_own on storage.objects for select
  using (
    bucket_id = 'log_attachments'
    and auth.uid()::text = split_part(name, '/', 1)
  );

drop policy if exists log_attachments_insert_own on storage.objects;
create policy log_attachments_insert_own on storage.objects for insert
  with check (
    bucket_id = 'log_attachments'
    and auth.uid()::text = split_part(name, '/', 1)
  );

drop policy if exists log_attachments_update_own on storage.objects;
create policy log_attachments_update_own on storage.objects for update
  using (
    bucket_id = 'log_attachments'
    and auth.uid()::text = split_part(name, '/', 1)
  );

drop policy if exists log_attachments_delete_own on storage.objects;
create policy log_attachments_delete_own on storage.objects for delete
  using (
    bucket_id = 'log_attachments'
    and auth.uid()::text = split_part(name, '/', 1)
  );
