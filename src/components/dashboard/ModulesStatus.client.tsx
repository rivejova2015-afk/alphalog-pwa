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
    badgeColor: 'bg-green-100 text-green-800',
    dotColor: 'bg-green-500',
  },
  beta: {
    badge: 'Beta',
    badgeColor: 'bg-blue-100 text-blue-800',
    dotColor: 'bg-blue-500',
  },
  'coming-soon': {
    badge: 'Próximamente',
    badgeColor: 'bg-gray-100 text-gray-800',
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
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Módulos Disponibles</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {activeModules.map((module) => {
            const config = statusConfig[module.status];
            const isLink = module.status !== 'coming-soon';

            return (
              <div key={module.id} className="h-full">
                {isLink ? (
                  <Link
                    href={module.href}
                    className="group relative h-full flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white p-6 transition-all duration-200 hover:border-blue-300 hover:shadow-lg"
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
                      <h3 className="mt-4 font-bold text-gray-900 text-lg group-hover:text-blue-600">
                        {module.label}
                      </h3>
                      <p className="mt-2 text-sm text-gray-600">{module.description}</p>
                    </div>

                    {/* Gradient overlay */}
                    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent to-blue-50 transition-transform duration-300 group-hover:translate-x-0" />
                  </Link>
                ) : (
                  <div className="relative h-full flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-gray-50 p-6 opacity-75">
                    <div className="flex-1 flex flex-col">
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-3xl opacity-50">{module.icon}</div>
                        <span
                          className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${config.badgeColor}`}
                        >
                          {config.badge}
                        </span>
                      </div>
                      <h3 className="mt-4 font-bold text-gray-600 text-lg">{module.label}</h3>
                      <p className="mt-2 text-sm text-gray-500">{module.description}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Treasury Sub-Items (if Treasury is rendered) */}
        {activeModules.some((m) => m.id === 'treasury') && (
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="font-semibold text-blue-900 mb-4">🎯 Atajos de Treasury</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {modules
                .find((m) => m.id === 'treasury')
                ?.subItems?.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group flex items-start gap-3 rounded-md bg-white p-3 border border-blue-100 hover:bg-blue-100 transition-colors"
                  >
                    <div className="mt-0.5 text-sm text-blue-600">→</div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 group-hover:text-blue-600">
                        {item.label}
                      </p>
                      <p className="text-xs text-gray-500">{item.description}</p>
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
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Próximamente</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {comingSoonModules.map((module) => {
              const config = statusConfig[module.status];
              return (
                <div
                  key={module.id}
                  className="relative flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-gray-50 p-6 opacity-60"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-3xl opacity-50">{module.icon}</div>
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${config.badgeColor}`}
                    >
                      {config.badge}
                    </span>
                  </div>
                  <h3 className="mt-4 font-bold text-gray-600 text-lg">{module.label}</h3>
                  <p className="mt-2 text-sm text-gray-500">{module.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
