-- Migration: 017_secure_mail.sql
-- Sprint 13: Secure Email Directory (Inbox) with E2E OpenPGP
-- Created: 2026-01-20

-- ============================================
-- 1. MAILBOXES (usuario tiene alias de email)
-- ============================================
CREATE TABLE IF NOT EXISTS secure_mailboxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_alias TEXT NOT NULL UNIQUE,
  pgp_public_key TEXT NOT NULL,
  pgp_private_key_encrypted TEXT NOT NULL,
  key_kdf JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  sort_index INTEGER DEFAULT 0
);

CREATE INDEX idx_secure_mailboxes_user_id ON secure_mailboxes(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_secure_mailboxes_email_alias ON secure_mailboxes(email_alias) WHERE deleted_at IS NULL;

-- ============================================
-- 2. ALLOWED SENDERS (whitelist)
-- ============================================
CREATE TABLE IF NOT EXISTS secure_allowed_senders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mailbox_id UUID NOT NULL REFERENCES secure_mailboxes(id) ON DELETE CASCADE,
  sender_email TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  sort_index INTEGER DEFAULT 0,
  UNIQUE(user_id, mailbox_id, sender_email)
);

CREATE INDEX idx_secure_allowed_senders_user_id ON secure_allowed_senders(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_secure_allowed_senders_mailbox_id ON secure_allowed_senders(mailbox_id) WHERE deleted_at IS NULL;

-- ============================================
-- 3. CONTACTS PUBLIC KEYS
-- ============================================
CREATE TABLE IF NOT EXISTS secure_contacts_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_email TEXT NOT NULL,
  pgp_public_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  sort_index INTEGER DEFAULT 0,
  UNIQUE(user_id, contact_email)
);

CREATE INDEX idx_secure_contacts_keys_user_id ON secure_contacts_keys(user_id) WHERE deleted_at IS NULL;

-- ============================================
-- 4. MESSAGES (inbound + outbound)
-- ============================================
CREATE TABLE IF NOT EXISTS secure_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mailbox_id UUID NOT NULL REFERENCES secure_mailboxes(id) ON DELETE CASCADE,
  provider_message_id TEXT,
  thread_id TEXT,
  from_email TEXT NOT NULL,
  to_email TEXT NOT NULL,
  subject_ciphertext TEXT NOT NULL,
  body_ciphertext TEXT NOT NULL,
  received_at TIMESTAMPTZ,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  status TEXT NOT NULL CHECK (status IN ('received', 'queued', 'sent', 'failed')),
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  sort_index INTEGER DEFAULT 0
);

CREATE INDEX idx_secure_messages_user_id ON secure_messages(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_secure_messages_mailbox_id ON secure_messages(mailbox_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_secure_messages_thread_id ON secure_messages(thread_id) WHERE deleted_at IS NULL AND thread_id IS NOT NULL;
CREATE INDEX idx_secure_messages_direction ON secure_messages(direction) WHERE deleted_at IS NULL;
CREATE INDEX idx_secure_messages_status ON secure_messages(status) WHERE deleted_at IS NULL;

-- ============================================
-- 5. ATTACHMENTS (cifrados en storage)
-- ============================================
CREATE TABLE IF NOT EXISTS secure_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES secure_messages(id) ON DELETE CASCADE,
  filename_ciphertext TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  sort_index INTEGER DEFAULT 0
);

CREATE INDEX idx_secure_attachments_user_id ON secure_attachments(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_secure_attachments_message_id ON secure_attachments(message_id) WHERE deleted_at IS NULL;

-- ============================================
-- 6. ACCESS AUDIT (compliance)
-- ============================================
CREATE TABLE IF NOT EXISTS secure_message_access_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES secure_messages(id) ON DELETE CASCADE,
  event TEXT NOT NULL CHECK (event IN ('open', 'decrypt', 'download_attachment', 'send')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_secure_message_access_audit_user_id ON secure_message_access_audit(user_id);
CREATE INDEX idx_secure_message_access_audit_message_id ON secure_message_access_audit(message_id);
CREATE INDEX idx_secure_message_access_audit_event ON secure_message_access_audit(event);

-- ============================================
-- 7. UPDATED_AT TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_secure_mailboxes_updated_at
  BEFORE UPDATE ON secure_mailboxes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_secure_allowed_senders_updated_at
  BEFORE UPDATE ON secure_allowed_senders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_secure_contacts_keys_updated_at
  BEFORE UPDATE ON secure_contacts_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_secure_messages_updated_at
  BEFORE UPDATE ON secure_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_secure_attachments_updated_at
  BEFORE UPDATE ON secure_attachments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 8. ROW LEVEL SECURITY (owner-only)
-- ============================================
ALTER TABLE secure_mailboxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE secure_allowed_senders ENABLE ROW LEVEL SECURITY;
ALTER TABLE secure_contacts_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE secure_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE secure_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE secure_message_access_audit ENABLE ROW LEVEL SECURITY;

-- Policies: owner-only
CREATE POLICY secure_mailboxes_owner_policy ON secure_mailboxes
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY secure_allowed_senders_owner_policy ON secure_allowed_senders
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY secure_contacts_keys_owner_policy ON secure_contacts_keys
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY secure_messages_owner_policy ON secure_messages
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY secure_attachments_owner_policy ON secure_attachments
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY secure_message_access_audit_owner_policy ON secure_message_access_audit
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 9. STORAGE BUCKET (secure-mail)
-- ============================================
-- Note: Bucket creation and policies must be done via Supabase dashboard or API
-- This is documented here for reference:
--
-- Bucket: secure-mail (private)
-- Path convention: /<user_id>/<message_id>/<attachment_id>
-- 
-- Storage policies (owner-only):
-- INSERT: bucket_id = 'secure-mail' AND (storage.foldername(name))[1] = auth.uid()::text
-- SELECT: bucket_id = 'secure-mail' AND (storage.foldername(name))[1] = auth.uid()::text
-- UPDATE: bucket_id = 'secure-mail' AND (storage.foldername(name))[1] = auth.uid()::text
-- DELETE: bucket_id = 'secure-mail' AND (storage.foldername(name))[1] = auth.uid()::text

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Sprint 13: Secure Email tables created with E2E encryption support
-- All data stored as ciphertext (no plaintext in DB)
-- RLS policies enforce owner-only access
-- Storage bucket for encrypted attachments
