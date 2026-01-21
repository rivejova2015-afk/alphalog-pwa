/**
 * AlphaShield Debug Bundle Generator
 * Creates sanitized JSON debug bundle for troubleshooting
 */

import { sanitizeLogData } from './sanitize';
import { isSafeModeActive } from './safeMode';
import { getUnsentLogs, getAllLogs } from './queue';

export interface DebugBundle {
  timestamp: string;
  url: string;
  userAgent: string;
  safeMode: boolean;
  systemDiagnostics: {
    online: boolean;
    serviceWorkerRegistered: boolean;
    manifestDetected: boolean;
    pushPermission: string;
    pushSubscription: boolean;
  };
  recentErrors: Array<{
    id: string;
    level: string;
    area: string;
    message: string;
    created_at: string;
    fingerprint: string;
  }>;
  queueSize: number;
  buildVersion?: string;
}

/**
 * Detect if service worker is registered
 */
async function detectServiceWorker(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) {
    return false;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    return registrations.length > 0;
  } catch {
    return false;
  }
}

/**
 * Detect manifest.json
 */
async function detectManifest(): Promise<boolean> {
  try {
    const response = await fetch('/manifest.json', { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get push permission status
 */
function getPushPermissionStatus(): string {
  if (typeof Notification === 'undefined') {
    return 'unsupported';
  }

  return Notification.permission;
}

/**
 * Check if push is subscribed
 */
async function checkPushSubscription(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch {
    return false;
  }
}

/**
 * Generate complete debug bundle
 */
export async function generateDebugBundle(): Promise<DebugBundle> {
  try {
    // Collect system diagnostics
    const swRegistered = await detectServiceWorker();
    const manifestDetected = await detectManifest();
    const pushPermission = getPushPermissionStatus();
    const pushSubscribed = await checkPushSubscription();

    // Get recent errors from queue
    const queueLogs = await getUnsentLogs();
    const recentErrors = queueLogs
      .filter(log => log.level === 'error')
      .slice(0, 20)
      .map(log => ({
        id: log.id,
        level: log.level,
        area: log.area,
        message: log.message,
        created_at: new Date(log.timestamp).toISOString(),
        fingerprint: log.fingerprint,
      }));

    // Get queue size
    const queueSize = queueLogs.length;

    // Build the bundle
    const bundle: DebugBundle = {
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      safeMode: isSafeModeActive(),
      systemDiagnostics: {
        online: typeof navigator !== 'undefined' ? navigator.onLine : false,
        serviceWorkerRegistered: swRegistered,
        manifestDetected: manifestDetected,
        pushPermission: pushPermission,
        pushSubscription: pushSubscribed,
      },
      recentErrors,
      queueSize,
    };

    // Add build version if available
    if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_BUILD_VERSION) {
      bundle.buildVersion = process.env.NEXT_PUBLIC_BUILD_VERSION;
    }

    return bundle;
  } catch (error) {
    console.error('[AlphaShield] Error generating debug bundle:', error);

    // Return minimal bundle on error
    return {
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      safeMode: isSafeModeActive(),
      systemDiagnostics: {
        online: typeof navigator !== 'undefined' ? navigator.onLine : false,
        serviceWorkerRegistered: false,
        manifestDetected: false,
        pushPermission: 'unknown',
        pushSubscription: false,
      },
      recentErrors: [],
      queueSize: 0,
    };
  }
}

/**
 * Format debug bundle as JSON string
 */
export function formatDebugBundleAsJson(bundle: DebugBundle): string {
  return JSON.stringify(bundle, null, 2);
}

/**
 * Verify bundle doesn't contain sensitive data
 */
export function validateBundleIsSanitized(bundle: DebugBundle): {
  isSafe: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  const bundleStr = JSON.stringify(bundle).toLowerCase();

  const sensitivePatterns = [
    'token',
    'api_key',
    'apikey',
    'secret',
    'password',
    'authorization',
    'bearer ',
    'x-api-key',
    'x-auth',
  ];

  for (const pattern of sensitivePatterns) {
    if (bundleStr.includes(pattern)) {
      issues.push(`Possible sensitive data: ${pattern}`);
    }
  }

  return {
    isSafe: issues.length === 0,
    issues,
  };
}

/**
 * Copy debug bundle to clipboard
 */
export async function copyDebugBundleToClipboard(bundle: DebugBundle): Promise<boolean> {
  try {
    const json = formatDebugBundleAsJson(bundle);

    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(json);
      return true;
    } else {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = json;
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    }
  } catch (error) {
    console.error('[AlphaShield] Error copying to clipboard:', error);
    return false;
  }
}

/**
 * Download debug bundle as file
 */
export function downloadDebugBundle(bundle: DebugBundle): void {
  try {
    const json = formatDebugBundleAsJson(bundle);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `alphashield-debug-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('[AlphaShield] Error downloading debug bundle:', error);
  }
}
