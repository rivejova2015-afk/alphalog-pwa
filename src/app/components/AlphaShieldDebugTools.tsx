'use client';

import { useState } from 'react';
import {
  copyDebugBundleToClipboard,
  generateErrorPrompt,
  getFormattedErrorLog,
  getTopBugs,
} from '@/lib/alphacore/alphashield';
import { logError } from '@/lib/log';

/**
 * AlphaShield Debug Utilities Component
 * 
 * Provides buttons for debugging and support:
 * - Copy Debug Bundle (for support team)
 * - Copy Error Prompt (for AI assistance)
 * - View Error History
 * 
 * Usage (add to settings or dev menu):
 * <AlphaShieldDebugTools />
 */
export default function AlphaShieldDebugTools() {
  const [bundleCopied, setBundleCopied] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [errorLog, setErrorLog] = useState<ReturnType<typeof getFormattedErrorLog>>([]);

  const handleCopyBundle = async () => {
    try {
      await copyDebugBundleToClipboard();
      setBundleCopied(true);
      setTimeout(() => setBundleCopied(false), 2000);
    } catch (error) {
      logError('AlphaShieldDebug', { component: 'alphashieldDebug.copyBundle', message: 'Failed to copy debug bundle', error: error instanceof Error ? error.message : String(error) });
      alert('Failed to copy debug bundle. Check console for details.');
    }
  };

  const handleCopyPrompt = async () => {
    try {
      const prompt = await generateErrorPrompt();
      await navigator.clipboard.writeText(prompt);
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 2000);
    } catch (error) {
      logError('AlphaShieldDebug', { component: 'alphashieldDebug.copyPrompt', message: 'Failed to copy prompt', error: error instanceof Error ? error.message : String(error) });
      alert('Failed to copy prompt. Check console for details.');
    }
  };

  const handleViewLog = () => {
    setErrorLog(getFormattedErrorLog());
    setShowLog(!showLog);
  };

  return (
    <div className="space-y-3">
      {/* Main Controls */}
      <div className="flex flex-wrap gap-2">
        {/* Copy Bundle Button */}
        <button
          onClick={handleCopyBundle}
          title="Copy debug bundle for support team"
          className="px-3 py-2 bg-amber-600 text-slate-950 text-sm font-medium rounded-full hover:bg-amber-700 transition flex items-center gap-2 shadow-[0_10px_22px_rgba(2,4,10,0.35)]"
        >
          <span>📦</span>
          {bundleCopied ? '✓ Bundle Copied' : 'Copy Bundle'}
        </button>

        {/* Copy Prompt Button */}
        <button
          onClick={handleCopyPrompt}
          title="Copy formatted error prompt for AI (ChatGPT, Claude, etc.)"
          className="px-3 py-2 bg-cyan-600 text-slate-50 text-sm font-medium rounded-full hover:bg-cyan-700 transition flex items-center gap-2"
        >
          <span>🤖</span>
          {promptCopied ? '✓ Prompt Copied' : 'Copy for AI'}
        </button>

        {/* View Log Button */}
        <button
          onClick={handleViewLog}
          title="View recent error history"
          className="px-3 py-2 bg-slate-800/80 text-slate-200 text-sm font-medium rounded-full hover:bg-slate-800 transition flex items-center gap-2"
        >
          <span>📋</span>
          {showLog ? 'Hide Log' : 'View Log'}
        </button>
      </div>

      {/* Error Log Viewer */}
      {showLog && errorLog.length > 0 && (
        <div className="border border-slate-700/60 rounded-2xl bg-slate-900/70 p-4 shadow-[0_16px_36px_rgba(2,4,10,0.4)]">
          <h3 className="text-sm font-bold text-slate-100 mb-3">
            📋 Recent Errors ({errorLog.length})
          </h3>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {errorLog.map((err, idx) => (
              <div
                key={idx}
                className="border border-slate-700/60 rounded-xl p-3 bg-slate-950/60 text-sm"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-red-300">
                        [{err.code}]
                      </span>
                      <span className="text-slate-200">{err.message}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Table: <span className="font-mono">{err.table}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `[${err.code}] ${err.message}`
                      );
                      alert('Error copied to clipboard');
                    }}
                    className="ml-2 px-2 py-1 bg-blue-600 text-slate-950 text-xs rounded-full hover:bg-blue-700 transition whitespace-nowrap"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  {new Date(err.timestamp).toLocaleString()}
                </p>
              </div>
            ))}
          </div>

          {/* Export Log */}
          <button
            onClick={() => {
              const logText = errorLog
                .map(
                  (err) =>
                    `[${err.timestamp}] [${err.code}] ${err.message} (${err.table})`
                )
                .join('\n');
              navigator.clipboard.writeText(logText);
              alert('Full log copied to clipboard');
            }}
            className="mt-3 w-full px-3 py-2 bg-slate-800/80 text-slate-200 text-xs font-medium rounded-full hover:bg-slate-800 transition"
          >
            📋 Export Full Log
          </button>
        </div>
      )}

      {/* Help Text */}
      <div className="text-xs text-slate-300 bg-slate-900/70 border border-slate-700/60 rounded-2xl p-3">
        <p className="font-semibold text-blue-600 mb-1">💡 Debug Tools:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>
            <strong>Copy Bundle</strong>: Send to support team with full error
            context
          </li>
          <li>
            <strong>Copy for AI</strong>: Paste into ChatGPT/Claude for help
          </li>
          <li>
            <strong>View Log</strong>: See detailed error history with
            timestamps
          </li>
        </ul>
      </div>
    </div>
  );
}
