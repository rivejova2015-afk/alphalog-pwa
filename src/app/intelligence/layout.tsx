import HubTabs from '@/components/navigation/HubTabs';
import React from 'react';

const intelligenceTabs = [
  { label: 'Capital Levels', href: '/intelligence/tabs/capital-levels' },
  { label: 'Constraint Solver', href: '/intelligence/tabs/constraint-solver' },
  { label: 'MindOps', href: '/intelligence/tabs/mindops' },
  { label: 'Knowledge Factory', href: '/intelligence/tabs/knowledge-factory' },
];

export default function IntelligenceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="premium-frame">
      <h1 className="text-3xl font-serif text-gold mb-6">Intelligence Suite</h1>
      <HubTabs tabs={intelligenceTabs} basePath="/intelligence" />
      <div className="mt-8">{children}</div>
    </div>
  );
}
