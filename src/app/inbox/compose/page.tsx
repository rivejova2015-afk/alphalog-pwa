'use client';

/**
 * Compose Email Component
 * Sprint 13: Compose and send encrypted email
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Paperclip, ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';
import { encryptText, encryptBytes } from '@/lib/crypto/openpgp';
import type { Mailbox, ContactKey } from '@/types/secureMail';

export default function ComposePage() {
  const router = useRouter();

  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [contacts, setContacts] = useState<ContactKey[]>([]);
  const [selectedMailbox, setSelectedMailbox] = useState('');
  const [toEmail, setToEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadMailboxes();
    loadContacts();
  }, []);

  const loadMailboxes = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('secure_mailboxes')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (data && data.length > 0) {
      setMailboxes(data);
      setSelectedMailbox(data[0].id);
    }
  };

  const loadContacts = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('secure_contacts_keys')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('contact_email', { ascending: true });

    if (data) setContacts(data);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const maxSize = parseInt(process.env.NEXT_PUBLIC_SECURE_MAIL_MAX_EMAIL_ATTACHMENT_BYTES || '10485760');
      
      const validFiles = files.filter((file) => {
        if (file.size > maxSize) {
          setError(`File ${file.name} is too large (max 10MB)`);
          return false;
        }
        return true;
      });

      setAttachments([...attachments, ...validFiles]);
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    setError('');
    setSuccess('');

    if (!selectedMailbox || !toEmail || !subject || !body) {
      setError('All fields are required');
      return;
    }

    setSending(true);
    try {
      const supabase = createClient();

      // Get recipient's public key
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: contactKey } = await supabase
        .from('secure_contacts_keys')
        .select('pgp_public_key')
        .eq('user_id', user.id)
        .eq('contact_email', toEmail.toLowerCase())
        .is('deleted_at', null)
        .single();

      if (!contactKey) {
        throw new Error('Recipient not in contacts. Add their public key first.');
      }

      // Encrypt subject and body
      const subjectCiphertext = await encryptText(subject, contactKey.pgp_public_key);
      const bodyCiphertext = await encryptText(body, contactKey.pgp_public_key);

      // Encrypt attachments
      const encryptedAttachments: Array<{
        filename: string;
        content_base64: string;
        content_type: string;
      }> = [];

      // Helper: Convert Uint8Array to base64 (browser-safe)
      const uint8ToBase64 = (u8: Uint8Array): string => {
        let binary = '';
        const len = u8.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(u8[i]);
        }
        return btoa(binary);
      };

      for (const file of attachments) {
        const arrayBuffer = await file.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        const encrypted = await encryptBytes(data, contactKey.pgp_public_key);
        const base64 = uint8ToBase64(encrypted);

        encryptedAttachments.push({
          filename: file.name,
          content_base64: base64,
          content_type: file.type || 'application/octet-stream',
        });
      }

      // Send via API
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/outbound/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          mailbox_id: selectedMailbox,
          to_email: toEmail.toLowerCase(),
          subject_ciphertext: subjectCiphertext,
          body_ciphertext: bodyCiphertext,
          attachments: encryptedAttachments,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send email');
      }

      setSuccess('Email sent successfully!');
      setTimeout(() => router.push('/inbox'), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4">
        <button
          onClick={() => router.push('/inbox')}
          className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Inbox
        </button>

        <h1 className="text-3xl font-bold text-gray-900 mb-6 flex items-center gap-3">
          <Send className="w-8 h-8 text-blue-600" />
          Compose Email
        </h1>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-red-800">{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-green-800">{success}</span>
          </div>
        )}

        {mailboxes.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
            <p className="text-gray-600 mb-4">No mailboxes configured</p>
            <button
              onClick={() => router.push('/inbox/settings')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Set up mailbox
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                <select
                  value={selectedMailbox}
                  onChange={(e) => setSelectedMailbox(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {mailboxes.map((mailbox) => (
                    <option key={mailbox.id} value={mailbox.id}>
                      {mailbox.email_alias}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                <input
                  type="email"
                  value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                  placeholder="recipient@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  list="contacts-list"
                />
                <datalist id="contacts-list">
                  {contacts.map((contact) => (
                    <option key={contact.id} value={contact.contact_email} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email subject"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Your message..."
                  rows={12}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Attachments</label>
                <div className="flex items-center gap-2">
                  <label className="px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 cursor-pointer flex items-center gap-2">
                    <Paperclip className="w-4 h-4" />
                    Add Files
                    <input
                      type="file"
                      multiple
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
                {attachments.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {attachments.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded"
                      >
                        <span className="text-sm text-gray-700">{file.name}</span>
                        <button
                          onClick={() => handleRemoveAttachment(index)}
                          className="text-red-600 hover:text-red-700 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  onClick={handleSend}
                  disabled={sending}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
                >
                  <Send className="w-5 h-5" />
                  {sending ? 'Sending...' : 'Send Encrypted Email'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
