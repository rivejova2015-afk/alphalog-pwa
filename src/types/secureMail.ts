/**
 * Secure Mail Types
 * Sprint 13: Type definitions for secure email system
 */

export interface Mailbox {
  id: string;
  user_id: string;
  email_alias: string;
  pgp_public_key: string;
  pgp_private_key_encrypted: string;
  key_kdf: {
    algorithm: string;
    iterations: number;
    hashAlgorithm: string;
  };
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sort_index: number;
}

export interface AllowedSender {
  id: string;
  user_id: string;
  mailbox_id: string;
  sender_email: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sort_index: number;
}

export interface ContactKey {
  id: string;
  user_id: string;
  contact_email: string;
  pgp_public_key: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sort_index: number;
}

export interface SecureMessage {
  id: string;
  user_id: string;
  mailbox_id: string;
  provider_message_id: string | null;
  thread_id: string | null;
  from_email: string;
  to_email: string;
  subject_ciphertext: string;
  body_ciphertext: string;
  received_at: string | null;
  direction: 'inbound' | 'outbound';
  status: 'received' | 'queued' | 'sent' | 'failed';
  meta: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sort_index: number;
}

export interface SecureAttachment {
  id: string;
  user_id: string;
  message_id: string;
  filename_ciphertext: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sort_index: number;
}

export interface AccessAudit {
  id: string;
  user_id: string;
  message_id: string;
  event: 'open' | 'decrypt' | 'download_attachment' | 'send';
  created_at: string;
}
