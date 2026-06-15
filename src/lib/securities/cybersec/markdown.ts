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

// ── Code-block detection ─────────────────────────────────────────────────────
// Lessons mix prose (lines that start with an emoji / bullet / → / **bold**)
// with code/commands (Bash, Python, SQL, PowerShell, HTML). We promote a line to
// a monospace code block ONLY on a strong positive signal AND never when it
// starts with a prose marker — so prose with parens/slashes (e.g. "Datos →
// Segmento (TCP)") is never mis-rendered as code. False negatives (code shown as
// prose) are acceptable; false positives are not.

// A line that begins with one of these is prose, never code.
const PROSE_PREFIX = /^\s*(\p{Extended_Pictographic}|•|→|▪|◦|·|\d️⃣|\*\*)/u;

// Commands / keywords that, at the start of a line, signal code. The lessons are
// in Spanish, so English keywords at line-start are virtually always code.
const CODE_KEYWORD = /^\s*(import |from |def |class |return\b|for |while |if |elif |else:|with |try:|except|print\(|fetch\(|document\.|window\.|console\.|new |let |const |var |func |package |go func|SELECT |INSERT |UPDATE |DELETE |UNION |' OR|' UNION|' AND|nmap |sudo|chmod|chown|ssh |scp |curl |wget |grep |awk |sed |find |cat |nc |ss |netstat|dig |snmpwalk|enum4linux|smbclient|smbmap|ldapsearch|crackmapexec|gobuster|ffuf|nikto|hydra|hashcat|msfvenom|use exploit|use auxiliary|set RHOSTS|set PAYLOAD|set LHOST|set LPORT|exploit\b|sessions|hashdump|getsystem|migrate|Get-|Set-|New-|Where|Select-|Invoke-|IEX|#!\/|\$ |tail -f|binwalk|apt |git |volatility|strings |upx |wmiexec|psexec|evil-winrm|proxychains|chisel|ligolo)/;
const CODE_ASSIGN = /^\s*[\w.$]+\s*=\s*\S+\(/; // x = foo(
const CODE_HTML = /^\s*<\/?[a-zA-Z]/;
const CODE_PIPE = /\|\s*(Where|Select|awk|grep|sort|uniq|wc|head|tail|jq)\b/;

export function isCodeLine(line: string): boolean {
  if (!line.trim()) return false;
  if (PROSE_PREFIX.test(line)) return false;
  return CODE_KEYWORD.test(line) || CODE_ASSIGN.test(line) || CODE_HTML.test(line) || CODE_PIPE.test(line);
}

export interface ContentBlock {
  type: "text" | "code";
  lines: string[];
}

// Groups a section's content into consecutive text / code blocks for rendering.
export function parseContent(content: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  for (const line of splitLines(content)) {
    const isCode = isCodeLine(line);
    const last = blocks[blocks.length - 1];
    if (last && (last.type === "code") === isCode) {
      last.lines.push(line);
    } else {
      blocks.push({ type: isCode ? "code" : "text", lines: [line] });
    }
  }
  return blocks;
}
