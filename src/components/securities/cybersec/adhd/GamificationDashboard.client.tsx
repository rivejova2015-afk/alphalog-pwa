"use client";

import { useEffect, useState } from "react";
import { Zap, TrendingUp, Trophy } from "lucide-react";
import { getLevelProgress } from "@/lib/securities/cybersec/adhd-gamification";
import { getActiveVariant } from "@/lib/securities/cybersec/adhd-ab-testing";
import { VariantSelector } from "./VariantSelector.client";
import { ABTestingDashboard } from "./ABTestingDashboard.client";
import { HackerRankProgress } from "./HackerRankProgress.client";
import { HallOfFame } from "./HallOfFame.client";

export function GamificationDashboard() {
  const [levelData, setLevelData] = useState<any>(null);
  const [activeVariant, setActiveVariant] = useState<string>("control");

  useEffect(() => {
    const progress = getLevelProgress();
    setLevelData(progress);

    const variant = getActiveVariant();
    setActiveVariant(variant.id);
  }, []);

  if (!levelData) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap size={24} className="text-cyan-400" />
          <div>
            <h2 className="text-xl font-bold text-slate-100">Hacker Training</h2>
            <p className="text-xs text-slate-400">
              CyberSec Academy Gamification
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-cyan-400">
            {levelData.currentLevel}
          </p>
          <p className="text-xs text-slate-400">Level / 100</p>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-slate-800/30 p-3 border border-slate-700">
          <p className="text-xs text-slate-400">Total XP</p>
          <p className="text-lg font-bold text-cyan-400">
            {levelData.currentXp}
          </p>
        </div>
        <div className="rounded-lg bg-slate-800/30 p-3 border border-slate-700">
          <p className="text-xs text-slate-400">Next Level</p>
          <p className="text-lg font-bold text-slate-200">
            {levelData.xpToNextLevel}
          </p>
        </div>
        <div className="rounded-lg bg-slate-800/30 p-3 border border-slate-700">
          <p className="text-xs text-slate-400">Progress</p>
          <p className="text-lg font-bold text-green-400">
            {levelData.percentage.toFixed(0)}%
          </p>
        </div>
      </div>

      {/* Hacker Rank Progress Bar */}
      <HackerRankProgress
        totalXp={levelData.currentXp}
        currentLevel={levelData.currentLevel}
      />

      {/* Variant Selector */}
      <VariantSelector onVariantChange={setActiveVariant} />

      {/* A/B Testing Dashboard */}
      <ABTestingDashboard showRawData={false} />

      {/* Hall of Fame */}
      <HallOfFame maxEntries={5} />

      {/* Tips Banner */}
      <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3">
        <p className="text-xs text-cyan-300">
          💡 <strong>Level up faster:</strong> Run quizzes with the Treatment
          variant to test hyper-dopamine settings (2x XP, no hint penalties).
          Check the A/B Testing dashboard to see which variant suits you best.
        </p>
      </div>
    </div>
  );
}
