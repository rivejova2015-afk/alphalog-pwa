// Client helper for per-operation step-up (audit 2026-06, Área 13).
//
// When a sensitive endpoint replies 403 with a step-up reason, send the user to
// re-verify MFA (forcing a fresh challenge) and come back to where they were.

const STEP_UP_REASONS = new Set(["mfa_required", "step_up_required", "step_up_stale"]);

/**
 * If `response` is a step-up 403, redirect to the MFA re-auth page and return
 * true (the caller should stop). Otherwise return false and let the caller
 * handle the response normally. Uses response.clone() so the body stays
 * readable by the caller when not handled here.
 */
export async function maybeStepUpRedirect(response: Response): Promise<boolean> {
  if (response.status !== 403) return false;

  let reason: string | undefined;
  try {
    reason = ((await response.clone().json()) as { reason?: string })?.reason;
  } catch {
    return false;
  }

  if (!reason || !STEP_UP_REASONS.has(reason)) return false;

  const next = window.location.pathname + window.location.search;
  window.location.href = `/auth/stepup?reauth=1&next=${encodeURIComponent(next)}`;
  return true;
}
