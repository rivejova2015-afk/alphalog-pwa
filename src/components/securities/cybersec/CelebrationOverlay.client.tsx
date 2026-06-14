"use client";

import { useEffect, useState } from "react";
import { Crown, Award, Sparkles, GraduationCap } from "lucide-react";
import type { Milestone } from "@/lib/securities/cybersec";

const COLORS = ["#22d3ee", "#a78bfa", "#34d399", "#eab308", "#ef4444"];

const ICON = {
  level: Sparkles,
  crown: Crown,
  achievement: Award,
  exam: GraduationCap,
} as const;

const ACCENT = {
  level: "#a78bfa",
  crown: "#eab308",
  achievement: "#22d3ee",
  exam: "#34d399",
} as const;

// Celebrates server-detected milestones one at a time. Seeds its queue once from
// the first non-empty `milestones` array (the summary endpoint already persisted
// the snapshot, so each milestone is delivered exactly once).
export function CelebrationOverlay({ milestones }: { milestones: Milestone[] }) {
  const [queue, setQueue] = useState<Milestone[]>([]);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (!seeded && milestones.length > 0) {
      setQueue(milestones);
      setSeeded(true);
    }
  }, [milestones, seeded]);

  const milestone = queue[0] ?? null;
  if (!milestone) return null;
  const onDismiss = () => setQueue((q) => q.slice(1));
  const Icon = ICON[milestone.kind];
  const accent = ACCENT[milestone.kind];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label={milestone.title}>
      <style>{"@keyframes cyb-fall{0%{transform:translateY(-20vh) rotate(0deg);opacity:1}100%{transform:translateY(85vh) rotate(540deg);opacity:0}}@keyframes cyb-pop{0%{transform:scale(0.6);opacity:0}60%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}.cyb-confetti{animation:cyb-fall var(--dur) linear var(--delay) infinite}.cyb-pop{animation:cyb-pop .35s ease-out}@media (prefers-reduced-motion: reduce){.cyb-confetti{display:none}.cyb-pop{animation:none}}"}</style>

      {/* Confetti (oculto con prefers-reduced-motion) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {Array.from({ length: 16 }).map((_, i) => (
          <span
            key={i}
            className="cyb-confetti"
            style={{
              position: "absolute",
              left: `${(i * 6.25 + (i % 3) * 4) % 100}%`,
              top: "-5%",
              width: 9,
              height: 9,
              background: COLORS[i % COLORS.length],
              borderRadius: i % 2 ? "50%" : "1px",
              ["--dur" as string]: `${1.8 + (i % 5) * 0.35}s`,
              ["--delay" as string]: `${(i % 7) * 0.12}s`,
            }}
          />
        ))}
      </div>

      <div
        className="cyb-pop relative w-full max-w-sm rounded-2xl border p-6 text-center"
        style={{ borderColor: `${accent}66`, background: "#0a0e1a" }}
      >
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: `${accent}22`, color: accent }}>
          <Icon size={32} />
        </div>
        <h2 className="text-xl font-bold text-[#e2e8f0] font-mono">{milestone.title}</h2>
        <p className="mt-1 text-sm text-[#94a3b8]">{milestone.detail}</p>
        <button
          onClick={onDismiss}
          autoFocus
          className="mt-5 w-full rounded-lg px-4 py-2.5 font-bold text-[#0a0e1a]"
          style={{ background: accent }}
        >
          ¡Seguir! 🎉
        </button>
      </div>
    </div>
  );
}
