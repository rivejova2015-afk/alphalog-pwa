"use client";

import { useEffect, useState } from "react";
import { Zap, AlertCircle } from "lucide-react";
import { getAttemptsRemaining } from "@/lib/securities/cybersec/adhd-gamification";

interface Props {
  lessonId: number;
  compact?: boolean;
}

export function DailyAttemptsDisplay({ lessonId, compact = false }: Props) {
  const [attempts, setAttempts] = useState(7);
  const [timeUntilReset, setTimeUntilReset] = useState<string | null>(null);

  useEffect(() => {
    // Get attempts remaining
    const remaining = getAttemptsRemaining(lessonId);
    setAttempts(Math.max(0, remaining));

    // Calculate time until reset (midnight UTC)
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCHours(24, 0, 0, 0);
    const diff = tomorrow.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    setTimeUntilReset(`${hours}h ${minutes}m`);
  }, [lessonId]);

  if (compact) {
    return (
      <div className="flex items-center gap-2 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20">
        <Zap size={14} className="text-amber-400" />
        <span className="text-xs font-semibold text-amber-400">{attempts} left</span>
        {attempts <= 1 && <AlertCircle size={12} className="text-red-400" />}
      </div>
    );
  }

  const isLow = attempts <= 2;
  const isEmpty = attempts === 0;

  return (
    <div className={`rounded-lg border p-3 ${
      isEmpty ? "bg-red-500/10 border-red-500/30" :
      isLow ? "bg-amber-500/10 border-amber-500/30" :
      "bg-cyan-500/10 border-cyan-500/30"
    }`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Zap size={16} className={isLow ? "text-amber-400" : "text-cyan-400"} />
          <span className={`text-sm font-bold ${isLow ? "text-amber-400" : "text-cyan-400"}`}>
            {isEmpty ? "No attempts today" : `${attempts} attempt${attempts !== 1 ? "s" : ""} left`}
          </span>
        </div>
      </div>

      {/* Attempts remaining bar */}
      <div className="flex gap-1">
        {[...Array(7)].map((_, i) => (
          <div
            key={i}
            className={`flex-1 h-2 rounded-full ${
              i < attempts ? "bg-cyan-400" : "bg-slate-600/50"
            }`}
          />
        ))}
      </div>

      {/* Time until reset */}
      {timeUntilReset && (
        <p className="text-xs text-slate-400 mt-2">
          Resets in: <span className="font-semibold text-slate-300">{timeUntilReset}</span>
        </p>
      )}

      {isEmpty && (
        <p className="text-xs text-red-400 mt-2">
          Come back tomorrow for more attempts, or unlock bonus attempts with social shares.
        </p>
      )}

      {isLow && (
        <p className="text-xs text-amber-400 mt-2">
          ⚠️ Use your remaining attempts wisely — they reset at midnight UTC.
        </p>
      )}
    </div>
  );
}
