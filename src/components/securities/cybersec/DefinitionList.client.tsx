"use client";

import { useState } from "react";
import { ChevronDown, BookMarked } from "lucide-react";
import type { ConceptDefinition } from "@/lib/securities/cybersec";
import { MarkdownBlocks } from "./MarkdownBlocks.client";

export function DefinitionList({ definitions }: { definitions: ConceptDefinition[] }) {
  if (definitions.length === 0) return null;
  return (
    <div className="space-y-2">
      {definitions.map((def) => (
        <DefinitionItem key={def.id} def={def} />
      ))}
    </div>
  );
}

function DefinitionItem({ def }: { def: ConceptDefinition }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-[#1f2937] bg-[#0a0e1a]">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-start gap-2 px-3 py-2.5 text-left"
      >
        <BookMarked size={15} className="mt-0.5 shrink-0 text-[#22d3ee]" />
        <span className="flex-1">
          <span className="block text-sm font-bold text-[#e2e8f0]">{def.term}</span>
          <span className="block text-xs text-[#94a3b8]">{def.short}</span>
        </span>
        <ChevronDown size={16} className={`mt-0.5 shrink-0 text-[#475569] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="space-y-3 border-t border-[#1f2937] px-3 py-3">
          <MarkdownBlocks content={def.detail} />

          {def.examples.length > 0 && (
            <div>
              <p className="mb-1 text-[10px] font-mono uppercase tracking-wider text-[#475569]">Ejemplos</p>
              <ul className="space-y-1">
                {def.examples.map((ex, i) => (
                  <li key={i} className="text-xs text-[#94a3b8]">• {ex}</li>
                ))}
              </ul>
            </div>
          )}

          {def.related.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#475569]">Relacionado:</span>
              {def.related.map((r) => (
                <span key={r} className="rounded border border-[#1f2937] bg-[#05080f] px-2 py-0.5 text-[11px] text-[#7dd3fc]">{r}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
