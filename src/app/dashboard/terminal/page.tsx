// src/app/dashboard/terminal/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Radio, Calendar, BarChart3, Search, Zap } from "lucide-react";
import NewsPanel from "@/components/terminal/NewsPanel.client";
import CalendarPanel from "@/components/terminal/CalendarPanel.client";
import EvidenceReports from "@/components/terminal/EvidenceReports.client";
import { createClient } from "@/lib/supabase/browser";

type TerminalTabType = "news" | "calendar" | "evidence" | "search" | "overview";

interface TerminalTab {
  id: TerminalTabType;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const TABS: TerminalTab[] = [
  { id: "overview", label: "Overview", icon: <Zap className="w-4 h-4" />, description: "Market overview" },
  { id: "news", label: "News", icon: <Radio className="w-4 h-4" />, description: "Latest news & events" },
  { id: "calendar", label: "Calendar", icon: <Calendar className="w-4 h-4" />, description: "Economic calendar" },
  { id: "evidence", label: "Evidence", icon: <BarChart3 className="w-4 h-4" />, description: "AI-powered analysis" },
  { id: "search", label: "Search", icon: <Search className="w-4 h-4" />, description: "Market search" },
];

function TerminalOverview() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">Market Status</span>
            <span className="text-green-600">🟢</span>
          </div>
          <div className="text-2xl font-semibold text-slate-900">OPEN</div>
          <div className="text-xs text-slate-500 mt-1">Forex markets active</div>
        </div>

        <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">Volatility Index</span>
            <span className="text-orange-600">📊</span>
          </div>
          <div className="text-2xl font-semibold text-slate-900">24.5</div>
          <div className="text-xs text-slate-500 mt-1">Moderate</div>
        </div>

        <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">Economic Events</span>
            <span className="text-blue-600">📅</span>
          </div>
          <div className="text-2xl font-semibold text-slate-900">8</div>
          <div className="text-xs text-slate-500 mt-1">This week</div>
        </div>

        <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">Liquidity</span>
            <span className="text-green-600">💧</span>
          </div>
          <div className="text-2xl font-semibold text-slate-900">High</div>
          <div className="text-xs text-slate-500 mt-1">All pairs</div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Market Alerts</h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-white/90 rounded-xl border border-white/60">
            <span className="text-xl">⚠️</span>
            <div className="flex-1">
              <div className="font-medium text-slate-900">ECB Interest Rate Decision</div>
              <div className="text-sm text-slate-500">High impact on EUR pairs</div>
              <div className="text-xs text-slate-400 mt-1">1 hour</div>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-white/90 rounded-xl border border-white/60">
            <span className="text-xl">📈</span>
            <div className="flex-1">
              <div className="font-medium text-slate-900">US Non-Farm Payrolls</div>
              <div className="text-sm text-slate-500">Major market moving event</div>
              <div className="text-xs text-slate-400 mt-1">2 days</div>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-white/90 rounded-xl border border-white/60">
            <span className="text-xl">🔔</span>
            <div className="flex-1">
              <div className="font-medium text-slate-900">Bank of England Policy</div>
              <div className="text-sm text-slate-500">GBP volatility expected</div>
              <div className="text-xs text-slate-400 mt-1">3 days</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TerminalPage() {
  const [activeTab, setActiveTab] = useState<TerminalTabType>("overview");
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
        console.error("[Terminal] Error getting user:", err);
      }
    };
    getUser();
  }, []);

  const currentTab = TABS.find(t => t.id === activeTab);

  return (
    <div className="flex min-h-screen text-slate-700">
      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? "w-64" : "w-16"} bg-white/75 border-r border-white/60 shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur-xl transition-all duration-300 flex flex-col`}>
        {/* Header */}
        <div className="p-4 border-b border-white/70 flex items-center justify-between">
          {isSidebarOpen && <h2 className="font-semibold text-slate-900">Terminal</h2>}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-white/70 text-slate-500 rounded-lg transition"
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
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:bg-white"
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
        <div className="p-4 border-t border-white/70">
          {isSidebarOpen ? (
            <div className="text-xs text-slate-500">
              <div className="font-medium text-slate-700 mb-1">Market Terminal</div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Live Data</span>
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
        <header className="bg-white/70 border-b border-white/70 px-6 py-4 flex items-center justify-between backdrop-blur-xl shadow-sm">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-3xl">📡</span>
              <h1 className="text-2xl font-semibold text-slate-900">{currentTab?.label}</h1>
            </div>
            <p className="text-sm text-slate-500">{currentTab?.description}</p>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            {activeTab === "overview" && <TerminalOverview />}
            {activeTab === "news" && <NewsPanel />}
            {activeTab === "calendar" && <CalendarPanel />}
            {activeTab === "evidence" && <EvidenceReports />}
            {activeTab === "search" && (
              <div className="text-center py-12">
                <Search className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-slate-700 font-medium">Search Markets</h3>
                <p className="text-slate-500 text-sm">Coming soon</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
