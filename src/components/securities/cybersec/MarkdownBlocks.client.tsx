"use client";

import { Fragment } from "react";
import type { CalloutVariant } from "@/lib/securities/cybersec";
import { parseContent, tokenizeInline } from "@/lib/securities/cybersec";

const CALLOUT_STYLE: Record<CalloutVariant, { border: string; bg: string; text: string }> = {
  warning: { border: "#eab308", bg: "rgba(234,179,8,0.08)", text: "#eab308" },
  tip: { border: "#22d3ee", bg: "rgba(34,211,238,0.08)", text: "#22d3ee" },
  success: { border: "#34d399", bg: "rgba(52,211,153,0.08)", text: "#34d399" },
  info: { border: "#64748b", bg: "rgba(100,116,139,0.08)", text: "#94a3b8" },
};

export function renderInline(line: string) {
  return tokenizeInline(line).map((tok, i) =>
    tok.b ? (
      <strong key={i} className="text-[#e2e8f0] font-bold">{tok.t}</strong>
    ) : (
      <Fragment key={i}>{tok.t}</Fragment>
    ),
  );
}

// Renderiza contenido markdown-ish con soporte de texto, código, tablas y callouts.
export function MarkdownBlocks({ content }: { content: string }) {
  const blocks = parseContent(content);
  return (
    <div className="space-y-2 text-sm text-[#e2e8f0] leading-relaxed">
      {blocks.map((block, bi) => {
        if (block.type === "code") {
          return (
            <pre
              key={bi}
              className="overflow-x-auto rounded-lg border border-[#1f2937] bg-[#05080f] px-3 py-2.5 text-[13px] font-mono text-[#7dd3fc] whitespace-pre-wrap"
            >
              <code>{block.lines.join("\n")}</code>
            </pre>
          );
        }
        if (block.type === "table") {
          return (
            <div key={bi} className="overflow-x-auto">
              <table className="w-full text-[13px] border-collapse">
                {block.header && block.header.length > 0 && (
                  <thead>
                    <tr>
                      {block.header.map((cell, ci) => (
                        <th key={ci} className="border border-[#1f2937] bg-[#0a0e1a] px-2.5 py-1.5 text-left font-bold text-[#22d3ee]">
                          {renderInline(cell)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                )}
                <tbody>
                  {(block.rows ?? []).map((row, ri) => (
                    <tr key={ri}>
                      {row.map((cell, ci) => (
                        <td key={ci} className="border border-[#1f2937] px-2.5 py-1.5 align-top">
                          {renderInline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (block.type === "callout") {
          const s = CALLOUT_STYLE[block.variant ?? "info"];
          return (
            <div key={bi} className="rounded-lg border-l-4 px-3 py-2" style={{ borderColor: s.border, background: s.bg }}>
              {block.lines.map((line, i) => (
                <p key={i} style={{ color: s.text }}>{renderInline(line)}</p>
              ))}
            </div>
          );
        }
        return (
          <div key={bi} className="space-y-1.5">
            {block.lines.map((line, i) => (
              <p key={i}>{renderInline(line)}</p>
            ))}
          </div>
        );
      })}
    </div>
  );
}
