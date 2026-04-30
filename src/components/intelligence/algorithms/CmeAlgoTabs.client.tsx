'use client';

import { useState } from 'react';
import CmePropFirmWorkspace from './CmePropFirmWorkspace.client';
import CmeRealBrokerWorkspace from './CmeRealBrokerWorkspace.client';

const TABS = [
  { id: 'propfirm', label: 'CME PropFirm' },
  { id: 'broker', label: 'CME Real Broker' },
] as const;

type TabId = typeof TABS[number]['id'];

export default function CmeAlgoTabs() {
  const [active, setActive] = useState<TabId>('propfirm');

  return (
    <div>
      <div className="flex items-center gap-1 mb-4 border-b border-white/10 pb-3">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              active === tab.id
                ? 'bg-white/10 text-white'
                : 'text-white/40 hover:text-white/70 hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {active === 'propfirm' ? <CmePropFirmWorkspace /> : <CmeRealBrokerWorkspace />}
    </div>
  );
}
