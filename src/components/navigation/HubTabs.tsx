import React from 'react';
import { usePathname } from 'next/navigation';

interface Tab {
  label: string;
  href: string;
}

interface HubTabsProps {
  tabs: Tab[];
  basePath: string;
  variant?: 'premium' | 'default';
}

export default function HubTabs({ tabs, basePath, variant }: HubTabsProps) {
  const pathname = usePathname();

  return (
    <nav className={`hub-tabs ${variant === 'premium' ? 'hub-tabs-premium' : ''} flex overflow-x-auto border-b border-gold`}> 
      {tabs.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <a
            key={tab.href}
            href={tab.href}
            className={`px-6 py-3 font-semibold text-lg whitespace-nowrap transition-all ${active ? 'text-gold border-b-2 border-gold bg-black/60' : 'text-slate-300 hover:text-gold'}`}
            style={{ minWidth: 120 }}
          >
            {tab.label}
          </a>
        );
      })}
    </nav>
  );
}
