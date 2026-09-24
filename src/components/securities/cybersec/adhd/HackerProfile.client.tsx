"use client";

import { useState } from "react";
import { User, Zap, Trophy, Settings } from "lucide-react";
import { LeaderboardPercentile } from "./LeaderboardPercentile.client";
import { CosmeticDisplay } from "./CosmeticDisplay.client";

interface Props {
  username?: string;
  level: number;
  totalXp: number;
  streak: number;
  weeklyXp?: number;
}

export function HackerProfile({
  username = "Hacker",
  level,
  totalXp,
  streak,
  weeklyXp = 0,
}: Props) {
  const [activeTab, setActiveTab] = useState<"stats" | "cosmetics">("stats");

  return (
    <div className="rounded-lg border border-cyan-500/30 bg-gradient-to-br from-slate-900 to-slate-800 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-xl font-bold">
            👾
          </div>
          <div>
            <h2 className="font-bold text-lg text-slate-100">{username}</h2>
            <p className="text-xs text-slate-400">Level {level}</p>
          </div>
        </div>
        <button className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
          <Settings size={18} className="text-slate-400" />
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-slate-700/50 p-2 text-center">
          <p className="text-xs text-slate-400 mb-1">XP</p>
          <p className="font-bold text-amber-400">{totalXp}</p>
        </div>
        <div className="rounded-lg bg-slate-700/50 p-2 text-center">
          <p className="text-xs text-slate-400 mb-1">Streak</p>
          <p className="font-bold text-orange-400">🔥 {streak}</p>
        </div>
        <div className="rounded-lg bg-slate-700/50 p-2 text-center">
          <p className="text-xs text-slate-400 mb-1">This Week</p>
          <p className="font-bold text-cyan-400">+{weeklyXp}</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-slate-700">
        <button
          onClick={() => setActiveTab("stats")}
          className={`pb-2 px-2 text-sm font-semibold transition-colors ${
            activeTab === "stats"
              ? "text-cyan-400 border-b-2 border-cyan-400"
              : "text-slate-400 hover:text-slate-300"
          }`}
        >
          <Trophy size={14} className="inline mr-1" /> Stats
        </button>
        <button
          onClick={() => setActiveTab("cosmetics")}
          className={`pb-2 px-2 text-sm font-semibold transition-colors ${
            activeTab === "cosmetics"
              ? "text-cyan-400 border-b-2 border-cyan-400"
              : "text-slate-400 hover:text-slate-300"
          }`}
        >
          <Zap size={14} className="inline mr-1" /> Cosmetics
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "stats" && (
        <LeaderboardPercentile
          userXp={totalXp}
          userLevel={level}
          weeklyXpGain={weeklyXp}
        />
      )}

      {activeTab === "cosmetics" && (
        <CosmeticDisplay
          weekNumber={Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000))}
        />
      )}
    </div>
  );
}
