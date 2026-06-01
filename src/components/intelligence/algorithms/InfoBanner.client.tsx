"use client";

import { Info } from "lucide-react";
import type { ReactNode } from "react";

// Slim educational banner — Sprint I. Lives next to inputs/sections to explain
// what the user is looking at without requiring hover or modal dive. Use for
// per-section context; for per-field hints keep the existing `Field hint=`
// pattern (no need to wrap an Info icon around every input).
//
// Tones:
//   - "info"    (default, cyan)   → neutral explanation
//   - "amber"   (warning)         → conditional info (e.g. shadow mode active)
//   - "emerald" (success / safe)  → positive confirmation (e.g. connected)

interface Props {
  children: ReactNode;
  tone?: "info" | "amber" | "emerald";
}

const PALETTE: Record<NonNullable<Props["tone"]>, { border: string; bg: string; icon: string }> = {
  info:    { border: "#1f2937",   bg: "#151b28",  icon: "#22d3ee" },
  amber:   { border: "#f59e0b40", bg: "#f59e0b10", icon: "#f59e0b" },
  emerald: { border: "#34d39940", bg: "#34d39910", icon: "#34d399" },
};

export function InfoBanner({ children, tone = "info" }: Props) {
  const palette = PALETTE[tone];
  return (
    <div
      role="note"
      className="flex items-start gap-2 px-3 py-2 rounded-lg border"
      style={{ borderColor: palette.border, background: palette.bg }}
    >
      <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: palette.icon }} />
      <p className="text-[11px] text-[#94a3b8] leading-relaxed">{children}</p>
    </div>
  );
}
