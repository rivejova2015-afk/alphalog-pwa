"use client";

import { Award } from "lucide-react";

interface Props {
  quizzesCompleted: number;
  quizzesTilBadge: number;
  badgeTitle?: string;
}

export function ProgressTowardBadge({
  quizzesCompleted,
  quizzesTilBadge,
  badgeTitle = "Badge",
}: Props) {
  const totalQuizzesForBadge = 5; // Every 5 quizzes = 1 badge
  const progress = ((quizzesCompleted % totalQuizzesForBadge) / totalQuizzesForBadge) * 100;
  const quizzesInCycle = quizzesCompleted % totalQuizzesForBadge;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-amber-400 font-semibold">
          <Award size={14} />
          {quizzesInCycle}/{totalQuizzesForBadge} to {badgeTitle}
        </div>
        <div className="text-xs text-amber-300/70">
          {quizzesTilBadge} quiz{quizzesTilBadge !== 1 ? "zes" : ""} away
        </div>
      </div>

      {/* Progress bar with animation */}
      <div className="relative h-2 rounded-full bg-amber-500/10 overflow-hidden border border-amber-500/20">
        <div
          className="h-full bg-gradient-to-r from-amber-400 to-amber-300 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
        {/* Shimmer effect */}
        <div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
          style={{
            animation: "shimmer 2s infinite",
            width: "50px",
          }}
        />
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
