"use client";

import { useState, useEffect } from "react";
import { BarChart3, Zap } from "lucide-react";
import {
  getActiveVariant,
  switchVariant,
  VARIANTS,
  type VariantId,
} from "@/lib/securities/cybersec/adhd-ab-testing";

interface Props {
  onVariantChange?: (variantId: VariantId) => void;
}

export function VariantSelector({ onVariantChange }: Props) {
  const [activeVariant, setActiveVariant] = useState<VariantId>("control");

  useEffect(() => {
    const variant = getActiveVariant();
    setActiveVariant(variant.id);
  }, []);

  const handleSwitchVariant = (variantId: VariantId) => {
    switchVariant(variantId);
    setActiveVariant(variantId);
    onVariantChange?.(variantId);
  };

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Zap size={18} className="text-cyan-400" />
        <h3 className="text-sm font-bold text-slate-200">A/B Testing Variant</h3>
      </div>

      {/* Variant Cards */}
      <div className="space-y-2">
        {Object.entries(VARIANTS).map(([id, variant]) => {
          const isActive = id === activeVariant;

          return (
            <button
              key={id}
              onClick={() => handleSwitchVariant(id as VariantId)}
              className={`w-full rounded-lg p-3 border-2 transition-all text-left ${
                isActive
                  ? "border-cyan-500 bg-cyan-500/10"
                  : "border-slate-700 bg-slate-700/20 hover:border-slate-600"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-slate-100">
                    {variant.name}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {variant.description}
                  </p>
                </div>
                {isActive && (
                  <span className="text-xs px-2 py-1 rounded bg-cyan-500/20 text-cyan-400 font-semibold whitespace-nowrap">
                    Active
                  </span>
                )}
              </div>

              {/* Config details */}
              <div className="grid grid-cols-2 gap-2 mt-2 text-[10px] text-slate-400">
                <span>Sounds: {variant.config.enableSounds ? "✓" : "✗"}</span>
                <span>Hints: {variant.config.enableHints ? "✓" : "✗"}</span>
                <span>XP ×{variant.config.xpMultiplier}</span>
                <span>Penalty: {variant.config.hintPenaltyPercent}%</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Info */}
      <div className="text-xs text-slate-400 pt-2 border-t border-slate-700">
        <p>
          🧪 Run sessions with each variant to compare metrics. The system will
          recommend the best one.
        </p>
      </div>
    </div>
  );
}
