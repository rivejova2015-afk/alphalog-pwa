'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface SidebarItem {
  label: string;
  href: string;
}

interface SidebarSection {
  name: string;
  items: SidebarItem[];
}

const SECTIONS: SidebarSection[] = [
  {
    name: 'Intelligence Suite',
    items: [
      { label: 'Agents Dashboard', href: '/intelligence/agents' },
      { label: 'Algorithmic Trading', href: '/intelligence/algorithms' },
      { label: 'Copy Groups', href: '/dashboard/copy-groups' },
      { label: 'Capital Levels', href: '/intelligence/tabs/capital-levels' },
      { label: 'Constraint Monitor', href: '/intelligence/tabs/constraint-monitor' },
      { label: 'MindOps', href: '/intelligence/tabs/mindops' },
      { label: 'Knowledge Factory', href: '/intelligence/tabs/knowledge-factory' },
    ],
  },
  {
    name: 'Business',
    items: [
      { label: 'Operations', href: '/business/operations' },
      { label: 'Decisions', href: '/business/decisions' },
      { label: 'Journal', href: '/business/journal' },
      { label: 'KPIs', href: '/business/kpis' },
      { label: 'SOPs', href: '/business/sops' },
    ],
  },
  {
    name: 'Map Hot',
    items: [
      { label: 'Goals', href: '/map-hot/goals' },
      { label: 'Progress', href: '/map-hot/progress' },
      { label: 'Future', href: '/map-hot/planning' },
    ],
  },
  {
    name: 'AlphaLog Securities',
    items: [
      { label: 'CyberSec Academy', href: '/securities/cybersec' },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    'Intelligence Suite': true,
    Business: false,
    'Map Hot': true,
    'AlphaLog Securities': false,
  });

  return (
    <aside className="fixed right-0 top-16 bottom-0 w-72 bg-[#0a0e1a] border-l border-[#1f2937] overflow-y-auto z-30 hidden lg:block">
      <div className="p-4 space-y-6">
        {SECTIONS.map((section) => (
          <div key={section.name}>
            <button
              onClick={() =>
                setExpanded((prev) => ({
                  ...prev,
                  [section.name]: !prev[section.name],
                }))
              }
              className="w-full flex items-center justify-between px-3 py-2 rounded hover:bg-[#151b28] transition-colors"
              aria-expanded={expanded[section.name]}
            >
              <span className="text-xs font-bold text-[#94a3b8] uppercase tracking-wider">
                {section.name}
              </span>
              <ChevronDown
                size={14}
                className={`text-[#475569] transition-transform duration-150 ${
                  expanded[section.name] ? 'rotate-180' : ''
                }`}
              />
            </button>

            {expanded[section.name] && (
              <div className="mt-2 space-y-1">
                {section.items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                  return (
                    <Link
                      key={`${item.label}-${item.href}`}
                      href={item.href}
                      className={`block px-4 py-2 text-sm rounded transition-colors ${
                        isActive
                          ? 'bg-[#22d3ee]/10 text-[#22d3ee] border-l-2 border-[#22d3ee]'
                          : 'text-[#94a3b8] hover:bg-[#151b28] hover:text-[#e2e8f0]'
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}
