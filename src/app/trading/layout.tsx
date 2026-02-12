import HubTabs from '@/components/navigation/HubTabs';
import React from 'react';

const tradingTabs = [
  { label: 'TradeHub', href: '/trading/tradehub' },
  { label: 'Terminal', href: '/trading/terminal' },
  { label: 'Bot Control', href: '/trading/bot-control' },
  { label: 'Journal PT', href: '/trading/journal-pt' },
  { label: 'TraderMap', href: '/trading/tradermap' },
];

export default function TradingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="premium-frame">
      <h1 className="text-3xl font-serif text-gold mb-6">Trading Hub</h1>
      <HubTabs tabs={tradingTabs} basePath="/trading" />
      <div className="mt-8">{children}</div>
    </div>
  );
}
