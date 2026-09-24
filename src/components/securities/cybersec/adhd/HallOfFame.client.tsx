"use client";

import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { getHallOfFame, type HallOfFameEntry } from "@/lib/securities/cybersec/adhd-social-leaderboards";

interface Props {
  maxEntries?: number;
}

export function HallOfFame({ maxEntries = 10 }: Props) {
  const [entries, setEntries] = useState<HallOfFameEntry[]>([]);

  useEffect(() => {
    const hallOfFame = getHallOfFame();
    setEntries(hallOfFame.slice(0, maxEntries));
  }, [maxEntries]);

  const getMedalEmoji = (index: number): string => {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return `${index + 1}.`;
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("es-ES", { month: "short", day: "numeric" });
  };

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Trophy size={18} className="text-amber-400" />
        <h3 className="text-sm font-bold text-slate-200">Hall of Fame</h3>
      </div>

      {/* Entries */}
      {entries.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-4">
          🗡️ Conquer quests to enter the Hall of Fame
        </p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {entries.map((entry, index) => (
            <div
              key={`${entry.timestamp}-${index}`}
              className={`rounded-lg p-3 border ${
                index < 3
                  ? "border-amber-500/30 bg-amber-500/5"
                  : "border-slate-700 bg-slate-700/20"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <span className="text-lg font-bold min-w-6">{getMedalEmoji(index)}</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-100">
                      {entry.achievement}
                    </p>
                    <div className="flex gap-3 mt-1">
                      <span className="text-xs text-slate-400">Level {entry.level}</span>
                      <span className="text-xs text-cyan-400">{entry.xp} XP</span>
                      <span className="text-xs text-amber-300">{entry.hackerRankTitle}</span>
                    </div>
                  </div>
                </div>
                <span className="text-xs text-slate-500 whitespace-nowrap">
                  {formatDate(entry.timestamp)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
