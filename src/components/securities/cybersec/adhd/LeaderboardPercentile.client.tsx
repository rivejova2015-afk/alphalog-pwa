"use client";

import { useMemo } from "react";
import { Users, TrendingUp } from "lucide-react";

interface Props {
  userXp: number;
  userLevel: number;
  weeklyXpGain?: number;
}

export function LeaderboardPercentile({
  userXp,
  userLevel,
  weeklyXpGain = 0,
}: Props) {
  // Mock leaderboard data (in real impl, this comes from server)
  // Distribution: 70% of users < 500 XP, 20% between 500-1500, 10% > 1500
  const userPercentile = useMemo(() => {
    if (userXp < 500) return Math.min(70, Math.floor((userXp / 500) * 70));
    if (userXp < 1500) return 70 + Math.floor(((userXp - 500) / 1000) * 20);
    return 90 + Math.floor(((Math.min(userXp, 2500) - 1500) / 1000) * 10);
  }, [userXp]);

  const leagueEmoji = useMemo(() => {
    if (userLevel < 5) return { emoji: "🔴", name: "Red League", desc: "Rank 50-100" };
    if (userLevel < 10) return { emoji: "🔵", name: "Blue League", desc: "Rank 20-49" };
    if (userLevel < 15) return { emoji: "🟣", name: "Purple League", desc: "Rank 1-19" };
    return { emoji: "👑", name: "Elite League", desc: "Rank 1-5" };
  }, [userLevel]);

  const weeklyRankChange = weeklyXpGain > 50 ? "📈" : weeklyXpGain > 0 ? "➡️" : "📉";

  return (
    <div className="space-y-4">
      {/* League Display */}
      <div className="rounded-lg bg-gradient-to-r from-slate-800 to-slate-700 border border-slate-600 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-cyan-400" />
            <h3 className="font-bold text-slate-200">Leaderboard Position</h3>
          </div>
          <span className="text-2xl">{leagueEmoji.emoji}</span>
        </div>

        <div className="space-y-3">
          {/* Percentile */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-slate-400">Global Percentile</span>
              <span className="text-xl font-bold text-cyan-400">{userPercentile}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-600 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 transition-all duration-300"
                style={{ width: `${userPercentile}%` }}
              />
            </div>
            <p className="text-xs text-slate-400 mt-1">
              You beat <span className="font-semibold text-cyan-300">{userPercentile}%</span> of learners
            </p>
          </div>

          {/* League */}
          <div className="pt-2 border-t border-slate-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-300">{leagueEmoji.name}</p>
                <p className="text-xs text-slate-500">{leagueEmoji.desc}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Level {userLevel}</p>
                <p className="text-lg font-bold text-amber-400">{userXp} XP</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Weekly Progress */}
      {weeklyXpGain !== undefined && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} className="text-emerald-400" />
              <span className="text-sm text-emerald-300">This week</span>
            </div>
            <div className="text-right">
              <span className="text-2xl mr-2">{weeklyRankChange}</span>
              <span className="font-bold text-emerald-400">+{weeklyXpGain} XP</span>
            </div>
          </div>
        </div>
      )}

      {/* Motivation */}
      <p className="text-xs text-center text-slate-500">
        {userPercentile < 30 && "Keep grinding! Every quiz brings you closer to the top 🚀"}
        {userPercentile >= 30 && userPercentile < 70 && "You're doing great! Push to elite status 💪"}
        {userPercentile >= 70 && "You're in the elite! Stay at the top 👑"}
      </p>
    </div>
  );
}
