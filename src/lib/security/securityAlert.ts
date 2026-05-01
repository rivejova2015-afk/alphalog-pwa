/**
 * Security event alerting via push notifications.
 *
 * Sends real-time alerts to the app owner when critical security events occur.
 * Integrates with the existing VAPID push infrastructure.
 */

export type SecurityEventType =
  | "csrf_failure"
  | "rate_limit_exceeded"
  | "honeypot_hit"
  | "repeated_401"
  | "ip_blocked"
  | "scraping_detected"
  | "db_tampering_detected"
  | "canary_modified";

export interface SecurityAlertContext {
  ip?: string;
  path?: string;
  userId?: string;
  details?: string;
}

/**
 * Trigger a security alert event.
 * Fire-and-forget: never blocks the request pipeline.
 *
 * @param event Security event type
 * @param context Additional context for the alert
 */
export async function triggerSecurityAlert(
  event: SecurityEventType,
  context: SecurityAlertContext
): Promise<void> {
  // Check required env vars
  const internalSecret = process.env.INTERNAL_API_SECRET;
  const ownerUserId = process.env.SECURITY_ALERT_USER_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://alphalog.io";

  if (!internalSecret || !ownerUserId) {
    // Silently skip if not configured (security alerting is optional)
    return;
  }

  try {
    // Format message for push notification
    const eventLabel = event.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const ipInfo = context.ip ? `IP: ${context.ip}` : "";
    const pathInfo = context.path ? `Path: ${context.path}` : "";
    const details = [ipInfo, pathInfo].filter(Boolean).join(" | ");

    const body = details || eventLabel;

    // Fire-and-forget: call push notify endpoint asynchronously
    // Don't await to avoid blocking the request
    fetch(`${appUrl}/api/push/notify-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${internalSecret}`,
      },
      body: JSON.stringify({
        userId: ownerUserId,
        title: `[Security] ${eventLabel}`,
        body,
        tag: `security-${event}`,
        data: {
          type: "security_event",
          event,
          timestamp: new Date().toISOString(),
        },
      }),
    }).catch(() => {
      // Silently fail on network/API errors
    });
  } catch {
    // Silently fail on any exception
    // Logging here would create a circular dependency with the security module
  }
}
