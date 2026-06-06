/**
 * System Diagnostics & Debug Page
 * /dashboard/logs/system
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SystemDiagnostics } from '@/components/logs/SystemDiagnostics.client';
import { RecentErrors } from '@/components/logs/RecentErrors.client';
import BotOpsDailyReportCard from '@/components/logs/BotOpsDailyReportCard.client';
import { logError, logWarn } from '@/lib/log';
import SprintStatus from '@/components/logs/SprintStatus.client';
import { generateDebugBundle, copyDebugBundleToClipboard, validateBundleIsSanitized, DebugBundle } from '@/lib/alphashield/debugBundle';
import { generateCodexFixPrompt, copyPromptToClipboard } from '@/lib/alphashield/codexPrompt';
import { isSafeModeActive, disableSafeMode } from '@/lib/alphashield/safeMode';
import { isPublicFeatureEnabled } from "@/lib/runtime/featureFlags";

type TabType = 'diagnostics' | 'sprint-status';

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

export default function SystemPage() {
  const router = useRouter();
  const enableSystemLogs = isPublicFeatureEnabled("enableSystemLogs");
  const [activeTab, setActiveTab] = useState<TabType>('diagnostics');
  const [debugBundle, setDebugBundle] = useState<DebugBundle | null>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'bundle' | 'prompt' | null>(null);
  const [safeMode, setSafeMode] = useState(false);

  useEffect(() => {
    if (!enableSystemLogs) {
      router.replace('/dashboard');
    }
  }, [enableSystemLogs, router]);

  useEffect(() => {
    if (!enableSystemLogs) return;
    let mounted = true;

    const loadData = async () => {
      try {
        if (!mounted) return;
        setLoading(true);
        setLoadingError(null);
        setSafeMode(isSafeModeActive());

        // Keep diagnostics resilient: if debug bundle stalls, core cards should still render.
        const bundle = await withTimeout(generateDebugBundle(), 15000, 'Debug bundle');
        if (!mounted) return;
        setDebugBundle(bundle);

        const generatedPrompt = await withTimeout(generateCodexFixPrompt(bundle), 12000, 'Codex prompt');
        if (!mounted) return;
        setPrompt(generatedPrompt);
      } catch (error) {
        logError('SystemDiagnosticsPage', { component: 'dashboard.logs.system.load', message: 'Error loading system page', error: error instanceof Error ? error.message : String(error) });
        if (mounted) {
          setLoadingError('Diagnostics advanced data is temporarily unavailable. Core system panels remain active.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadData();
    return () => {
      mounted = false;
    };
  }, [enableSystemLogs]);

  const handleCopyBundle = async () => {
    if (!debugBundle) return;

    // Validate before copying
    const validation = validateBundleIsSanitized(debugBundle);
    if (!validation.isSafe) {
      logWarn('SystemDiagnosticsPage', 'Bundle contains potential sensitive data', { component: 'dashboard.logs.system.copyBundle.validation', issues: validation.issues });
    }

    const success = await copyDebugBundleToClipboard(debugBundle);
    if (success) {
      setCopied('bundle');
      setTimeout(() => setCopied(null), 2000);
    }
  };

  const handleCopyPrompt = async () => {
    const success = await copyPromptToClipboard(prompt);
    if (success) {
      setCopied('prompt');
      setTimeout(() => setCopied(null), 2000);
    }
  };

  const handleExitSafeMode = () => {
    disableSafeMode();
    setSafeMode(false);
  };

  if (!enableSystemLogs) {
    return null;
  }

  return (
    <div className="space-y-6 p-6 max-w-4xl text-slate-200">
      {/* Header */}
      <div>
        <h1 className="display-font text-2xl font-semibold text-slate-50">System Diagnostics & Audit</h1>
        <p className="text-sm text-slate-400 mt-1">Debug logging system and verify sprint implementation status</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-700/60 flex gap-8">
        <button
          onClick={() => setActiveTab('diagnostics')}
          className={`px-4 py-3 font-semibold border-b-2 transition ${
            activeTab === 'diagnostics'
              ? 'border-blue-600 text-blue-200'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          🔧 Diagnostics
        </button>
        <button
          onClick={() => setActiveTab('sprint-status')}
          className={`px-4 py-3 font-semibold border-b-2 transition ${
            activeTab === 'sprint-status'
              ? 'border-blue-600 text-blue-200'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          📊 Sprint Status
        </button>
      </div>

      {/* Safe Mode Banner */}
      {safeMode && activeTab === 'diagnostics' && (
        <div className="p-4 border border-orange-500/40 bg-orange-600/10 rounded-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-orange-200">⚠️ Safe Mode Active</h3>
              <p className="text-sm text-orange-200/80 mt-1">Error loop detected. Write operations are disabled.</p>
            </div>
            <button
              onClick={handleExitSafeMode}
              className="px-3 py-2 text-sm bg-orange-300 text-slate-950 rounded-lg hover:bg-orange-400 transition"
            >
              Exit Safe Mode
            </button>
          </div>
        </div>
      )}

      {/* Diagnostics Tab */}
      {activeTab === 'diagnostics' && (
        <>
        <div className="space-y-6">
          {/* System Status */}
          <div>
            <h2 className="text-lg font-semibold text-slate-100 mb-4">System Status</h2>
            <SystemDiagnostics />
          </div>

          {/* Recent Errors */}
          <div>
            <h2 className="text-lg font-semibold text-slate-100 mb-4">Bot Ops</h2>
            <BotOpsDailyReportCard />
          </div>

          {/* Recent Errors */}
          <div>
            <h2 className="text-lg font-semibold text-slate-100 mb-4">Recent Errors</h2>
            <RecentErrors />
          </div>

          {loadingError && (
            <div className="border border-amber-500/40 bg-amber-600/10 text-amber-100 rounded-xl p-3 text-sm">
              {loadingError}
            </div>
          )}

          {/* Debug Bundle */}
          <div className="border border-slate-700/60 rounded-2xl p-4 bg-slate-900/70 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-100">Debug Bundle</h3>
              <button
                onClick={handleCopyBundle}
                className={`px-4 py-2 text-sm rounded transition ${
                  copied === 'bundle'
                    ? 'bg-emerald-600/15 text-emerald-200'
                    : 'bg-blue-600 text-slate-950 hover:bg-blue-700'
                }`}
              >
                {copied === 'bundle' ? '✓ Copied' : 'Copy JSON'}
              </button>
            </div>

            {loading && !debugBundle && (
              <div className="text-sm text-slate-400">Loading diagnostics...</div>
            )}

            {debugBundle ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                <div className="text-sm space-y-2 font-mono bg-slate-900/80 p-3 rounded text-slate-200 text-xs whitespace-pre-wrap break-words max-h-48 overflow-y-auto border border-slate-700/60">
                  {JSON.stringify(debugBundle, null, 2).substring(0, 1000)}
                  {JSON.stringify(debugBundle).length > 1000 && '...\n(full bundle in clipboard)'}
                </div>
              </div>
            ) : null}

            <p className="text-xs text-slate-400">
              Contains system diagnostics and recent errors. Sanitized (no tokens/secrets).
            </p>
          </div>

          {/* Codex Fix Prompt */}
          <div className="border border-slate-700/60 rounded-2xl p-4 bg-slate-900/70 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-100">Codex Fix Prompt</h3>
              <button
                onClick={handleCopyPrompt}
                className={`px-4 py-2 text-sm rounded transition ${
                  copied === 'prompt'
                    ? 'bg-emerald-600/15 text-emerald-200'
                    : 'bg-blue-600 text-slate-950 hover:bg-blue-700'
                }`}
              >
                {copied === 'prompt' ? '✓ Copied' : 'Copy Prompt'}
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-sm space-y-2 bg-slate-900/80 p-3 rounded text-slate-200 text-xs whitespace-pre-wrap max-h-48 overflow-y-auto border border-slate-700/60">
                {loading && !prompt && 'Loading diagnostics...'}
                {prompt && (
                  <>
                    {prompt.substring(0, 1000)}
                    {prompt.length > 1000 && '...\n(full prompt in clipboard)'}
                  </>
                )}
              </div>
            </div>

            <p className="text-xs text-slate-400">
              Auto-generated prompt for Claude/GPT. Includes error summary, system context, and debug bundle.
            </p>
          </div>

          {/* Instructions */}
          <div className="border border-slate-700/60 rounded-2xl p-4 bg-slate-900/80">
            <h3 className="font-semibold text-sm text-slate-100 mb-3">How to Use</h3>
            <ol className="text-sm text-slate-300 space-y-2 list-decimal list-inside">
              <li>Review system status and recent errors above</li>
              <li>Copy the Debug Bundle (JSON) to see full diagnostic data</li>
              <li>Copy the Codex Fix Prompt and paste into Claude/ChatGPT</li>
              <li>Share with developers if issues persist</li>
              <li>Exit Safe Mode once issues are resolved</li>
            </ol>
          </div>
        </div>
      </>
      )}

      {/* Sprint Status Tab */}
      {activeTab === 'sprint-status' && (
        <SprintStatus />
      )}
    </div>
  );
}
