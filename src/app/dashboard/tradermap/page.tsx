// src/app/dashboard/tradermap/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Zap, Target, TrendingUp, Award, Calendar } from "lucide-react";
import GoalsPanel from "@/components/tradermap/GoalsPanel.client";
import ProgressCard from "@/components/tradermap/ProgressCard.client";
import BackToDashboardButton from "@/components/BackToDashboardButton.client";
import { createClient } from "@/lib/supabase/browser";
import { subscribeTradeUpdates } from "@/lib/metrics/tradeUpdates";

type TraderMapTabType = "overview" | "goals" | "progress" | "achievements" | "calendar";

interface TraderMapTab {
  id: TraderMapTabType;
  label: string;
  icon: React.ReactNode;
  description: string;
}

interface UserLevelState {
  user_id: string;
  level: number;
  xp_total: number;
  streak_days: number;
  last_activity_date: string | null;
  updated_at: string;
}

const TABS: TraderMapTab[] = [
  { id: "overview", label: "Overview", icon: <Zap className="w-4 h-4" />, description: "Your trader profile" },
  { id: "goals", label: "Goals", icon: <Target className="w-4 h-4" />, description: "Trading goals" },
  { id: "progress", label: "Progress", icon: <TrendingUp className="w-4 h-4" />, description: "Performance tracking" },
  { id: "achievements", label: "Achievements", icon: <Award className="w-4 h-4" />, description: "Badges & milestones" },
  { id: "calendar", label: "Calendar", icon: <Calendar className="w-4 h-4" />, description: "Activity calendar" },
];

function TraderMapOverview() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-3xl border border-slate-700/70 bg-slate-900/70 p-4 shadow-[0_16px_40px_rgba(2,4,10,0.45)] backdrop-blur">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">Current Level</span>
            <span className="text-amber-300">🏆</span>
          </div>
          <div className="text-2xl font-semibold text-slate-100">12</div>
          <div className="text-xs text-slate-400 mt-1">Expert Trader</div>
        </div>

        <div className="rounded-3xl border border-slate-700/70 bg-slate-900/70 p-4 shadow-[0_16px_40px_rgba(2,4,10,0.45)] backdrop-blur">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">Total XP</span>
            <span className="text-blue-300">⚡</span>
          </div>
          <div className="text-2xl font-semibold text-slate-100">45,230</div>
          <div className="text-xs text-slate-400 mt-1">Experience points</div>
        </div>

        <div className="rounded-3xl border border-slate-700/70 bg-slate-900/70 p-4 shadow-[0_16px_40px_rgba(2,4,10,0.45)] backdrop-blur">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">Streak</span>
            <span className="text-rose-300">🔥</span>
          </div>
          <div className="text-2xl font-semibold text-slate-100">28</div>
          <div className="text-xs text-slate-400 mt-1">Days active</div>
        </div>

        <div className="rounded-3xl border border-slate-700/70 bg-slate-900/70 p-4 shadow-[0_16px_40px_rgba(2,4,10,0.45)] backdrop-blur">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">Badges</span>
            <span className="text-blue-300">🎖️</span>
          </div>
          <div className="text-2xl font-semibold text-slate-100">18</div>
          <div className="text-xs text-slate-400 mt-1">Earned</div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-700/70 bg-slate-900/70 p-6 shadow-[0_18px_40px_rgba(2,4,10,0.45)] backdrop-blur">
        <h3 className="display-font text-lg font-semibold text-slate-100 mb-4">Recent Achievements</h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-slate-900/70 rounded-xl border border-slate-700/60 shadow-sm">
            <span className="text-2xl">🥇</span>
            <div className="flex-1">
              <div className="font-medium text-slate-100">Win Streak Master</div>
              <div className="text-sm text-slate-400">10 consecutive winning trades</div>
              <div className="text-xs text-slate-500 mt-1">2 days ago</div>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-slate-900/70 rounded-xl border border-slate-700/60 shadow-sm">
            <span className="text-2xl">🎯</span>
            <div className="flex-1">
              <div className="font-medium text-slate-100">Goal Crusher</div>
              <div className="text-sm text-slate-400">Exceeded monthly profit target</div>
              <div className="text-xs text-slate-500 mt-1">1 week ago</div>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-slate-900/70 rounded-xl border border-slate-700/60 shadow-sm">
            <span className="text-2xl">💎</span>
            <div className="flex-1">
              <div className="font-medium text-slate-100">Level 12 Master</div>
              <div className="text-sm text-slate-400">Reached expert trader level</div>
              <div className="text-xs text-slate-500 mt-1">3 weeks ago</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TraderMapPage() {
  const [activeTab, setActiveTab] = useState<TraderMapTabType>("overview");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [levelState, setLevelState] = useState<UserLevelState | null>(null);

  const fetchLevelState = useCallback(async () => {
    if (!userId) return;
    try {
      const response = await fetch("/api/tradermap/level");
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      setLevelState(data ?? null);
    } catch (err) {
      console.error("[TraderMap] Error fetching level state:", err);
    }
  }, [userId]);

  useEffect(() => {
    const getUser = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);
        }
      } catch (err) {
        console.error("[TraderMap] Error getting user:", err);
      }
    };
    getUser();
  }, []);

  useEffect(() => {
    void fetchLevelState();
  }, [fetchLevelState]);

  useEffect(() => {
    if (!userId) return;
    return subscribeTradeUpdates(() => {
      void fetchLevelState();
    });
  }, [fetchLevelState, userId]);

  const currentTab = TABS.find(t => t.id === activeTab);

  return (
    <div className="flex min-h-screen text-slate-200">
      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? "w-64" : "w-16"} bg-slate-900/80 border-r border-slate-800/80 shadow-[0_18px_40px_rgba(2,4,10,0.6)] backdrop-blur-xl transition-all duration-300 flex flex-col`}>
        {/* Header */}
        <div className="p-4 border-b border-slate-700/60 flex items-center justify-between">
          {isSidebarOpen && <h2 className="display-font font-semibold text-slate-100">TraderMap</h2>}
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
              <div className="font-medium text-slate-200 mb-1">Growth Tracking</div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-amber-300 rounded-full"></div>
                <span>Level up daily</span>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="w-2 h-2 bg-amber-300 rounded-full"></div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto flex flex-col">
        {/* Header */}
        <header className="bg-slate-900/80 border-b border-slate-700/60 px-6 py-4 flex items-center justify-between backdrop-blur-xl shadow-[0_12px_30px_rgba(2,4,10,0.45)]">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-3xl">🗺️</span>
              <h1 className="display-font text-2xl font-semibold text-slate-50">{currentTab?.label}</h1>
            </div>
            <p className="text-sm text-slate-400">{currentTab?.description}</p>
          </div>
          <BackToDashboardButton />
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            {activeTab === "overview" && <TraderMapOverview />}
            {activeTab === "goals" && <GoalsPanel />}
            {activeTab === "progress" && levelState && <ProgressCard levelState={levelState} />}
            {activeTab === "progress" && !levelState && (
              <div className="text-center py-12">
                <TrendingUp className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-slate-200 font-medium">Loading Progress...</h3>
              </div>
            )}
            {activeTab === "achievements" && (
              <div className="text-center py-12">
                <Award className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-slate-200 font-medium">Your Achievements</h3>
                <p className="text-slate-400 text-sm">View your earned badges and awards</p>
              </div>
            )}
            {activeTab === "calendar" && (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-slate-200 font-medium">Activity Calendar</h3>
                <p className="text-slate-400 text-sm">Track your trading activity over time</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
