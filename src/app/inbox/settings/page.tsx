'use client';

/**
 * Inbox Settings Page
 * Sprint 13: Main settings page for secure email
 */

import { useState } from 'react';
import { Settings, Key, Shield, Users } from 'lucide-react';
import KeySetup from '@/components/secureMail/KeySetup.client';
import AllowedSenders from '@/components/secureMail/AllowedSenders.client';
import ContactsKeys from '@/components/secureMail/ContactsKeys.client';

export default function InboxSettingsPage() {
  const [activeTab, setActiveTab] = useState<'keys' | 'allowlist' | 'contacts'>('keys');

  const tabs = [
    { id: 'keys' as const, label: 'Key Setup', icon: Key },
    { id: 'allowlist' as const, label: 'Allowed Senders', icon: Shield },
    { id: 'contacts' as const, label: 'Contacts', icon: Users },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="max-w-7xl mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="display-font text-3xl font-semibold text-slate-50 mb-2 flex items-center gap-3">
            <Settings className="w-8 h-8 text-blue-300" />
            Secure Inbox Settings
          </h1>
          <p className="text-slate-400">
            Configure your end-to-end encrypted email system
          </p>
        </div>

        <div className="bg-slate-900/70 rounded-2xl shadow-[0_18px_40px_rgba(2,4,10,0.45)] border border-slate-700/60 overflow-hidden">
          <div className="flex border-b border-slate-700/60">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 px-6 py-4 font-medium text-sm transition-colors flex items-center justify-center gap-2 ${
                    activeTab === tab.id
                      ? 'text-blue-200 border-b-2 border-blue-600 bg-blue-600/10'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="p-6">
            {activeTab === 'keys' && <KeySetup />}
            {activeTab === 'allowlist' && <AllowedSenders />}
            {activeTab === 'contacts' && <ContactsKeys />}
          </div>
        </div>
      </div>
    </div>
  );
}
