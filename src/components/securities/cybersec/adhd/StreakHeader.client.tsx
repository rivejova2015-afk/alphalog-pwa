"use client";

import { useEffect, useState } from "react";
import { Flame, Zap } from "lucide-react";
import { getUserGameState, updateStreak } from "@/lib/securities/cybersec/adhd-gamification";

interface Props {
  compact?: boolean;
}

export function StreakHeader({ compact = false }: Props) {
  const [streak, setStreak] = useState(0);
  const [dailyBonus, setDailyBonus] = useState(0);
  const [hasBroken, setHasBroken] = useState(false);

  useEffect(() => {
    // Update streak on mount
    const result = updateStreak();
    setStreak(result.currentStreak);
    setHasBroken(result.streakBroken);

    // Award daily bonus XP
    if (result.dailyBonusEarned) {
      setDailyBonus(5);
    }
  }, []);

  if (compact) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-amber-500/10 border border-amber-500/20">
        <Flame size={14} className="text-amber-400" />
        <span className="text-sm font-semibold text-amber-400">{streak}</span>
        {dailyBonus > 0 && (
          <span className="text-xs text-amber-300">+{dailyBonus} XP today</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-500/5 border border-amber-500/20">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Flame size={18} className="text-amber-400 animate-pulse" />
          <div>
            <div className="text-2xl font-bold text-amber-400">{streak}</div>
            <div className="text-xs text-amber-300/70">day streak</div>
          </div>
        </div>

        {hasBroken && (
          <div className="ml-4 p-2 rounded bg-red-500/10 border border-red-500/20">
            <p className="text-xs text-red-400">
              <strong>Streak paused.</strong> 1 quiz to reactivate it!
            </p>
          </div>
        )}
      </div>

      {dailyBonus > 0 && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-green-500/10 border border-green-500/20">
          <Zap size={14} className="text-green-400" />
          <span className="text-sm font-semibold text-green-400">+{dailyBonus} XP</span>
          <span className="text-xs text-green-300/70">today</span>
        </div>
      )}
    </div>
  );
}
