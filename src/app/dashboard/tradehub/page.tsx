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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">Active Accounts</span>
            <span className="text-green-400">📊</span>
          </div>
          <div className="text-2xl font-bold text-white">3</div>
          <div className="text-xs text-slate-500 mt-1">Operational</div>
        </div>

        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">Win Rate</span>
            <span className="text-green-400">📈</span>
          </div>
          <div className="text-2xl font-bold text-white">68%</div>
          <div className="text-xs text-slate-500 mt-1">This month</div>
        </div>

        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">Total P&L</span>
            <span className="text-blue-400">💰</span>
          </div>
          <div className="text-2xl font-bold text-green-400">+$12,450</div>
          <div className="text-xs text-slate-500 mt-1">YTD</div>
        </div>

        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">Trades Today</span>
            <span className="text-purple-400">🎯</span>
          </div>
          <div className="text-2xl font-bold text-white">5</div>
          <div className="text-xs text-slate-500 mt-1">Active</div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Recent Activity</h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-slate-900 rounded-lg">
            <span className="text-xl">📈</span>
            <div className="flex-1">
              <div className="font-medium text-white">Trade Executed</div>
              <div className="text-sm text-slate-400">EUR/USD Long - 1.0850</div>
              <div className="text-xs text-slate-500 mt-1">15 minutes ago</div>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-slate-900 rounded-lg">
            <span className="text-xl">✅</span>
            <div className="flex-1">
              <div className="font-medium text-white">Trade Closed</div>
              <div className="text-sm text-slate-400">GBP/USD Short - +120 pips</div>
              <div className="text-xs text-slate-500 mt-1">1 hour ago</div>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-slate-900 rounded-lg">
            <span className="text-xl">📊</span>
            <div className="flex-1">
              <div className="font-medium text-white">Report Generated</div>
              <div className="text-sm text-slate-400">Weekly performance analysis</div>
              <div className="text-xs text-slate-500 mt-1">2 days ago</div>
            </div>
          </div>
        </div>
      </div>
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
    <div className="flex h-screen bg-slate-950">
      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? "w-64" : "w-16"} bg-slate-900 border-r border-slate-800 transition-all duration-300 flex flex-col`}>
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          {isSidebarOpen && <h2 className="font-bold text-white">TradeHub</h2>}
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
                    ? "bg-blue-600 text-white"
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
              <div className="font-medium text-slate-300 mb-1">Trader Mode</div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Live Trading</span>
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
              <span className="text-3xl">📊</span>
              <h1 className="text-2xl font-bold text-white">{currentTab?.label}</h1>
            </div>
            <p className="text-sm text-slate-400">{currentTab?.description}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-64">
              <PushNotificationButton />
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
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
