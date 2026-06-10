"use client";

import { Cloud, ExternalLink } from "lucide-react";
import type { ReactNode } from "react";

// ─── Research mode banner ───────────────────────────────────────────────────
//
// Shared "Modo research — sin cuenta vinculada" banner with the same visual
// treatment as the forex DeployToAccountSection (purple-tinted card, mono
// uppercase heading, explanation, optional CTA). Used by futures (CME) and
// options sections so all three market types surface a consistent research
// mode hint when no real execution account is wired.
//
// This component is purely presentational — it does NOT call any deploy
// endpoint. Futures routes the CTA to the existing CME account wizard; options
// has no CTA because IBKR execution doesn't exist yet.
export function ResearchModeBanner({
  title,
  description,
  cta,
  children,
}: {
  title: string;
  description: ReactNode;
  /** Optional CTA that routes to an existing flow. Omit for purely informational banners. */
  cta?: { href: string; label: string };
  /** Optional extra content rendered below the description (e.g. inline notes). */
  children?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#a78bfa]/30 bg-[#a78bfa]/5 p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-[#a78bfa] font-mono uppercase tracking-wider flex items-center gap-2">
          <Cloud className="w-4 h-4" />
          {title}
        </h3>
        <p className="text-xs text-[#94a3b8] mt-1 leading-relaxed">{description}</p>
      </div>

      {children}

      {cta && (
        <a
          href={cta.href}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#a78bfa] hover:bg-[#c4b5fd] text-[#0a0e1a] text-sm font-bold transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          {cta.label}
        </a>
      )}
    </div>
  );
}
