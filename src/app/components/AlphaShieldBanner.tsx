'use client';

import { useEffect, useState } from 'react';
import {
  isSafeModeActive,
  getSafeModeTimeRemaining,
  getSafeModeBadge,
  getTopBugs,
  getErrorExplanation,
  getSuggestedAction,
  clearSafeModeErrors,
  copyDebugBundleToClipboard,
} from '@/lib/alphacore/alphashield';
import { logError } from '@/lib/log';

/**
 * AlphaShield Safe Mode Banner Component
 * 
 * Displays when Safe Mode is triggered (3+ errors in 60 seconds)
 * Shows error summary, top bugs, and recovery actions
 * 
 * Usage:
 * <AlphaShieldBanner />
 */
export default function AlphaShieldBanner() {
  const [isSafeMode, setIsSafeMode] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [badge, setBadge] = useState<ReturnType<typeof getSafeModeBadge> | null>(null);
  const [topBugs, setTopBugs] = useState<ReturnType<typeof getTopBugs>>([]);
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  // Update safe mode status every second
  useEffect(() => {
    const interval = setInterval(() => {
      const active = isSafeModeActive();
      setIsSafeMode(active);

      if (active) {
        const remaining = getSafeModeTimeRemaining();
        setTimeRemaining(remaining);
        setBadge(getSafeModeBadge());
        setTopBugs(getTopBugs(5));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (!isSafeMode) {
    return null; // Don't show banner when Safe Mode is inactive
  }

  const handleCopyBundle = async () => {
    try {
      await copyDebugBundleToClipboard();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      logError('AlphaShieldBanner', { component: 'alphashieldBanner.copyBundle', message: 'Failed to copy debug bundle', error: error instanceof Error ? error.message : String(error) });
    }
  };

  const handleClearErrors = () => {
    clearSafeModeErrors();
    setIsSafeMode(false);
  };

  return (
    <div className="w-full bg-red-950/80 border border-red-700/60 shadow-[0_18px_40px_rgba(12,6,6,0.6)] backdrop-blur rounded-2xl">
      <div className="max-w-7xl mx-auto px-4 py-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {/* Warning Icon */}
            <div className="flex-shrink-0">
              <svg
                className="h-6 w-6 text-red-300 animate-pulse"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>

            <div>
              <h3 className="text-sm font-bold text-red-200">
                🛡️ Safe Mode Active
              </h3>
              <p className="text-xs text-red-300 mt-0.5">
                {badge?.errorCount} errors detected in the last 60 seconds
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Timer */}
            <div className="text-xs font-mono bg-red-900/40 text-red-200 px-3 py-1 rounded-full border border-red-700/50">
              {timeRemaining}s
            </div>

            {/* Actions */}
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs font-medium text-red-300 hover:text-red-100 underline"
            >
              {showDetails ? 'Hide' : 'Details'}
            </button>

            <button
              onClick={handleCopyBundle}
              className="text-xs font-medium px-3 py-1 bg-red-600 text-white rounded-full hover:bg-red-700 transition"
            >
              {copied ? '✓ Copied' : 'Copy Bundle'}
            </button>

            <button
              onClick={handleClearErrors}
              className="text-xs font-medium px-3 py-1 bg-slate-800/80 text-slate-200 rounded-full hover:bg-slate-800 transition"
            >
              Clear
            </button>

            <button
              onClick={() => setShowDetails(false)}
              className="text-red-200 hover:text-red-100 text-xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Details Section */}
        {showDetails && (
          <div className="border-t border-red-700/50 pt-3 mt-3 space-y-3">
            {/* Top Bugs */}
            {topBugs.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-red-200 mb-2">
                  🐛 Most Common Errors
                </h4>
                <div className="space-y-2">
                  {topBugs.map((bug, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-900/70 border border-red-700/40 rounded-xl p-2 text-xs"
                    >
                      <div className="flex items-start justify-between mb-1">
                        <div>
                          <span className="font-bold text-red-300">
                            [{bug.code}]
                          </span>
                          <span className="text-slate-200 ml-2">
                            {bug.message}
                          </span>
                        </div>
                        <span className="bg-red-900/40 text-red-200 px-2 py-0.5 rounded-full font-mono">
                          {bug.count}x
                        </span>
                      </div>
                      <p className="text-slate-300">
                        💡 {getSuggestedAction(bug.code)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recovery Guide */}
            <div className="bg-slate-900/70 border border-red-700/40 rounded-xl p-2">
              <h4 className="text-xs font-bold text-red-200 mb-2">
                🔧 Recovery Steps
              </h4>
              <ol className="text-xs text-slate-200 space-y-1 list-decimal list-inside">
                <li>Review the errors above to understand what went wrong</li>
                <li>Copy the debug bundle for detailed analysis</li>
                <li>Check your data for duplicates or missing references</li>
                <li>Clear errors once you have fixed the issues</li>
                <li>Safe Mode will auto-disable after 60 seconds of no errors</li>
              </ol>
            </div>

            {/* Debug Info */}
            <div className="text-xs text-slate-300 bg-slate-900/60 p-2 rounded-xl font-mono border border-slate-800/60">
              <p>Mode: Safe | Errors: {badge?.errorCount} | Timer: {timeRemaining}s</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
