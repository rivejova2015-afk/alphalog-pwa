'use client';

/**
 * Allowed Senders Management
 * Sprint 13: Whitelist management for secure email
 */

import { useState, useEffect, useCallback } from 'react';
import { Shield, Plus, Trash2, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';
import type { AllowedSender, Mailbox } from '@/types/secureMail';

export default function AllowedSenders() {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [selectedMailbox, setSelectedMailbox] = useState<string>('');
  const [senders, setSenders] = useState<AllowedSender[]>([]);
  const [newSenderEmail, setNewSenderEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadMailboxes = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('secure_mailboxes')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (data && !error) {
      setMailboxes(data);
      if (data.length > 0 && !selectedMailbox) {
        setSelectedMailbox(data[0].id);
      }
    }
  }, [selectedMailbox]);

  useEffect(() => {
    void loadMailboxes();
  }, [loadMailboxes]);

  const loadSenders = useCallback(async (mailboxId: string) => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('secure_allowed_senders')
      .select('*')
      .eq('mailbox_id', mailboxId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (data && !error) {
      setSenders(data);
    }
  }, []);

  useEffect(() => {
    if (selectedMailbox) {
      void loadSenders(selectedMailbox);
    }
  }, [selectedMailbox, loadSenders]);

  const handleAddSender = async () => {
    setError('');
    if (!newSenderEmail.trim()) {
      setError('Email is required');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newSenderEmail)) {
      setError('Invalid email format');
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error: insertError } = await supabase
        .from('secure_allowed_senders')
        .insert({
          user_id: user.id,
          mailbox_id: selectedMailbox,
          sender_email: newSenderEmail.toLowerCase(),
          is_active: true,
        });

      if (insertError) throw insertError;

      setNewSenderEmail('');
      await loadSenders(selectedMailbox);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add sender');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveSender = async (id: string) => {
    if (!confirm('Remove this sender from allowlist?')) return;

    const supabase = createClient();
    const { error } = await supabase
      .from('secure_allowed_senders')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (!error) {
      await loadSenders(selectedMailbox);
    }
  };

  const handleToggleActive = async (sender: AllowedSender) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('secure_allowed_senders')
      .update({ is_active: !sender.is_active })
      .eq('id', sender.id);

    if (!error) {
      await loadSenders(selectedMailbox);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="display-font text-2xl font-semibold text-slate-50 mb-2 flex items-center gap-2">
          <Shield className="w-6 h-6" />
          Allowed Senders
        </h2>
        <p className="text-sm text-slate-400">
          Only emails from these addresses will be accepted. Unauthorized senders are rejected.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-600/10 border border-red-500/30 rounded-2xl flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-300 flex-shrink-0 mt-0.5" />
          <span className="text-sm text-red-200">{error}</span>
        </div>
      )}

      {mailboxes.length === 0 ? (
        <div className="text-center py-12 bg-slate-900/60 border border-slate-700/60 rounded-2xl">
          <Shield className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400">No mailboxes found. Set up your PGP keys first.</p>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-200 mb-2">Select Mailbox</label>
            <select
              value={selectedMailbox}
              onChange={(e) => setSelectedMailbox(e.target.value)}
              className="w-full px-3 py-2 border border-slate-700/70 rounded-lg bg-slate-900/60 text-slate-100 focus:ring-2 focus:ring-blue-600/40 focus:border-transparent"
            >
              {mailboxes.map((mailbox) => (
                <option key={mailbox.id} value={mailbox.id}>
                  {mailbox.email_alias}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-6 flex gap-2">
            <input
              type="email"
              value={newSenderEmail}
              onChange={(e) => setNewSenderEmail(e.target.value)}
              placeholder="sender@example.com"
              className="flex-1 px-3 py-2 border border-slate-700/70 rounded-lg bg-slate-900/60 text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-blue-600/40 focus:border-transparent"
              onKeyDown={(e) => e.key === 'Enter' && handleAddSender()}
            />
            <button
              onClick={handleAddSender}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-slate-950 rounded-full hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>

          <div className="space-y-2">
            {senders.length === 0 ? (
              <div className="text-center py-8 bg-slate-900/60 border border-slate-700/60 rounded-2xl">
                <p className="text-slate-400">No allowed senders yet. Add one above.</p>
              </div>
            ) : (
              senders.map((sender) => (
                <div
                  key={sender.id}
                  className="flex items-center justify-between p-3 bg-slate-900/70 border border-slate-700/60 rounded-xl hover:border-blue-600/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={sender.is_active}
                      onChange={() => handleToggleActive(sender)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-600/40"
                    />
                    <span className={`font-medium ${sender.is_active ? 'text-slate-100' : 'text-slate-500 line-through'}`}>
                      {sender.sender_email}
                    </span>
                    {sender.is_active && (
                      <span className="px-2 py-0.5 text-xs bg-emerald-600/15 text-emerald-200 rounded-full border border-emerald-500/30">
                        Active
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveSender(sender.id)}
                    className="p-2 text-rose-300 hover:bg-rose-600/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
