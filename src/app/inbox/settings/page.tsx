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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <Settings className="w-8 h-8 text-blue-600" />
            Secure Inbox Settings
          </h1>
          <p className="text-gray-600">
            Configure your end-to-end encrypted email system
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex border-b border-gray-200">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 px-6 py-4 font-medium text-sm transition-colors flex items-center justify-center gap-2 ${
                    activeTab === tab.id
                      ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
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
