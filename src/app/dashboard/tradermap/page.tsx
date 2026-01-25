// src/app/dashboard/tradermap/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Zap, Target, TrendingUp, Award, Calendar } from "lucide-react";
import GoalsPanel from "@/components/tradermap/GoalsPanel.client";
import ProgressCard from "@/components/tradermap/ProgressCard.client";
import { createClient } from "@/lib/supabase/browser";

type TraderMapTabType = "overview" | "goals" | "progress" | "achievements" | "calendar";

interface TraderMapTab {
  id: TraderMapTabType;
  label: string;
  icon: React.ReactNode;
  description: string;
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
        <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">Current Level</span>
            <span className="text-amber-600">🏆</span>
          </div>
          <div className="text-2xl font-semibold text-slate-900">12</div>
          <div className="text-xs text-slate-500 mt-1">Expert Trader</div>
        </div>

        <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">Total XP</span>
            <span className="text-blue-600">⚡</span>
          </div>
          <div className="text-2xl font-semibold text-slate-900">45,230</div>
          <div className="text-xs text-slate-500 mt-1">Experience points</div>
        </div>

        <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">Streak</span>
            <span className="text-rose-600">🔥</span>
          </div>
          <div className="text-2xl font-semibold text-slate-900">28</div>
          <div className="text-xs text-slate-500 mt-1">Days active</div>
        </div>

        <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">Badges</span>
            <span className="text-purple-600">🎖️</span>
          </div>
          <div className="text-2xl font-semibold text-slate-900">18</div>
          <div className="text-xs text-slate-500 mt-1">Earned</div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Recent Achievements</h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-white/90 rounded-xl border border-white/60 shadow-sm">
            <span className="text-2xl">🥇</span>
            <div className="flex-1">
              <div className="font-medium text-slate-900">Win Streak Master</div>
              <div className="text-sm text-slate-500">10 consecutive winning trades</div>
              <div className="text-xs text-slate-400 mt-1">2 days ago</div>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-white/90 rounded-xl border border-white/60 shadow-sm">
            <span className="text-2xl">🎯</span>
            <div className="flex-1">
              <div className="font-medium text-slate-900">Goal Crusher</div>
              <div className="text-sm text-slate-500">Exceeded monthly profit target</div>
              <div className="text-xs text-slate-400 mt-1">1 week ago</div>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-white/90 rounded-xl border border-white/60 shadow-sm">
            <span className="text-2xl">💎</span>
            <div className="flex-1">
              <div className="font-medium text-slate-900">Level 12 Master</div>
              <div className="text-sm text-slate-500">Reached expert trader level</div>
              <div className="text-xs text-slate-400 mt-1">3 weeks ago</div>
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
  const [levelState, setLevelState] = useState<any>(null);

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

  const currentTab = TABS.find(t => t.id === activeTab);

  return (
    <div className="flex min-h-screen text-slate-700">
      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? "w-64" : "w-16"} bg-white/75 border-r border-white/60 shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur-xl transition-all duration-300 flex flex-col`}>
        {/* Header */}
        <div className="p-4 border-b border-white/70 flex items-center justify-between">
          {isSidebarOpen && <h2 className="font-semibold text-slate-900">TraderMap</h2>}
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
              <div className="font-medium text-slate-700 mb-1">Growth Tracking</div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                <span>Level up daily</span>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
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
              <span className="text-3xl">🗺️</span>
              <h1 className="text-2xl font-semibold text-slate-900">{currentTab?.label}</h1>
            </div>
            <p className="text-sm text-slate-500">{currentTab?.description}</p>
          </div>
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
                <h3 className="text-slate-700 font-medium">Loading Progress...</h3>
              </div>
            )}
            {activeTab === "achievements" && (
              <div className="text-center py-12">
                <Award className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-slate-700 font-medium">Your Achievements</h3>
                <p className="text-slate-500 text-sm">View your earned badges and awards</p>
              </div>
            )}
            {activeTab === "calendar" && (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-slate-700 font-medium">Activity Calendar</h3>
                <p className="text-slate-500 text-sm">Track your trading activity over time</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
