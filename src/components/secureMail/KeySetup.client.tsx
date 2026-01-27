'use client';

/**
 * Key Setup Component
 * Sprint 13: Generate or import PGP keys for secure email
 */

import { useState } from 'react';
import { Key, Download, Upload, AlertCircle, CheckCircle2 } from 'lucide-react';
import { generateKeypair, verifyPublicKey } from '@/lib/crypto/openpgp';
import { createClient } from '@/lib/supabase/browser';

export default function KeySetup() {
  const [step, setStep] = useState<'choice' | 'generate' | 'import'>('choice');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [passphraseConfirm, setPassphraseConfirm] = useState('');
  const [importPublicKey, setImportPublicKey] = useState('');
  const [importPrivateKey, setImportPrivateKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleGenerate = async () => {
    setError('');
    setSuccess('');

    if (!name.trim() || !email.trim()) {
      setError('Name and email are required');
      return;
    }

    if (passphrase.length < 12) {
      setError('Passphrase must be at least 12 characters');
      return;
    }

    if (passphrase !== passphraseConfirm) {
      setError('Passphrases do not match');
      return;
    }

    setLoading(true);
    try {
      const { publicKey, privateKey, kdf } = await generateKeypair(name, email, passphrase);

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const mailboxAlias = `${user.id.slice(0, 8)}@${process.env.NEXT_PUBLIC_SECURE_MAIL_DOMAIN || 'alphalog.local'}`;

      const { error: insertError } = await supabase
        .from('secure_mailboxes')
        .insert({
          user_id: user.id,
          email_alias: mailboxAlias,
          pgp_public_key: publicKey,
          pgp_private_key_encrypted: privateKey,
          key_kdf: kdf,
        });

      if (insertError) throw insertError;

      setSuccess('Keys generated successfully! Your mailbox is ready.');
      downloadKeys(publicKey, privateKey, mailboxAlias);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate keys');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    setError('');
    setSuccess('');

    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    if (!importPublicKey.trim() || !importPrivateKey.trim()) {
      setError('Both public and private keys are required');
      return;
    }

    if (passphrase.length < 12) {
      setError('Passphrase must be at least 12 characters');
      return;
    }

    setLoading(true);
    try {
      const isValidPublic = await verifyPublicKey(importPublicKey);
      if (!isValidPublic) throw new Error('Invalid public key format');

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const mailboxAlias = email;

      const { error: insertError } = await supabase
        .from('secure_mailboxes')
        .insert({
          user_id: user.id,
          email_alias: mailboxAlias,
          pgp_public_key: importPublicKey,
          pgp_private_key_encrypted: importPrivateKey,
          key_kdf: {
            algorithm: 'Imported',
            iterations: 0,
            hashAlgorithm: 'N/A',
          },
        });

      if (insertError) throw insertError;

      setSuccess('Keys imported successfully! Your mailbox is ready.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import keys');
    } finally {
      setLoading(false);
    }
  };

  const downloadKeys = (publicKey: string, privateKey: string, alias: string) => {
    const blob = new Blob([`Public Key:\n${publicKey}\n\nPrivate Key (KEEP SECRET):\n${privateKey}`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${alias}-pgp-keys.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="display-font text-2xl font-semibold text-slate-50 mb-2 flex items-center gap-2">
          <Key className="w-6 h-6" />
          PGP Key Setup
        </h2>
        <p className="text-sm text-slate-400">
          Generate new keys or import existing PGP keys for secure email encryption.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-600/10 border border-red-500/30 rounded-2xl flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-300 flex-shrink-0 mt-0.5" />
          <span className="text-sm text-red-200">{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-emerald-600/10 border border-emerald-500/30 rounded-2xl flex items-start gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-300 flex-shrink-0 mt-0.5" />
          <span className="text-sm text-emerald-200">{success}</span>
        </div>
      )}

      {step === 'choice' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => setStep('generate')}
            className="p-6 border border-slate-700/60 rounded-2xl bg-slate-900/70 hover:border-blue-600/40 transition-colors text-left"
          >
            <Download className="w-8 h-8 text-blue-300 mb-3" />
            <h3 className="font-semibold text-slate-100 mb-1">Generate New Keys</h3>
            <p className="text-sm text-slate-400">Create a new PGP key pair for secure email</p>
          </button>

          <button
            onClick={() => setStep('import')}
            className="p-6 border border-slate-700/60 rounded-2xl bg-slate-900/70 hover:border-emerald-500/40 transition-colors text-left"
          >
            <Upload className="w-8 h-8 text-emerald-300 mb-3" />
            <h3 className="font-semibold text-slate-100 mb-1">Import Existing Keys</h3>
            <p className="text-sm text-slate-400">Use your existing PGP keys</p>
          </button>
        </div>
      )}

      {step === 'generate' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-700/70 rounded-lg bg-slate-900/60 text-slate-100 focus:ring-2 focus:ring-blue-600/40 focus:border-transparent"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1">Email (will be used as mailbox alias)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-700/70 rounded-lg bg-slate-900/60 text-slate-100 focus:ring-2 focus:ring-blue-600/40 focus:border-transparent"
              placeholder="john@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1">Passphrase (min 12 chars)</label>
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              className="w-full px-3 py-2 border border-slate-700/70 rounded-lg bg-slate-900/60 text-slate-100 focus:ring-2 focus:ring-blue-600/40 focus:border-transparent"
              placeholder="••••••••••••"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1">Confirm Passphrase</label>
            <input
              type="password"
              value={passphraseConfirm}
              onChange={(e) => setPassphraseConfirm(e.target.value)}
              className="w-full px-3 py-2 border border-slate-700/70 rounded-lg bg-slate-900/60 text-slate-100 focus:ring-2 focus:ring-blue-600/40 focus:border-transparent"
              placeholder="••••••••••••"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setStep('choice')}
              className="px-4 py-2 border border-slate-700/60 rounded-lg hover:bg-slate-900/60 text-slate-200"
            >
              Back
            </button>
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-slate-950 rounded-full hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Generating...' : 'Generate Keys'}
            </button>
          </div>
        </div>
      )}

      {step === 'import' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1">Email Alias</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-700/70 rounded-lg bg-slate-900/60 text-slate-100 focus:ring-2 focus:ring-emerald-500/40 focus:border-transparent"
              placeholder="john@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1">Public Key (ASCII Armored)</label>
            <textarea
              value={importPublicKey}
              onChange={(e) => setImportPublicKey(e.target.value)}
              className="w-full px-3 py-2 border border-slate-700/70 rounded-lg bg-slate-900/60 text-slate-100 focus:ring-2 focus:ring-emerald-500/40 focus:border-transparent font-mono text-xs"
              rows={6}
              placeholder="-----BEGIN PGP PUBLIC KEY BLOCK-----"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1">Private Key (ASCII Armored)</label>
            <textarea
              value={importPrivateKey}
              onChange={(e) => setImportPrivateKey(e.target.value)}
              className="w-full px-3 py-2 border border-slate-700/70 rounded-lg bg-slate-900/60 text-slate-100 focus:ring-2 focus:ring-emerald-500/40 focus:border-transparent font-mono text-xs"
              rows={6}
              placeholder="-----BEGIN PGP PRIVATE KEY BLOCK-----"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1">Passphrase for Private Key</label>
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              className="w-full px-3 py-2 border border-slate-700/70 rounded-lg bg-slate-900/60 text-slate-100 focus:ring-2 focus:ring-emerald-500/40 focus:border-transparent"
              placeholder="••••••••••••"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setStep('choice')}
              className="px-4 py-2 border border-slate-700/60 rounded-lg hover:bg-slate-900/60 text-slate-200"
            >
              Back
            </button>
            <button
              onClick={handleImport}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-emerald-600 text-slate-950 rounded-full hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? 'Importing...' : 'Import Keys'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
