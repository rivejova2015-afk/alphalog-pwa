-- Fix: src/app/api/secure-mail/messages/[id]/route.ts inserts event='read'
-- on every GET (message view), but the migration 017 CHECK constraint only
-- allowed 'open','decrypt','download_attachment','send' — that insert has
-- been failing silently (fire-and-forget, no error handling) since the
-- route was written. The audit trail for message reads via this endpoint
-- was never actually recorded.

ALTER TABLE public.secure_message_access_audit
  DROP CONSTRAINT IF EXISTS secure_message_access_audit_event_check;

ALTER TABLE public.secure_message_access_audit
  ADD CONSTRAINT secure_message_access_audit_event_check
    CHECK (event IN ('open', 'read', 'decrypt', 'download_attachment', 'send'));

NOTIFY pgrst, 'reload schema';
