"use client";

import { getScaffoldingStrategy, type ScaffoldingLevel } from "@/lib/securities/cybersec/adhd-adaptive";
import { Zap, SkipForward, BookOpen } from "lucide-react";

interface Props {
  level: ScaffoldingLevel;
  showDetails?: boolean;
}

export function AdaptiveScaffoldingIndicator({
  level,
  showDetails = true,
}: Props) {
  const strategy = getScaffoldingStrategy(level);

  const levelConfig = {
    flowing: {
      emoji: "✓",
      label: "Flowing",
      bgColor: "bg-green-500/10 border-green-500/30",
      textColor: "text-green-400",
      description: "You're in the zone. Explanations on as normal.",
    },
    struggling: {
      emoji: "💪",
      label: "Struggling",
      bgColor: "bg-amber-500/10 border-amber-500/30",
      textColor: "text-amber-400",
      description: "I've detected you need support. Hints & full explanations enabled.",
    },
    mastering: {
      emoji: "🚀",
      label: "Mastering",
      bgColor: "bg-purple-500/10 border-purple-500/30",
      textColor: "text-purple-400",
      description: "You're crushing it! 2x XP bonus for speed.",
    },
  };

  const config = levelConfig[level];

  return (
    <div className={`rounded-lg border p-3 ${config.bgColor} space-y-2`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{config.emoji}</span>
          <span className={`font-bold text-sm ${config.textColor}`}>
            {config.label}
          </span>
        </div>
        <div className="flex gap-1">
          {strategy.showHints && (
            <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
              Hints on
            </span>
          )}
          {strategy.xpMultiplier > 1 && (
            <span className={`text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-300`}>
              {strategy.xpMultiplier}x XP
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      {showDetails && (
        <p className="text-xs text-slate-300">{config.description}</p>
      )}

      {/* Available Features */}
      {showDetails && (
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700">
          <div className="flex items-center gap-1 text-xs">
            <BookOpen size={12} className={config.textColor} />
            <span className="text-slate-400">
              {strategy.showExplanation
                ? "Full explanations"
                : "Minimal explanations"}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <Zap size={12} className={config.textColor} />
            <span className="text-slate-400">
              {strategy.showHints ? "Hints available" : "Hints off"}
            </span>
          </div>
          {strategy.skipOption && (
            <div className="flex items-center gap-1 text-xs col-span-2">
              <SkipForward size={12} className="text-orange-400" />
              <span className="text-orange-300">Skip available after 4 wrong</span>
            </div>
          )}
        </div>
      )}

      {/* Emoji Message */}
      {level === "struggling" && (
        <div className="pt-2 border-t border-slate-600">
          <p className="text-xs text-amber-300 font-semibold">
            {strategy.emotionalSupport}
          </p>
        </div>
      )}
    </div>
  );
}
