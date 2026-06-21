// Open-redirect guard (audit 2026-06, Área 7).
//
// A post-login `next` target must be a SAME-ORIGIN internal path. Reject any
// value that could navigate off-site:
//   - absolute URLs / schemes:  https://evil.tld, javascript:..., data:...
//   - protocol-relative:        //evil.tld
//   - backslash tricks:         /\evil.tld  (some browsers treat \ as /)
// Anything not matching a clean "/path" shape returns the safe fallback.

export function safeNextPath(
  raw: string | null | undefined,
  fallback = "/dashboard",
): string {
  if (!raw || typeof raw !== "string") return fallback;
  if (!raw.startsWith("/")) return fallback;            // scheme / relative
  if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback; // protocol-relative / backslash
  return raw;
}
