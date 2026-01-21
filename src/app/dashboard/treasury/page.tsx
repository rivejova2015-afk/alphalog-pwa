// src/app/dashboard/treasury/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { Wallet, TrendingUp, DollarSign, Target, Calendar, AlertCircle, Grid, Zap } from 'lucide-react';
import TreasuryTabs from '@/components/treasury/TreasuryTabs.client';
import { createClient } from '@/lib/supabase/browser';

type TreasuryTabType = 'overview' | 'milestone' | 'cashflow' | 'calendario' | 'splits' | 'umbral' | 'anti-dd' | 'heatmap';

interface TreasuryTab {
  id: TreasuryTabType;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const TABS: TreasuryTab[] = [
  { id: 'overview', label: 'Overview', icon: <Zap className="w-4 h-4" />, description: 'Treasury overview & key metrics' },
  { id: 'milestone', label: 'Milestone', icon: <Target className="w-4 h-4" />, description: 'Financial milestones' },
  { id: 'cashflow', label: 'Cashflow', icon: <TrendingUp className="w-4 h-4" />, description: 'Cash flow analysis' },
  { id: 'calendario', label: 'Calendario', icon: <Calendar className="w-4 h-4" />, description: 'Financial calendar' },
  { id: 'splits', label: 'Splits', icon: <DollarSign className="w-4 h-4" />, description: 'Account splits' },
  { id: 'umbral', label: 'Umbral', icon: <AlertCircle className="w-4 h-4" />, description: 'Threshold alerts' },
  { id: 'anti-dd', label: 'Anti-DD', icon: <Grid className="w-4 h-4" />, description: 'Drawdown protection' },
  { id: 'heatmap', label: 'Heatmap', icon: <TrendingUp className="w-4 h-4" />, description: 'Heat map analysis' },
];

export default function TreasuryPage() {
  const [activeTab, setActiveTab] = useState<TreasuryTabType>('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const getUser = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);
        }
      } catch (err) {
        console.error("[Treasury] Error getting user:", err);
      } finally {
        setIsLoading(false);
      }
    };
    getUser();
  }, []);

  const currentTab = TABS.find(t => t.id === activeTab);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950">
        <div className="text-center">
          <div className="text-4xl mb-4">💰</div>
          <p className="text-slate-300">Loading Treasury Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950">
      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? "w-64" : "w-16"} bg-slate-900 border-r border-slate-800 transition-all duration-300 flex flex-col`}>
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          {isSidebarOpen && <h2 className="font-bold text-white">Treasury</h2>}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-slate-800 rounded-lg transition"
          >
            {isSidebarOpen ? "◀" : "▶"}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-2">
          <div className="space-y-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition ${
                  activeTab === tab.id
                    ? "bg-green-600 text-white"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
                title={isSidebarOpen ? undefined : tab.label}
              >
                <span className="text-lg">{tab.icon}</span>
                {isSidebarOpen && <span className="flex-1 text-left text-sm">{tab.label}</span>}
              </button>
            ))}
          </div>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800">
          {isSidebarOpen ? (
            <div className="text-xs text-slate-400">
              <div className="font-medium text-slate-300 mb-1">Treasury Hub</div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Financial Monitoring</span>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto flex flex-col">
        {/* Header */}
        <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-3xl">💰</span>
              <h1 className="text-2xl font-bold text-white">{currentTab?.label}</h1>
            </div>
            <p className="text-sm text-slate-400">{currentTab?.description}</p>
          </div>
          <div className="flex items-center gap-3 px-4 py-2 bg-slate-800 rounded-lg">
            <Wallet className="w-4 h-4 text-green-400" />
            <span className="text-sm text-slate-300">Treasury Operations</span>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            <TreasuryTabs
              accounts={[]}
              configs={[]}
              trades={[]}
              transactions={[]}
              payouts={[]}
              budgets={[]}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
