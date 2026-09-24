"use client";

import { useEffect, useState } from "react";
import { Lightbulb, AlertCircle } from "lucide-react";
import { getHintForDifficulty, getEncouragement } from "@/lib/securities/cybersec/adhd-adaptive";

interface Props {
  isVisible: boolean;
  difficulty: "basic" | "intermediate" | "advanced";
  wrongCount: number;
  onUseHint: () => void;
}

export function HintDisplay({
  isVisible,
  difficulty,
  wrongCount,
  onUseHint,
}: Props) {
  const [hint, setHint] = useState("");
  const [encouragement, setEncouragement] = useState("");

  useEffect(() => {
    if (isVisible) {
      const newHint = getHintForDifficulty(difficulty);
      setHint(newHint);

      // Choose encouragement based on wrong count
      if (wrongCount >= 3) {
        setEncouragement(getEncouragement("consecutiveWrong"));
      } else if (wrongCount === 2) {
        setEncouragement(getEncouragement("slowProgress"));
      } else {
        setEncouragement("🤔 Struggling? A hint might help.");
      }
    }
  }, [isVisible, difficulty, wrongCount]);

  if (!isVisible) return null;

  return (
    <div className="rounded-lg border-2 border-amber-500/50 bg-amber-500/10 p-4 space-y-3 animate-pulse">
      {/* Encouragement */}
      <p className="text-sm text-amber-300 font-semibold">{encouragement}</p>

      {/* Hint Box */}
      <div className="rounded-lg bg-slate-700/50 p-3 border border-amber-500/30">
        <div className="flex items-start gap-2">
          <Lightbulb size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-slate-200">{hint}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onUseHint}
          className="flex-1 px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-400 rounded text-sm font-semibold transition-colors"
        >
          Use Hint (-25% XP)
        </button>
        <button
          className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 rounded text-sm transition-colors"
        >
          Try Again
        </button>
      </div>

      {/* Warning after too many wrong */}
      {wrongCount >= 3 && (
        <div className="flex items-start gap-2 pt-2 border-t border-amber-500/20">
          <AlertCircle size={14} className="text-orange-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-orange-300">
            After one more wrong, you can skip this question without penalty.
          </p>
        </div>
      )}
    </div>
  );
}
