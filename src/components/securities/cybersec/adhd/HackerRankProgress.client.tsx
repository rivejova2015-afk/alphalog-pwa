"use client";

import { useEffect, useState } from "react";
import { Zap, ArrowUp } from "lucide-react";
import { calculateHackerRankProgress } from "@/lib/securities/cybersec/adhd-adaptive";

interface Props {
  totalXp: number;
  currentLevel: number;
}

export function HackerRankProgress({ totalXp, currentLevel }: Props) {
  const [progress, setProgress] = useState(
    calculateHackerRankProgress(totalXp, currentLevel)
  );

  useEffect(() => {
    setProgress(calculateHackerRankProgress(totalXp, currentLevel));
  }, [totalXp, currentLevel]);

  const getLevelColor = (level: number): string => {
    if (level < 10) return "from-slate-400 to-slate-300";
    if (level < 20) return "from-green-400 to-emerald-300";
    if (level < 30) return "from-blue-400 to-cyan-300";
    if (level < 50) return "from-purple-400 to-pink-300";
    if (level < 75) return "from-amber-400 to-orange-300";
    return "from-yellow-300 to-yellow-200";
  };

  const getRankEmoji = (level: number): string => {
    if (level < 10) return "🤓";
    if (level < 20) return "🔍";
    if (level < 30) return "⚙️";
    if (level < 50) return "🏗️";
    if (level < 75) return "🎯";
    return "👑";
  };

  return (
    <div className="space-y-3">
      {/* Rank Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{getRankEmoji(progress.level)}</span>
          <div>
            <p className="text-sm font-bold text-slate-200">
              {progress.rankTitle}
            </p>
            <p className="text-xs text-slate-400">Level {progress.level}/100</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">Next Rank</p>
          <p className="text-sm font-bold text-cyan-400">
            Lvl {progress.nextMilestone}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">
            {progress.xpInLevel} / {progress.xpToNextLevel} XP
          </span>
          <span className={`font-bold text-transparent bg-clip-text bg-gradient-to-r ${getLevelColor(progress.level)}`}>
            {Math.floor(progress.percentProgress)}%
          </span>
        </div>

        {/* Animated Progress Bar */}
        <div className="relative h-3 rounded-full bg-slate-700 overflow-hidden border border-slate-600">
          <div
            className={`h-full bg-gradient-to-r ${getLevelColor(progress.level)} rounded-full transition-all duration-500 ease-out`}
            style={{ width: `${progress.percentProgress}%` }}
          />
          {/* Shine effect */}
          <div
            className="absolute top-0 h-full w-12 bg-white/20 opacity-0 animate-pulse"
            style={{
              left: `${progress.percentProgress}%`,
              animation: "shimmer 2s infinite",
            }}
          />
        </div>
      </div>

      {/* Milestone Info */}
      <div className="rounded-lg bg-slate-700/50 p-2">
        <div className="flex items-center gap-2 text-xs">
          <ArrowUp size={12} className="text-amber-400" />
          <span className="text-slate-300">
            {progress.nextMilestone === 100
              ? "🎊 Final level!"
              : `Level ${progress.nextMilestone} unlocks new title & cosmetics`}
          </span>
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% {
            left: -50px;
          }
          100% {
            left: 100%;
          }
        }
      `}</style>
    </div>
  );
}
