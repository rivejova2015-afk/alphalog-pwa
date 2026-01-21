/**
 * Secure Mail IndexedDB
 * Sprint 13: Offline storage for encrypted messages (ciphertext only)
 * 
 * SECURITY CRITICAL:
 * - Only store ciphertext, NEVER plaintext
 * - No passphrases or private keys in IDB
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { SecureMessage, SecureAttachment } from '@/types/secureMail';

interface SecureMailDB extends DBSchema {
  messages: {
    key: string;
    value: SecureMessage;
    indexes: {
      'by-mailbox': string;
      'by-direction': string;
      'by-status': string;
    };
  };
  attachments: {
    key: string;
    value: SecureAttachment;
    indexes: { 'by-message': string };
  };
  outbox: {
    key: string;
    value: {
      id: string;
      mailbox_id: string;
      to_email: string;
      subject_ciphertext: string;
      body_ciphertext: string;
      attachments: Array<{ filename: string; data: Uint8Array }>;
      created_at: string;
    };
  };
}

let dbInstance: IDBPDatabase<SecureMailDB> | null = null;

export async function getSecureMailDB(): Promise<IDBPDatabase<SecureMailDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<SecureMailDB>('secure-mail-v1', 1, {
    upgrade(db) {
      // Messages store
      const messageStore = db.createObjectStore('messages', { keyPath: 'id' });
      messageStore.createIndex('by-mailbox', 'mailbox_id');
      messageStore.createIndex('by-direction', 'direction');
      messageStore.createIndex('by-status', 'status');

      // Attachments store
      const attachmentStore = db.createObjectStore('attachments', { keyPath: 'id' });
      attachmentStore.createIndex('by-message', 'message_id');

      // Outbox for offline queueing
      db.createObjectStore('outbox', { keyPath: 'id' });
    },
  });

  return dbInstance;
}

// Messages
export async function cacheMessage(message: SecureMessage): Promise<void> {
  const db = await getSecureMailDB();
  await db.put('messages', message);
}

export async function getCachedMessages(mailboxId: string): Promise<SecureMessage[]> {
  const db = await getSecureMailDB();
  return db.getAllFromIndex('messages', 'by-mailbox', mailboxId);
}

export async function getCachedMessage(id: string): Promise<SecureMessage | undefined> {
  const db = await getSecureMailDB();
  return db.get('messages', id);
}

export async function removeCachedMessage(id: string): Promise<void> {
  const db = await getSecureMailDB();
  await db.delete('messages', id);
}

// Attachments
export async function cacheAttachment(attachment: SecureAttachment): Promise<void> {
  const db = await getSecureMailDB();
  await db.put('attachments', attachment);
}

export async function getCachedAttachments(messageId: string): Promise<SecureAttachment[]> {
  const db = await getSecureMailDB();
  return db.getAllFromIndex('attachments', 'by-message', messageId);
}

// Outbox (for offline sending)
export async function addToOutbox(
  mailboxId: string,
  toEmail: string,
  subjectCiphertext: string,
  bodyCiphertext: string,
  attachments: Array<{ filename: string; data: Uint8Array }>
): Promise<string> {
  const db = await getSecureMailDB();
  const id = crypto.randomUUID();
  await db.put('outbox', {
    id,
    mailbox_id: mailboxId,
    to_email: toEmail,
    subject_ciphertext: subjectCiphertext,
    body_ciphertext: bodyCiphertext,
    attachments,
    created_at: new Date().toISOString(),
  });
  return id;
}

export async function getOutboxMessages(): Promise<
  Array<{
    id: string;
    mailbox_id: string;
    to_email: string;
    subject_ciphertext: string;
    body_ciphertext: string;
    attachments: Array<{ filename: string; data: Uint8Array }>;
    created_at: string;
  }>
> {
  const db = await getSecureMailDB();
  return db.getAll('outbox');
}

export async function removeFromOutbox(id: string): Promise<void> {
  const db = await getSecureMailDB();
  await db.delete('outbox', id);
}

export async function clearAllCaches(): Promise<void> {
  const db = await getSecureMailDB();
  await db.clear('messages');
  await db.clear('attachments');
  await db.clear('outbox');
}
