import HubTabs from '@/components/navigation/HubTabs';
import React from 'react';

const tradingTabs = [
  { label: 'TradeHub', href: '/trading/tabs/tradehub' },
  { label: 'Terminal', href: '/trading/tabs/terminal' },
  { label: 'Bot Control', href: '/trading/tabs/bot-control' },
  { label: 'Journal PT', href: '/trading/tabs/journal-pt' },
  { label: 'TraderMap', href: '/trading/tabs/tradermap' },
];

export default function TradingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="premium-frame">
      <h1 className="text-3xl font-semibold text-cyan-400 mb-6">Trading Hub</h1>
      <HubTabs tabs={tradingTabs} basePath="/trading" />
      <div className="mt-8">{children}</div>
    </div>
  );
}
