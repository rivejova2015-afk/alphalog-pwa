import HubTabs from '@/components/navigation/HubTabs';
import React from 'react';

const businessTabs = [
  { label: 'Treasury', href: '/business/treasury' },
  { label: 'Business', href: '/business/business' },
];

export default function BusinessLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="premium-frame">
      <h1 className="text-3xl font-serif text-gold mb-6">Business Hub</h1>
      <HubTabs tabs={businessTabs} basePath="/business" />
      <div className="mt-8">{children}</div>
    </div>
  );
}
