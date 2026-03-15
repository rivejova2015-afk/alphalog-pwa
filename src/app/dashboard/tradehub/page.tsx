// src/app/dashboard/tradehub/page.tsx
"use client";

import { useState, useEffect } from "react";
import { BarChart3, TrendingUp, Shield, BookOpen, Zap } from "lucide-react";
import AccountsPanel from "@/components/tradehub/AccountsPanel.client";
import NewTradesLog from "@/components/tradehub/NewTradesLog.client";
import EvidenceVault from "@/components/tradehub/EvidenceVault.client";
import Playbook from "@/components/tradehub/Playbook.client";
import Reports from "@/components/tradehub/Reports.client";
import { PushNotificationButton } from "@/components/push/PushNotificationButton.client";
import BackToDashboardButton from "@/components/BackToDashboardButton.client";
import MobileModuleTabSelect from "@/components/navigation/MobileModuleTabSelect.client";
import TradeHubOverviewWidget from "@/components/tradehub/TradeHubOverviewWidget.client";
import AccountComparisonTable from "@/components/tradehub/AccountComparisonTable.client";
import { createClient } from "@/lib/supabase/browser";

type TabType = "accounts" | "trades" | "evidence" | "playbook" | "reports" | "overview";

interface TabConfig {
  id: TabType;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const TABS: TabConfig[] = [
  { id: "overview", label: "Overview", icon: <Zap className="w-4 h-4" />, description: "Quick stats & summary" },
  { id: "accounts", label: "Accounts", icon: <BarChart3 className="w-4 h-4" />, description: "Trading accounts" },
  { id: "trades", label: "Trades", icon: <TrendingUp className="w-4 h-4" />, description: "New trades log" },
  { id: "evidence", label: "Evidence", icon: <Shield className="w-4 h-4" />, description: "Evidence vault" },
  { id: "playbook", label: "Playbook", icon: <BookOpen className="w-4 h-4" />, description: "Trading playbook" },
  { id: "reports", label: "Reports", icon: <BarChart3 className="w-4 h-4" />, description: "Performance reports" },
];

function TradeHubOverview() {
  return (
    <div className="space-y-6">
      <TradeHubOverviewWidget />
      <AccountComparisonTable />
    </div>
  );
}

export default function TradeHubPage() {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const getUser = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);
        }
      } catch (err) {
        console.error("[TradeHub] Error getting user:", err);
      }
    };
    getUser();
  }, []);

  const currentTab = TABS.find(t => t.id === activeTab);

  return (
    <div className="min-h-screen text-slate-200 md:flex">
      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? "w-64" : "w-16"} hidden bg-slate-900/80 border-r border-slate-800/80 shadow-[0_18px_40px_rgba(2,4,10,0.6)] backdrop-blur-xl transition-all duration-300 md:flex md:flex-col`}>
        {/* Header */}
        <div className="p-4 border-b border-slate-700/60 flex items-center justify-between">
          {isSidebarOpen && <h2 className="display-font font-semibold text-slate-100">TradeHub</h2>}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-slate-800/70 text-slate-400 rounded-lg transition"
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

        {/* Footer */}
        <div className="p-4 border-t border-slate-700/60">
          {isSidebarOpen ? (
            <div className="text-xs text-slate-400">
              <div className="font-medium text-slate-200 mb-1">Trader Mode</div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                <span>Live Trading</span>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {/* Header */}
        <header className="bg-slate-900/80 border-b border-slate-700/60 px-4 py-4 sm:px-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between backdrop-blur-xl shadow-[0_12px_30px_rgba(2,4,10,0.45)]">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-3xl">📊</span>
              <h1 className="display-font text-2xl font-semibold text-slate-50">{currentTab?.label}</h1>
            </div>
            <p className="text-sm text-slate-400">{currentTab?.description}</p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <BackToDashboardButton />
            <div className="w-full sm:w-64">
              <PushNotificationButton />
            </div>
          </div>
        </header>

        <div className="sticky top-0 z-20 border-b border-slate-700/60 bg-slate-900/90 px-4 py-3 md:hidden">
          <MobileModuleTabSelect
            tabs={TABS.map((tab) => ({ id: tab.id, label: tab.label }))}
            activeTab={activeTab}
            onChange={(id) => setActiveTab(id as TabType)}
            ariaLabel="Selector de modulo TradeHub"
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {activeTab === "overview" && <TradeHubOverview />}
          {activeTab === "accounts" && <AccountsPanel />}
          {activeTab === "trades" && <NewTradesLog />}
          {activeTab === "evidence" && <EvidenceVault />}
          {activeTab === "playbook" && <Playbook />}
          {activeTab === "reports" && <Reports />}
        </div>
      </main>
    </div>
  );
}
