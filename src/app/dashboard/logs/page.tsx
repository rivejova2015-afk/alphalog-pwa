// src/app/dashboard/logs/page.tsx
"use client";

import { useState, useEffect } from "react";
import { BookOpen, Search, Filter, Zap, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { JournalEntryList } from "@/components/journal/JournalEntryList.client";
import { JournalEntryForm } from "@/components/journal/JournalEntryForm.client";
import BackToDashboardButton from "@/components/BackToDashboardButton.client";

type JournalTabType = "all" | "recent" | "search" | "tags" | "new";

interface JournalTab {
  id: JournalTabType;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const TABS: JournalTab[] = [
  { id: "all", label: "All Entries", icon: <Zap className="w-4 h-4" />, description: "View all journal entries" },
  { id: "recent", label: "Recent", icon: <BookOpen className="w-4 h-4" />, description: "Latest entries" },
  { id: "new", label: "New Entry", icon: <Plus className="w-4 h-4" />, description: "Create new entry" },
  { id: "search", label: "Search", icon: <Search className="w-4 h-4" />, description: "Find entries" },
  { id: "tags", label: "Tags", icon: <Filter className="w-4 h-4" />, description: "Browse by tags" },
];

function JournalOverview() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">Total Entries</span>
            <span className="text-blue-600">📝</span>
          </div>
          <div className="text-2xl font-semibold text-slate-900">156</div>
          <div className="text-xs text-slate-500 mt-1">All time</div>
        </div>

        <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">This Month</span>
            <span className="text-green-600">📊</span>
          </div>
          <div className="text-2xl font-semibold text-slate-900">24</div>
          <div className="text-xs text-slate-500 mt-1">January 2026</div>
        </div>

        <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">Avg. Mood</span>
            <span className="text-purple-600">😊</span>
          </div>
          <div className="text-2xl font-semibold text-slate-900">Good</div>
          <div className="text-xs text-slate-500 mt-1">7.2/10</div>
        </div>

        <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">Top Tag</span>
            <span className="text-rose-600">🏷️</span>
          </div>
          <div className="text-2xl font-semibold text-slate-900">Trading</div>
          <div className="text-xs text-slate-500 mt-1">45 entries</div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Recent Entries</h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-4 bg-white/90 rounded-xl border border-white/60 shadow-sm transition hover:bg-white cursor-pointer">
            <span className="text-2xl">😊</span>
            <div className="flex-1">
              <div className="font-medium text-slate-900">Great trading day</div>
              <div className="text-sm text-slate-500">4 winning trades, 3 losers. Stayed disciplined with risk management.</div>
              <div className="flex gap-2 mt-2">
                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full border border-blue-100">trading</span>
                <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full border border-emerald-100">discipline</span>
              </div>
              <div className="text-xs text-slate-400 mt-2">Today at 18:30</div>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 bg-white/90 rounded-xl border border-white/60 shadow-sm transition hover:bg-white cursor-pointer">
            <span className="text-2xl">😐</span>
            <div className="flex-1">
              <div className="font-medium text-slate-900">Mixed results</div>
              <div className="text-sm text-slate-500">Closed 2 winners early. Need to let profits run. Learned important lesson.</div>
              <div className="flex gap-2 mt-2">
                <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full border border-indigo-100">lessons_learned</span>
                <span className="text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded-full border border-amber-100">risk_management</span>
              </div>
              <div className="text-xs text-slate-400 mt-2">Yesterday at 17:15</div>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 bg-white/90 rounded-xl border border-white/60 shadow-sm transition hover:bg-white cursor-pointer">
            <span className="text-2xl">😟</span>
            <div className="flex-1">
              <div className="font-medium text-slate-900">Challenging session</div>
              <div className="text-sm text-slate-500">Overtraded after loss. Need to follow the rules. Reset for tomorrow.</div>
              <div className="flex gap-2 mt-2">
                <span className="text-xs bg-rose-50 text-rose-700 px-2 py-1 rounded-full border border-rose-100">emotional_control</span>
                <span className="text-xs bg-sky-50 text-sky-700 px-2 py-1 rounded-full border border-sky-100">trading_rules</span>
              </div>
              <div className="text-xs text-slate-400 mt-2">2 days ago at 19:00</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function JournalPage() {
  const [activeTab, setActiveTab] = useState<JournalTabType>("all");
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
        console.error("[Journal] Error getting user:", err);
      } finally {
        setIsLoading(false);
      }
    };
    getUser();
  }, []);

  const currentTab = TABS.find(t => t.id === activeTab);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50/70">
        <div className="text-center">
          <div className="text-4xl mb-4">📝</div>
          <p className="text-slate-500">Loading Journal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen text-slate-700">
      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? "w-64" : "w-16"} bg-white/75 border-r border-white/60 shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur-xl transition-all duration-300 flex flex-col`}>
        {/* Header */}
        <div className="p-4 border-b border-white/70 flex items-center justify-between">
          {isSidebarOpen && <h2 className="font-semibold text-slate-900">Journal</h2>}
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
              <div className="font-medium text-slate-700 mb-1">Personal Journal</div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-rose-500 rounded-full"></div>
                <span>Reflection & Growth</span>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="w-2 h-2 bg-rose-500 rounded-full"></div>
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
              <span className="text-3xl">📝</span>
              <h1 className="text-2xl font-semibold text-slate-900">{currentTab?.label}</h1>
            </div>
            <p className="text-sm text-slate-500">{currentTab?.description}</p>
          </div>
          <BackToDashboardButton />
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            {activeTab === "all" && userId && <JournalEntryList userId={userId} />}
            {activeTab === "recent" && <JournalOverview />}
            {activeTab === "new" && userId && (
              <JournalEntryForm
                userId={userId}
                onSuccess={() => setActiveTab("all")}
                onCancel={() => setActiveTab("all")}
              />
            )}
            {activeTab === "search" && (
              <div className="text-center py-12">
                <Search className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-slate-700 font-medium">Search Journal Entries</h3>
                <p className="text-slate-500 text-sm">Find entries by keywords or dates</p>
              </div>
            )}
            {activeTab === "tags" && (
              <div className="text-center py-12">
                <Filter className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-slate-700 font-medium">Browse by Tags</h3>
                <p className="text-slate-500 text-sm">Organize entries by categories</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
