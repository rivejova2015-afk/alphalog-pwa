"use client";

import { useEffect, useState } from "react";
import { Trophy, Sparkles } from "lucide-react";
import {
  getWeeklyRewardType,
  getWeeklyRewardLabel,
  getRarityColor,
  getRarityBgColor,
  getCosmeticsByType,
  type Cosmetic,
} from "@/lib/securities/cybersec/adhd-cosmetics";

interface Props {
  weekNumber?: number;
}

export function CosmeticDisplay({ weekNumber = 0 }: Props) {
  const [unlockedCosmetics, setUnlockedCosmetics] = useState<Cosmetic[]>([]);
  const [weeklyType, setWeeklyType] = useState("badge");
  const [weeklyLabel, setWeeklyLabel] = useState("");

  useEffect(() => {
    // Get this week's reward type
    const type = getWeeklyRewardType(weekNumber);
    const label = getWeeklyRewardLabel(weekNumber);

    setWeeklyType(type);
    setWeeklyLabel(label);

    // Get cosmetics for this week's type
    const cosmetics = getCosmeticsByType(type);
    setUnlockedCosmetics(cosmetics.slice(0, 3)); // Show top 3 unlocked (in real impl, check localStorage)
  }, [weekNumber]);

  return (
    <div className="space-y-4">
      {/* Weekly Reward Banner */}
      <div className="rounded-lg bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={18} className="text-purple-400 animate-pulse" />
          <h3 className="font-bold text-purple-300">{weeklyLabel}</h3>
        </div>
        <p className="text-xs text-purple-200">
          Earn {weeklyType === "badge" ? "badges" : weeklyType === "title" ? "titles" : weeklyType === "gear" ? "gear" : "themes"} every 5 correct answers this week.
        </p>
      </div>

      {/* Unlocked Cosmetics Grid */}
      <div>
        <h4 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
          <Trophy size={14} /> Unlocked
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          {unlockedCosmetics.map((cosmetic) => (
            <div
              key={cosmetic.id}
              className={`rounded-lg border p-3 ${getRarityBgColor(cosmetic.rarity)}`}
            >
              <div className="flex items-start justify-between mb-1">
                <div className="text-2xl">{cosmetic.emoji}</div>
                <span className={`text-xs font-semibold ${getRarityColor(cosmetic.rarity)}`}>
                  {cosmetic.rarity}
                </span>
              </div>
              <h5 className="text-sm font-semibold text-slate-200">{cosmetic.name}</h5>
              <p className="text-xs text-slate-400">{cosmetic.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Hint for more */}
      <p className="text-xs text-slate-500 text-center">
        Keep quizzing to unlock more cosmetics each week!
      </p>
    </div>
  );
}
