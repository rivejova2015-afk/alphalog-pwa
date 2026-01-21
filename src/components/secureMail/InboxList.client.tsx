'use client';

/**
 * Inbox List Component
 * Sprint 13: Message list with offline support
 */

import { useState, useEffect } from 'react';
import { Mail, Inbox as InboxIcon, Send, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';
import { getCachedMessages, cacheMessage } from '@/lib/offline/secureMailIdb';
import type { SecureMessage, Mailbox } from '@/types/secureMail';
import Link from 'next/link';

export default function InboxList() {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [selectedMailbox, setSelectedMailbox] = useState<string>('');
  const [messages, setMessages] = useState<SecureMessage[]>([]);
  const [filter, setFilter] = useState<'all' | 'inbound' | 'outbound'>('all');
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadMailboxes();
    checkOnlineStatus();

    window.addEventListener('online', () => setOffline(false));
    window.addEventListener('offline', () => setOffline(true));

    return () => {
      window.removeEventListener('online', () => setOffline(false));
      window.removeEventListener('offline', () => setOffline(true));
    };
  }, []);

  useEffect(() => {
    if (selectedMailbox) {
      loadMessages(selectedMailbox);
    }
  }, [selectedMailbox, filter]);

  const checkOnlineStatus = () => {
    setOffline(!navigator.onLine);
  };

  const loadMailboxes = async () => {
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
  };

  const loadMessages = async (mailboxId: string) => {
    setLoading(true);
    setError('');

    try {
      if (offline) {
        // Load from cache
        const cached = await getCachedMessages(mailboxId);
        setMessages(
          filter === 'all'
            ? cached
            : cached.filter((m) => m.direction === filter)
        );
      } else {
        // Load from Supabase
        const supabase = createClient();
        let query = supabase
          .from('secure_messages')
          .select('*')
          .eq('mailbox_id', mailboxId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false });

        if (filter !== 'all') {
          query = query.eq('direction', filter);
        }

        const { data, error: fetchError } = await query;

        if (fetchError) throw fetchError;

        setMessages(data || []);

        // Cache messages
        if (data) {
          for (const msg of data) {
            await cacheMessage(msg);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 px-4">
        {offline && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <span className="text-sm text-yellow-800">Offline mode - showing cached messages</span>
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <InboxIcon className="w-8 h-8 text-blue-600" />
            Secure Inbox
          </h1>
          <Link
            href="/inbox/compose"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            Compose
          </Link>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-red-800">{error}</span>
          </div>
        )}

        {mailboxes.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
            <Mail className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">No mailboxes configured</p>
            <Link
              href="/inbox/settings"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-block"
            >
              Set up your mailbox
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6 flex gap-4">
              <select
                value={selectedMailbox}
                onChange={(e) => setSelectedMailbox(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {mailboxes.map((mailbox) => (
                  <option key={mailbox.id} value={mailbox.id}>
                    {mailbox.email_alias}
                  </option>
                ))}
              </select>

              <div className="flex gap-2">
                {(['all', 'inbound', 'outbound'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      filter === f
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              {loading ? (
                <div className="p-12 text-center text-gray-500">Loading messages...</div>
              ) : messages.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  <Mail className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  No messages found
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {messages.map((message) => (
                    <Link
                      key={message.id}
                      href={`/inbox/${message.id}`}
                      className="block p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {message.direction === 'inbound' ? (
                              <Mail className="w-4 h-4 text-blue-600 flex-shrink-0" />
                            ) : (
                              <Send className="w-4 h-4 text-green-600 flex-shrink-0" />
                            )}
                            <span className="font-medium text-gray-900 truncate">
                              {message.direction === 'inbound' ? message.from_email : message.to_email}
                            </span>
                            {message.status === 'failed' && (
                              <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">
                                Failed
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 truncate mb-1">
                            {message.subject_ciphertext.slice(0, 80)}...
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatDate(message.created_at)}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
