"use client";

import { useEffect, useState } from "react";
import { Sparkles, Lock } from "lucide-react";
import {
  getRareBadges,
  getUnlockedRareBadges,
  type RareBadge,
} from "@/lib/securities/cybersec/adhd-social-leaderboards";

interface Props {
  showAll?: boolean;
}

export function RareBadges({ showAll = true }: Props) {
  const [allBadges, setAllBadges] = useState<RareBadge[]>([]);
  const [unlockedBadges, setUnlockedBadges] = useState<Set<string>>(new Set());

  useEffect(() => {
    const badges = getRareBadges();
    setAllBadges(badges);

    const unlocked = getUnlockedRareBadges();
    setUnlockedBadges(new Set(unlocked.map((b) => b.id)));
  }, []);

  const displayBadges = showAll ? allBadges : getUnlockedRareBadges();

  const getRarityColor = (rarity: string): string => {
    if (rarity === "legendary") return "border-yellow-400/50 bg-yellow-400/5";
    if (rarity === "epic") return "border-purple-400/50 bg-purple-400/5";
    return "border-blue-400/50 bg-blue-400/5";
  };

  const getRarityLabel = (rarity: string): string => {
    if (rarity === "legendary") return "Legendary";
    if (rarity === "epic") return "Epic";
    return "Rare";
  };

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles size={18} className="text-yellow-400" />
        <h3 className="text-sm font-bold text-slate-200">Rare Badges</h3>
        <span className="text-xs text-slate-400">
          {unlockedBadges.size}/{allBadges.length}
        </span>
      </div>

      {/* Badge Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {displayBadges.map((badge) => {
          const isUnlocked = unlockedBadges.has(badge.id);

          return (
            <div
              key={badge.id}
              className={`rounded-lg p-3 border ${getRarityColor(badge.rarity)} transition-all ${
                !isUnlocked && showAll ? "opacity-50" : ""
              }`}
            >
              <div className="space-y-2">
                {/* Icon + Lock */}
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{badge.icon}</span>
                  {!isUnlocked && showAll && (
                    <Lock size={14} className="text-slate-500" />
                  )}
                </div>

                {/* Badge Name */}
                <div>
                  <p className="text-xs font-bold text-slate-200 truncate">
                    {badge.name}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {getRarityLabel(badge.rarity)}
                  </p>
                </div>

                {/* Condition or Unlock Date */}
                {isUnlocked && badge.unlockedAt ? (
                  <p className="text-[10px] text-green-400 font-semibold">
                    ✓ {new Date(badge.unlockedAt).toLocaleDateString("es-ES")}
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-500 line-clamp-2">
                    {badge.condition}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {displayBadges.length === 0 && showAll && (
        <p className="text-xs text-slate-400 text-center py-4">
          🎯 Unlock rare badges by mastering quests
        </p>
      )}
    </div>
  );
}
