'use client';

import React from 'react';
import Link from 'next/link';

/**
 * ModulesStatus Component
 * Displays all modules with their status (Active/Beta/Coming Soon)
 * Integrated with Sprint 8.2-8.3 Treasury features
 */

interface ModuleItem {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: string;
  status: 'active' | 'beta' | 'coming-soon';
  subItems?: Array<{
    label: string;
    href: string;
    description: string;
  }>;
}

const modules: ModuleItem[] = [
  {
    id: 'terminal',
    label: 'Terminal',
    description: 'Advanced trading terminal with real-time data',
    href: '/dashboard/terminal',
    icon: '💹',
    status: 'active',
  },
  {
    id: 'tradehub',
    label: 'TradeHub',
    description: 'Trade management and analysis',
    href: '/dashboard/tradehub',
    icon: '📊',
    status: 'active',
  },
  {
    id: 'journal',
    label: 'Journal',
    description: 'Trading journal with entries and analysis',
    href: '/dashboard/logs',
    icon: '📓',
    status: 'active',
  },
  {
    id: 'logs',
    label: 'Logs',
    description: 'Event logs with categories and tags',
    href: '/dashboard/logs',
    icon: '📝',
    status: 'active',
  },
  {
    id: 'tradermap',
    label: 'TraderMap',
    description: 'Trading performance maps and heatmaps',
    href: '/dashboard/tradermap',
    icon: '🗺️',
    status: 'active',
  },
  {
    id: 'treasury',
    label: 'Treasury',
    description: 'Portfolio treasury and wealth management',
    href: '/dashboard/treasury',
    icon: '💰',
    status: 'beta',
    subItems: [
      {
        label: 'Overview',
        href: '/dashboard/treasury?tab=overview',
        description: 'Account overview and summary',
      },
      {
        label: 'Cashflow',
        href: '/dashboard/treasury?tab=cashflow',
        description: 'Cash flow tracking and projections',
      },
      {
        label: 'Calendario',
        href: '/dashboard/treasury?tab=calendario',
        description: 'Monthly calendar with events',
      },
      {
        label: 'Export',
        href: '/dashboard/treasury?tab=cashflow',
        description: 'Export treasury data as CSV',
      },
    ],
  },
  {
    id: 'business',
    label: 'Business',
    description: 'Business metrics and KPIs',
    href: '/dashboard/business',
    icon: '💼',
    status: 'active',
  },
];

const statusConfig = {
  active: {
    badge: 'Activo',
    badgeColor: 'bg-green-600/15 text-green-200 border border-green-500/30',
    dotColor: 'bg-green-500',
  },
  beta: {
    badge: 'Beta',
    badgeColor: 'bg-blue-600/15 text-blue-200 border border-blue-500/30',
    dotColor: 'bg-blue-500',
  },
  'coming-soon': {
    badge: 'Próximamente',
    badgeColor: 'bg-slate-800/70 text-slate-300 border border-slate-600/40',
    dotColor: 'bg-gray-400',
  },
};

export default function ModulesStatus() {
  const activeModules = modules.filter((m) => m.status === 'active' || m.status === 'beta');
  const comingSoonModules = modules.filter((m) => m.status === 'coming-soon');

  return (
    <div className="space-y-12">
      {/* Active/Beta Modules Section */}
      <div>
        <h2 className="display-font text-2xl font-semibold text-slate-50 mb-6">Módulos Disponibles</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {activeModules.map((module) => {
            const config = statusConfig[module.status];
            const isLink = module.status !== 'coming-soon';

            return (
              <div key={module.id} className="h-full">
                {isLink ? (
                  <Link
                    href={module.href}
                    className="group relative h-full flex flex-col overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900/70 p-6 transition-all duration-200 hover:border-blue-600/40 hover:shadow-[0_18px_40px_rgba(2,4,10,0.45)]"
                  >
                    {/* Content */}
                    <div className="flex-1 flex flex-col">
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-3xl">{module.icon}</div>
                        <span
                          className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${config.badgeColor}`}
                        >
                          {config.badge}
                        </span>
                      </div>
                      <h3 className="mt-4 font-semibold text-slate-50 text-lg group-hover:text-blue-200">
                        {module.label}
                      </h3>
                      <p className="mt-2 text-sm text-slate-400">{module.description}</p>
                    </div>

                    {/* Gradient overlay */}
                    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent to-blue-600/10 transition-transform duration-300 group-hover:translate-x-0" />
                  </Link>
                ) : (
                  <div className="relative h-full flex flex-col overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/40 p-6 opacity-70">
                    <div className="flex-1 flex flex-col">
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-3xl opacity-50">{module.icon}</div>
                        <span
                          className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${config.badgeColor}`}
                        >
                          {config.badge}
                        </span>
                      </div>
                      <h3 className="mt-4 font-semibold text-slate-300 text-lg">{module.label}</h3>
                      <p className="mt-2 text-sm text-slate-500">{module.description}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Treasury Sub-Items (if Treasury is rendered) */}
        {activeModules.some((m) => m.id === 'treasury') && (
          <div className="mt-8 bg-slate-900/70 border border-slate-700/60 rounded-2xl p-6">
            <h3 className="font-semibold text-slate-100 mb-4">🎯 Atajos de Treasury</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {modules
                .find((m) => m.id === 'treasury')
                ?.subItems?.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group flex items-start gap-3 rounded-xl bg-slate-900/70 p-3 border border-slate-700/60 hover:bg-slate-800/70 transition-colors"
                  >
                    <div className="mt-0.5 text-sm text-blue-200">→</div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-100 group-hover:text-blue-200">
                        {item.label}
                      </p>
                      <p className="text-xs text-slate-400">{item.description}</p>
                    </div>
                  </Link>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Coming Soon Section */}
      {comingSoonModules.length > 0 && (
        <div>
          <h2 className="display-font text-2xl font-semibold text-slate-50 mb-6">Próximamente</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {comingSoonModules.map((module) => {
              const config = statusConfig[module.status];
              return (
                <div
                  key={module.id}
                  className="relative flex flex-col overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/40 p-6 opacity-60"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-3xl opacity-50">{module.icon}</div>
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${config.badgeColor}`}
                    >
                      {config.badge}
                    </span>
                  </div>
                  <h3 className="mt-4 font-semibold text-slate-300 text-lg">{module.label}</h3>
                  <p className="mt-2 text-sm text-slate-500">{module.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
