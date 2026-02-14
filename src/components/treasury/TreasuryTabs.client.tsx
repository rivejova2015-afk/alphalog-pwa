'use client';

import React, { useState } from 'react';
import type { Account, TreasuryConfig, Trade } from '@/lib/treasury/calculations';
import type { TreasuryTransaction, TreasuryPayout, TreasuryBudget } from '@/lib/treasury/queries';
import MobileModuleTabSelect from '@/components/navigation/MobileModuleTabSelect.client';
import OverviewPanel from './panels/Overview.client';
import SplitsPanel from './panels/Splits.client';
import UmbralPanel from './panels/Umbral.client';
import AntiDDPanel from './panels/AntiDD.client';
import MilestonePanel from './panels/Milestone.client';
import CashflowPanel from './panels/Cashflow.client';
import CalendarioPanel from './panels/Calendario.client';
import HeatmapPanel from './panels/Heatmap.client';

interface TreasuryTabsProps {
  accounts: Account[];
  configs: TreasuryConfig[];
  trades: Trade[];
  transactions?: TreasuryTransaction[];
  payouts?: TreasuryPayout[];
  budgets?: TreasuryBudget[];
}

const tabs = [
  { id: 'overview', label: '📊 Overview' },
  { id: 'milestone', label: '🎯 Milestone' },
  { id: 'cashflow', label: '📈 Cashflow' },
  { id: 'calendario', label: '📅 Calendario' },
  { id: 'splits', label: '💰 Splits' },
  { id: 'umbral', label: '⚠️ Umbral' },
  { id: 'anti-dd', label: '🛡️ Anti-DD' },
  { id: 'heatmap', label: '🔥 Heatmap' },
];

export default function TreasuryTabs({ 
  accounts, 
  configs, 
  trades,
  transactions = [],
  payouts = [],
  budgets = []
}: TreasuryTabsProps) {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <MobileModuleTabSelect
        tabs={tabs.map((tab) => ({ id: tab.id, label: tab.label }))}
        activeTab={activeTab}
        onChange={setActiveTab}
        ariaLabel="Selector de pestaña de Treasury"
      />

      <div className="hidden md:flex gap-2 border-b border-slate-800 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 whitespace-nowrap text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-white border-b-2 border-blue-500'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-96">
        {activeTab === 'overview' && (
          <OverviewPanel accounts={accounts} configs={configs} />
        )}

        {activeTab === 'milestone' && (
          <MilestonePanel accounts={accounts} configs={configs} />
        )}

        {activeTab === 'cashflow' && (
          <CashflowPanel transactions={transactions} payouts={payouts} budgets={budgets} />
        )}

        {activeTab === 'calendario' && (
          <CalendarioPanel accounts={accounts} configs={configs} events={[]} />
        )}

        {activeTab === 'splits' && (
          <SplitsPanel accounts={accounts} configs={configs} />
        )}

        {activeTab === 'umbral' && (
          <UmbralPanel accounts={accounts} configs={configs} />
        )}

        {activeTab === 'anti-dd' && (
          <AntiDDPanel accounts={accounts} configs={configs} trades={trades} />
        )}

        {activeTab === 'heatmap' && (
          <HeatmapPanel accounts={accounts} configs={configs} trades={trades} />
        )}
      </div>
    </div>
  );
}
