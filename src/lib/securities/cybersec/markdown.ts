// Lightweight markdown-ish renderer used by LessonViewer.
// Only handles **bold** within plain text — newlines and bullets are rendered
// by the React component itself by splitting on \n. No third-party dependency,
// no HTML injection (we never use dangerouslySetInnerHTML).

import type { ReactNode } from "react";

const BOLD_RE = /\*\*([^*]+)\*\*/g;

// Splits a single line into plain strings and bold markers.
// Example: "Hola **mundo** y" → [{t:"Hola ", b:false}, {t:"mundo", b:true}, {t:" y", b:false}]
export function tokenizeInline(text: string): { t: string; b: boolean }[] {
  const tokens: { t: string; b: boolean }[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  BOLD_RE.lastIndex = 0;
  while ((match = BOLD_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ t: text.slice(lastIndex, match.index), b: false });
    }
    tokens.push({ t: match[1], b: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) tokens.push({ t: text.slice(lastIndex), b: false });
  if (tokens.length === 0) tokens.push({ t: text, b: false });
  return tokens;
}

// Splits a section's `c` (content) into logical lines for rendering. Each line
// keeps its leading marker (•, →, 🔢 etc.) so the component can decide styling.
export function splitLines(content: string): string[] {
  return content.split(/\r?\n/).filter((line) => line.length > 0);
}

export type RenderInline = (text: string) => ReactNode;
