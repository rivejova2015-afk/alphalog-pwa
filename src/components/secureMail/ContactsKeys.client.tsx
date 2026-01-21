'use client';

/**
 * Contacts Public Keys Management
 * Sprint 13: Manage public keys for outbound encryption
 */

import { useState, useEffect } from 'react';
import { Users, Plus, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';
import { verifyPublicKey, extractEmailFromKey } from '@/lib/crypto/openpgp';
import type { ContactKey } from '@/types/secureMail';

export default function ContactsKeys() {
  const [contacts, setContacts] = useState<ContactKey[]>([]);
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newContactKey, setNewContactKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('secure_contacts_keys')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('contact_email', { ascending: true });

    if (data && !error) {
      setContacts(data);
    }
  };

  const handleAddContact = async () => {
    setError('');
    setSuccess('');

    if (!newContactEmail.trim() || !newContactKey.trim()) {
      setError('Email and public key are required');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newContactEmail)) {
      setError('Invalid email format');
      return;
    }

    setLoading(true);
    try {
      const isValid = await verifyPublicKey(newContactKey);
      if (!isValid) {
        throw new Error('Invalid PGP public key format');
      }

      const extractedEmail = await extractEmailFromKey(newContactKey);
      if (extractedEmail && extractedEmail.toLowerCase() !== newContactEmail.toLowerCase()) {
        if (!confirm(`Key email (${extractedEmail}) doesn't match contact email (${newContactEmail}). Continue?`)) {
          setLoading(false);
          return;
        }
      }

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error: insertError } = await supabase
        .from('secure_contacts_keys')
        .insert({
          user_id: user.id,
          contact_email: newContactEmail.toLowerCase(),
          pgp_public_key: newContactKey,
        });

      if (insertError) throw insertError;

      setNewContactEmail('');
      setNewContactKey('');
      setSuccess('Contact added successfully');
      await loadContacts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add contact');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveContact = async (id: string) => {
    if (!confirm('Remove this contact? You will not be able to send encrypted emails to them.')) return;

    const supabase = createClient();
    const { error } = await supabase
      .from('secure_contacts_keys')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (!error) {
      await loadContacts();
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <Users className="w-6 h-6" />
          Contacts Public Keys
        </h2>
        <p className="text-sm text-gray-600">
          Store public keys for contacts to send them encrypted emails.
        </p>
      </div>

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

      <div className="mb-6 p-4 bg-white border border-gray-200 rounded-lg">
        <h3 className="font-semibold text-gray-900 mb-4">Add New Contact</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={newContactEmail}
              onChange={(e) => setNewContactEmail(e.target.value)}
              placeholder="contact@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">PGP Public Key (ASCII Armored)</label>
            <textarea
              value={newContactKey}
              onChange={(e) => setNewContactKey(e.target.value)}
              placeholder="-----BEGIN PGP PUBLIC KEY BLOCK-----"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-xs"
              rows={8}
            />
          </div>
          <button
            onClick={handleAddContact}
            disabled={loading}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {loading ? 'Adding...' : 'Add Contact'}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold text-gray-900 mb-3">Saved Contacts ({contacts.length})</h3>
        {contacts.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No contacts yet. Add one above.</p>
          </div>
        ) : (
          contacts.map((contact) => (
            <div
              key={contact.id}
              className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
            >
              <div>
                <p className="font-medium text-gray-900">{contact.contact_email}</p>
                <p className="text-xs text-gray-500 font-mono mt-1">
                  {contact.pgp_public_key.slice(0, 50)}...
                </p>
              </div>
              <button
                onClick={() => handleRemoveContact(contact.id)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
