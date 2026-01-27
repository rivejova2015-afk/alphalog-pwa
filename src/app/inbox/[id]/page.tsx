'use client';

/**
 * Message Detail Component
 * Sprint 13: Decrypt and view message
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Mail, Lock, Unlock, Download, ArrowLeft, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';
import { decryptText, decryptBytes } from '@/lib/crypto/openpgp';
import type { SecureMessage, SecureAttachment, Mailbox } from '@/types/secureMail';

export default function MessageDetail() {
  const params = useParams();
  const router = useRouter();
  const messageId = params.id as string;

  const [message, setMessage] = useState<SecureMessage | null>(null);
  const [mailbox, setMailbox] = useState<Mailbox | null>(null);
  const [attachments, setAttachments] = useState<SecureAttachment[]>([]);
  const [decryptedSubject, setDecryptedSubject] = useState('');
  const [decryptedBody, setDecryptedBody] = useState('');
  const [isDecrypted, setIsDecrypted] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [loading, setLoading] = useState(true);
  const [decrypting, setDecrypting] = useState(false);
  const [error, setError] = useState('');

  const loadMessage = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const supabase = createClient();

      const { data: msgData, error: msgError } = await supabase
        .from('secure_messages')
        .select('*')
        .eq('id', messageId)
        .single();

      if (msgError || !msgData) throw new Error('Message not found');
      setMessage(msgData);

      const { data: mbData, error: mbError } = await supabase
        .from('secure_mailboxes')
        .select('*')
        .eq('id', msgData.mailbox_id)
        .single();

      if (mbError || !mbData) throw new Error('Mailbox not found');
      setMailbox(mbData);

      const { data: attData } = await supabase
        .from('secure_attachments')
        .select('*')
        .eq('message_id', messageId)
        .is('deleted_at', null);

      if (attData) setAttachments(attData);

      // Log open event
      await supabase.from('secure_message_access_audit').insert({
        user_id: msgData.user_id,
        message_id: messageId,
        event: 'open',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load message');
    } finally {
      setLoading(false);
    }
  }, [messageId]);

  useEffect(() => {
    void loadMessage();
  }, [loadMessage]);

  const handleDecrypt = async () => {
    if (!passphrase || !message || !mailbox) return;

    setDecrypting(true);
    setError('');

    try {
      const subject = await decryptText(
        message.subject_ciphertext,
        mailbox.pgp_private_key_encrypted,
        passphrase
      );

      const body = await decryptText(
        message.body_ciphertext,
        mailbox.pgp_private_key_encrypted,
        passphrase
      );

      setDecryptedSubject(subject);
      setDecryptedBody(body);
      setIsDecrypted(true);
      setPassphrase(''); // Clear passphrase immediately

      // Log decrypt event
      const supabase = createClient();
      await supabase.from('secure_message_access_audit').insert({
        user_id: message.user_id,
        message_id: messageId,
        event: 'decrypt',
      });
    } catch (err) {
      setError('Failed to decrypt - check your passphrase');
    } finally {
      setDecrypting(false);
    }
  };

  const handleDownloadAttachment = async (attachment: SecureAttachment) => {
    if (!passphrase || !mailbox) {
      setError('Enter passphrase to download attachment');
      return;
    }

    try {
      const supabase = createClient();

      // Download from storage
      const { data, error } = await supabase.storage
        .from('secure-mail')
        .download(attachment.storage_path);

      if (error || !data) throw new Error('Failed to download attachment');

      // Decrypt
      const arrayBuffer = await data.arrayBuffer();
      const ciphertext = new Uint8Array(arrayBuffer);
      const decrypted = await decryptBytes(
        ciphertext,
        mailbox.pgp_private_key_encrypted,
        passphrase
      );

      // Download
      const ab = decrypted.buffer as ArrayBuffer;
      const blob = new Blob([ab], { type: attachment.mime_type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.filename_ciphertext; // Decrypt filename if needed
      a.click();
      URL.revokeObjectURL(url);

      // Log event
      await supabase.from('secure_message_access_audit').insert({
        user_id: message!.user_id,
        message_id: messageId,
        event: 'download_attachment',
      });
    } catch (err) {
      setError('Failed to download attachment');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-400">Loading message...</p>
      </div>
    );
  }

  if (!message || !mailbox) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-400">Message not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="max-w-4xl mx-auto py-8 px-4">
        <button
          onClick={() => router.push('/inbox')}
          className="mb-6 flex items-center gap-2 text-slate-400 hover:text-slate-200"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Inbox
        </button>

        {error && (
          <div className="mb-4 p-3 bg-red-600/10 border border-red-500/30 rounded-2xl flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-300 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-red-200">{error}</span>
          </div>
        )}

        <div className="bg-slate-900/70 rounded-2xl shadow-[0_18px_40px_rgba(2,4,10,0.45)] border border-slate-700/60 p-6">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              <Mail className="w-6 h-6 text-blue-300" />
              <h1 className="display-font text-2xl font-semibold text-slate-50">
                {isDecrypted ? decryptedSubject : 'Encrypted Message'}
              </h1>
              {isDecrypted ? (
                <Unlock className="w-5 h-5 text-emerald-300" />
              ) : (
                <Lock className="w-5 h-5 text-slate-500" />
              )}
            </div>

            <div className="space-y-2 text-sm text-slate-400">
              <p>
                <span className="font-medium">From:</span> {message.from_email}
              </p>
              <p>
                <span className="font-medium">To:</span> {message.to_email}
              </p>
              <p>
                <span className="font-medium">Date:</span>{' '}
                {new Date(message.created_at).toLocaleString()}
              </p>
            </div>
          </div>

          {!isDecrypted ? (
            <div className="p-6 bg-slate-900/60 rounded-2xl border border-slate-700/60">
              <p className="text-slate-300 mb-4">
                This message is encrypted. Enter your passphrase to decrypt.
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="Enter passphrase"
                  className="flex-1 px-3 py-2 border border-slate-700/70 rounded-lg bg-slate-900/60 text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-blue-600/40 focus:border-transparent"
                  onKeyDown={(e) => e.key === 'Enter' && handleDecrypt()}
                />
                <button
                  onClick={handleDecrypt}
                  disabled={decrypting || !passphrase}
                  className="px-6 py-2 bg-blue-600 text-slate-950 rounded-full hover:bg-blue-700 disabled:opacity-50"
                >
                  {decrypting ? 'Decrypting...' : 'Decrypt'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="prose prose-invert max-w-none">
                <pre className="whitespace-pre-wrap text-slate-100">{decryptedBody}</pre>
              </div>

              {attachments.length > 0 && (
                <div className="mt-6 pt-6 border-t border-slate-700/60">
                  <h3 className="font-semibold text-slate-100 mb-3">
                    Attachments ({attachments.length})
                  </h3>
                  <div className="space-y-2">
                    {attachments.map((att) => (
                      <button
                        key={att.id}
                        onClick={() => handleDownloadAttachment(att)}
                        className="w-full p-3 bg-slate-900/60 border border-slate-700/60 rounded-lg hover:bg-slate-800/70 flex items-center justify-between"
                      >
                        <span className="text-sm font-medium text-slate-100">
                          {att.filename_ciphertext}
                        </span>
                        <Download className="w-4 h-4 text-slate-400" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
