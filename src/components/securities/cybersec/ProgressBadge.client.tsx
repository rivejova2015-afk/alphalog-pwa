"use client";

import type { ModuleStatus } from "@/lib/securities/cybersec";

interface Props {
  status: ModuleStatus;
  size?: "sm" | "md";
}

const STYLES: Record<ModuleStatus, { label: string; cls: string }> = {
  locked:    { label: "LOCKED",    cls: "bg-[#1f2937] text-[#475569] border-[#1f2937]" },
  active:    { label: "ACTIVE",    cls: "bg-[#22d3ee]/10 text-[#22d3ee] border-[#22d3ee]/30" },
  completed: { label: "COMPLETED", cls: "bg-[#34d399]/10 text-[#34d399] border-[#34d399]/30" },
};

export function ProgressBadge({ status, size = "sm" }: Props) {
  const style = STYLES[status];
  const sizing = size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1";
  return (
    <span className={`inline-flex items-center font-bold uppercase tracking-wider rounded border ${sizing} ${style.cls}`}>
      {style.label}
    </span>
  );
}
