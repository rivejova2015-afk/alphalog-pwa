/**
 * AlphaShield Safe Mode
 * Activates read-only mode when error loops are detected
 *
 * Triggers: 3+ errors (level='error') in 60 seconds
 * Effect: Disables create/save operations, shows banner
 */

interface ErrorTimestamp {
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
}

const STORAGE_KEY = 'alphashield_safe_mode';
const ERROR_WINDOW_MS = 60000; // 60 seconds
const ERROR_THRESHOLD = 3; // 3 errors to trigger

/**
 * Check if safe mode is currently active
 */
export function isSafeModeActive(): boolean {
  if (typeof localStorage === 'undefined') return false;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return false;

    const { active, activatedAt } = JSON.parse(stored);

    // Check if safe mode has expired (24 hours)
    if (activatedAt && Date.now() - activatedAt > 24 * 60 * 60 * 1000) {
      disableSafeMode();
      return false;
    }

    return active === true;
  } catch {
    return false;
  }
}

/**
 * Enable safe mode
 */
export function enableSafeMode(): void {
  if (typeof localStorage === 'undefined') return;

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        active: true,
        activatedAt: Date.now(),
      })
    );

    // Dispatch custom event for components to react
    window.dispatchEvent(
      new CustomEvent('alphashield:safemode', {
        detail: { active: true },
      })
    );

    console.warn('[AlphaShield] Safe Mode activated - error loop detected');
  } catch {
    console.error('[AlphaShield] Failed to enable safe mode');
  }
}

/**
 * Disable safe mode (manual exit)
 */
export function disableSafeMode(): void {
  if (typeof localStorage === 'undefined') return;

  try {
    localStorage.removeItem(STORAGE_KEY);

    // Dispatch custom event
    window.dispatchEvent(
      new CustomEvent('alphashield:safemode', {
        detail: { active: false },
      })
    );

    console.log('[AlphaShield] Safe Mode disabled');
  } catch {
    console.error('[AlphaShield] Failed to disable safe mode');
  }
}

/**
 * Track error and check if safe mode should activate
 * Called internally by logger
 */
export function trackErrorForSafeMode(level: string): void {
  if (typeof localStorage === 'undefined') return;

  try {
    // Only track errors (not warnings, etc.)
    if (level !== 'error') return;

    // Check current safe mode state
    if (isSafeModeActive()) return;

    // Get or create error tracking
    const key = 'alphashield_error_tracker';
    const stored = localStorage.getItem(key);
    let errorTimestamps: ErrorTimestamp[] = [];

    if (stored) {
      try {
        errorTimestamps = JSON.parse(stored);
      } catch {
        errorTimestamps = [];
      }
    }

    // Add current error
    const now = Date.now();
    errorTimestamps.push({ timestamp: now, level: 'error' as const });

    // Remove old errors outside the window
    errorTimestamps = errorTimestamps.filter(
      e => now - e.timestamp < ERROR_WINDOW_MS
    );

    // Check threshold
    if (errorTimestamps.length >= ERROR_THRESHOLD) {
      enableSafeMode();
    } else {
      // Update tracker
      localStorage.setItem(key, JSON.stringify(errorTimestamps));
    }
  } catch {
    console.error('[AlphaShield] Error tracking failed');
  }
}

/**
 * Reset error tracker (called when safe mode is disabled)
 */
export function resetErrorTracker(): void {
  if (typeof localStorage === 'undefined') return;

  try {
    localStorage.removeItem('alphashield_error_tracker');
  } catch {
    console.error('[AlphaShield] Failed to reset error tracker');
  }
}

/**
 * Hook for React components to monitor safe mode
 * Returns [active, disable]
 * 
 * Usage:
 * ```typescript
 * import React from 'react';
 * import { useSafeModeStatus } from '@/lib/alphashield/safeMode';
 * 
 * function MyComponent() {
 *   const [active, exitSafeMode] = useSafeModeStatus();
 *   // ...
 * }
 * ```
 */
import { useCallback, useEffect, useState } from 'react';

/**
 * React hook to monitor AlphaShield Safe Mode status.
 * Returns a tuple: [active, exitSafeMode]
 */
export function useSafeModeStatus(): [boolean, () => void] {
  const [active, setActive] = useState<boolean>(() => isSafeModeActive());

  useEffect(() => {
    const handleSafeModeChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ active: boolean }>;
      setActive(customEvent.detail.active);
    };

    window.addEventListener('alphashield:safemode', handleSafeModeChange);
    return () => {
      window.removeEventListener('alphashield:safemode', handleSafeModeChange);
    };
  }, [setActive]);

  const exitSafeMode = useCallback(() => {
    resetErrorTracker();
    disableSafeMode();
  }, []);

  return [active, exitSafeMode];
}

/**
 * Utility to disable button/input during safe mode
 * Returns true if should be disabled
 */
export function shouldDisableWrites(): boolean {
  return isSafeModeActive();
}

/**
 * Get safe mode state including timestamp
 */
export function getSafeModeState(): {
  active: boolean;
  activatedAt: number | null;
} {
  if (typeof localStorage === 'undefined') {
    return { active: false, activatedAt: null };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return { active: false, activatedAt: null };
    }

    const { active, activatedAt } = JSON.parse(stored);

    // Check expiration
    if (activatedAt && Date.now() - activatedAt > 24 * 60 * 60 * 1000) {
      disableSafeMode();
      return { active: false, activatedAt: null };
    }

    return { active, activatedAt };
  } catch {
    return { active: false, activatedAt: null };
  }
}

/**
 * Initialize safe mode tracking in logger
 * Should be called once during app initialization
 */
export function initializeSafeModeTracking(
  loggerInstance: { registerSafeModeCallback: (cb: (level: string) => void) => void }
): void {
  // Register callback with logger to track errors
  loggerInstance.registerSafeModeCallback(trackErrorForSafeMode);
}
