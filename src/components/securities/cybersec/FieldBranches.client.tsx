"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { FieldBranch } from "@/lib/securities/cybersec";

export function FieldBranches({ branches }: { branches: FieldBranch[] }) {
  if (branches.length === 0) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {branches.map((b) => (
        <div
          key={b.id}
          className="rounded-lg border bg-[#0a0e1a] p-3"
          style={{ borderColor: `${b.color}55` }}
        >
          <h3 className="text-sm font-bold" style={{ color: b.color }}>{b.name}</h3>
          <p className="mt-1 text-xs text-[#94a3b8]">{b.summary}</p>

          <Meta label="Roles" items={b.roles} />
          <Meta label="Skills" items={b.skills} />
          <Meta label="Herramientas" items={b.tools} />

          <Link
            href={`/securities/cybersec/certificaciones?track=${b.track}`}
            className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-bold hover:underline"
            style={{ color: b.color }}
          >
            Ver certificaciones <ArrowRight size={12} />
          </Link>
        </div>
      ))}
    </div>
  );
}

function Meta({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <p className="mt-1.5 text-[11px] text-[#94a3b8]">
      <span className="font-mono uppercase tracking-wider text-[#475569]">{label}: </span>
      {items.join(" · ")}
    </p>
  );
}
