"use client";

import React, { useState } from "react";
import { Wallet, TrendingUp, DollarSign, Target, Calendar, AlertCircle, Grid, Zap } from "lucide-react";
import TreasuryTabs from "@/components/treasury/TreasuryTabs.client";
import BackToDashboardButton from "@/components/BackToDashboardButton.client";
import MobileModuleTabSelect from "@/components/navigation/MobileModuleTabSelect.client";
import type { Account, TreasuryConfig, Trade } from "@/lib/treasury/calculations";
import type {
  TreasuryTransaction,
  TreasuryPayout,
  TreasuryBudget,
  TreasuryWallet,
} from "@/lib/treasury/queries";

type TreasuryTabType = "overview" | "milestone" | "cashflow" | "calendario" | "splits" | "umbral" | "anti-dd" | "heatmap";

interface TreasuryTab {
  id: TreasuryTabType;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const TABS: TreasuryTab[] = [
  { id: "overview", label: "Overview", icon: <Zap className="w-4 h-4" />, description: "Treasury overview & key metrics" },
  { id: "milestone", label: "Milestone", icon: <Target className="w-4 h-4" />, description: "Financial milestones" },
  { id: "cashflow", label: "Cashflow", icon: <TrendingUp className="w-4 h-4" />, description: "Cash flow analysis" },
  { id: "calendario", label: "Calendario", icon: <Calendar className="w-4 h-4" />, description: "Financial calendar" },
  { id: "splits", label: "Splits", icon: <DollarSign className="w-4 h-4" />, description: "Account splits" },
  { id: "umbral", label: "Umbral", icon: <AlertCircle className="w-4 h-4" />, description: "Threshold alerts" },
  { id: "anti-dd", label: "Anti-DD", icon: <Grid className="w-4 h-4" />, description: "Drawdown protection" },
  { id: "heatmap", label: "Heatmap", icon: <TrendingUp className="w-4 h-4" />, description: "Heat map analysis" },
];

interface TreasuryShellProps {
  accounts: Account[];
  configs: TreasuryConfig[];
  wallets: TreasuryWallet[];
  trades: Trade[];
  transactions: TreasuryTransaction[];
  payouts: TreasuryPayout[];
  budgets: TreasuryBudget[];
}

// TreasuryShell hydrates the Treasury page client-side with data pre-fetched
// on the server. Replaces the prior client-only `page.tsx` which passed empty
// arrays. The sidebar+header UI here is identical to the prior layout so the
// visual experience is preserved.
export default function TreasuryShell({
  accounts,
  configs,
  wallets,
  trades,
  transactions,
  payouts,
  budgets,
}: TreasuryShellProps) {
  const [activeTab, setActiveTab] = useState<TreasuryTabType>("overview");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const currentTab = TABS.find((t) => t.id === activeTab);

  return (
    <div className="min-h-screen text-slate-200 md:flex">
      {/* Sidebar */}
      <aside
        className={`${isSidebarOpen ? "w-64" : "w-16"} hidden bg-slate-900/80 border-r border-slate-800/80 shadow-[0_18px_40px_rgba(2,4,10,0.6)] backdrop-blur-xl transition-all duration-300 md:flex md:flex-col`}
      >
        <div className="p-4 border-b border-slate-700/60 flex items-center justify-between">
          {isSidebarOpen && <h2 className="display-font font-semibold text-slate-100">Treasury</h2>}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-slate-800/70 text-slate-400 rounded-lg transition"
            aria-label={isSidebarOpen ? "Colapsar sidebar" : "Expandir sidebar"}
          >
            {isSidebarOpen ? "◀" : "▶"}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          <div className="space-y-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition ${
                  activeTab === tab.id
                    ? "bg-slate-800 text-slate-50 shadow-[0_12px_24px_rgba(2,4,10,0.45)]"
                    : "text-slate-300 hover:bg-slate-800/70"
                }`}
                title={isSidebarOpen ? undefined : tab.label}
              >
                <span className="text-lg">{tab.icon}</span>
                {isSidebarOpen && <span className="flex-1 text-left text-sm">{tab.label}</span>}
              </button>
            ))}
          </div>
        </nav>

        <div className="p-4 border-t border-slate-700/60">
          {isSidebarOpen ? (
            <div className="text-xs text-slate-400">
              <div className="font-medium text-slate-200 mb-1">Treasury Hub</div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                <span>{wallets.length} wallet{wallets.length === 1 ? "" : "s"} · {accounts.length} account{accounts.length === 1 ? "" : "s"}</span>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
            </div>
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <header className="bg-slate-900/80 border-b border-slate-700/60 px-4 py-4 sm:px-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between backdrop-blur-xl shadow-[0_12px_30px_rgba(2,4,10,0.45)]">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-3xl">💰</span>
              <h1 className="display-font text-2xl font-semibold text-slate-50">{currentTab?.label}</h1>
            </div>
            <p className="text-sm text-slate-400">{currentTab?.description}</p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <BackToDashboardButton />
            <div className="flex w-full items-center gap-3 px-4 py-2 bg-slate-900/70 border border-slate-700/60 rounded-xl text-slate-200 shadow-sm sm:w-auto">
              <Wallet className="w-4 h-4 text-emerald-300" />
              <span className="text-sm">Treasury Operations</span>
            </div>
          </div>
        </header>

        <div className="sticky top-0 z-20 border-b border-slate-700/60 bg-slate-900/90 px-4 py-3 md:hidden">
          <MobileModuleTabSelect
            tabs={TABS.map((tab) => ({ id: tab.id, label: tab.label }))}
            activeTab={activeTab}
            onChange={(id) => setActiveTab(id as TreasuryTabType)}
            ariaLabel="Selector de modulo Treasury"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-7xl mx-auto">
            <TreasuryTabs
              accounts={accounts}
              configs={configs}
              trades={trades}
              transactions={transactions}
              payouts={payouts}
              budgets={budgets}
              wallets={wallets}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
