// Tests for ChatMessage markdown rendering XSS hardening (audit 2026-06, Área 3).
//
// renderMarkdown() builds an HTML string injected via dangerouslySetInnerHTML.
// User/LLM content MUST be HTML-escaped first so it cannot inject tags or event
// handlers. (CSP-nonce additionally blocks inline script execution in prod.)

import { describe, it, expect } from "vitest";
import { renderMarkdown } from "../ChatMessage";

describe("ChatMessage renderMarkdown — XSS hardening", () => {
  it("escapes injected tags so they render as inert text", () => {
    const out = renderMarkdown("**<img src=x onerror=alert(1)>**");
    expect(out).not.toContain("<img");
    expect(out).toContain("&lt;img");
    // our own markdown tag is still applied around the escaped content
    expect(out).toContain("<strong>");
  });

  it("escapes <script> payloads", () => {
    const out = renderMarkdown("hello <script>alert(1)</script>");
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;script&gt;");
  });

  it("still renders the supported markdown", () => {
    expect(renderMarkdown("**bold**")).toContain("<strong>bold</strong>");
    expect(renderMarkdown("### Title")).toContain("<h3");
  });
});
