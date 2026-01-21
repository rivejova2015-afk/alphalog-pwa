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
      console.error('Failed to copy debug bundle:', error);
    }
  };

  const handleClearErrors = () => {
    clearSafeModeErrors();
    setIsSafeMode(false);
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-50 border-b-2 border-red-400 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {/* Warning Icon */}
            <div className="flex-shrink-0">
              <svg
                className="h-6 w-6 text-red-600 animate-pulse"
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
              <h3 className="text-sm font-bold text-red-800">
                🛡️ Safe Mode Active
              </h3>
              <p className="text-xs text-red-700 mt-0.5">
                {badge?.errorCount} errors detected in the last 60 seconds
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Timer */}
            <div className="text-xs font-mono bg-red-100 text-red-800 px-3 py-1 rounded">
              {timeRemaining}s
            </div>

            {/* Actions */}
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs font-medium text-red-700 hover:text-red-900 underline"
            >
              {showDetails ? 'Hide' : 'Details'}
            </button>

            <button
              onClick={handleCopyBundle}
              className="text-xs font-medium px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition"
            >
              {copied ? '✓ Copied' : 'Copy Bundle'}
            </button>

            <button
              onClick={handleClearErrors}
              className="text-xs font-medium px-2 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition"
            >
              Clear
            </button>

            <button
              onClick={() => setShowDetails(false)}
              className="text-red-600 hover:text-red-800 text-xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Details Section */}
        {showDetails && (
          <div className="border-t border-red-200 pt-3 mt-3 space-y-3">
            {/* Top Bugs */}
            {topBugs.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-red-800 mb-2">
                  🐛 Most Common Errors
                </h4>
                <div className="space-y-2">
                  {topBugs.map((bug, idx) => (
                    <div
                      key={idx}
                      className="bg-white border border-red-200 rounded p-2 text-xs"
                    >
                      <div className="flex items-start justify-between mb-1">
                        <div>
                          <span className="font-bold text-red-700">
                            [{bug.code}]
                          </span>
                          <span className="text-gray-700 ml-2">
                            {bug.message}
                          </span>
                        </div>
                        <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded font-mono">
                          {bug.count}x
                        </span>
                      </div>
                      <p className="text-gray-600">
                        💡 {getSuggestedAction(bug.code)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recovery Guide */}
            <div className="bg-white border border-red-200 rounded p-2">
              <h4 className="text-xs font-bold text-red-800 mb-2">
                🔧 Recovery Steps
              </h4>
              <ol className="text-xs text-gray-700 space-y-1 list-decimal list-inside">
                <li>Review the errors above to understand what went wrong</li>
                <li>Copy the debug bundle for detailed analysis</li>
                <li>Check your data for duplicates or missing references</li>
                <li>Clear errors once you have fixed the issues</li>
                <li>Safe Mode will auto-disable after 60 seconds of no errors</li>
              </ol>
            </div>

            {/* Debug Info */}
            <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded font-mono">
              <p>Mode: Safe | Errors: {badge?.errorCount} | Timer: {timeRemaining}s</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
