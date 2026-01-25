/**
 * System Diagnostics & Debug Page
 * /dashboard/logs/system
 */

'use client';

import React, { useEffect, useState } from 'react';
import { SystemDiagnostics } from '@/components/logs/SystemDiagnostics.client';
import { RecentErrors } from '@/components/logs/RecentErrors.client';
import SprintStatus from '@/components/logs/SprintStatus.client';
import { generateDebugBundle, copyDebugBundleToClipboard, validateBundleIsSanitized, DebugBundle } from '@/lib/alphashield/debugBundle';
import { generateCodexFixPrompt, copyPromptToClipboard } from '@/lib/alphashield/codexPrompt';
import { isSafeModeActive, disableSafeMode } from '@/lib/alphashield/safeMode';

type TabType = 'diagnostics' | 'sprint-status';

export default function SystemPage() {
  const [activeTab, setActiveTab] = useState<TabType>('diagnostics');
  const [debugBundle, setDebugBundle] = useState<DebugBundle | null>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<'bundle' | 'prompt' | null>(null);
  const [safeMode, setSafeMode] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        // Generate debug bundle
        const bundle = await generateDebugBundle();
        setDebugBundle(bundle);

        // Generate prompt
        const generatedPrompt = await generateCodexFixPrompt(bundle);
        setPrompt(generatedPrompt);

        // Check safe mode
        setSafeMode(isSafeModeActive());
      } catch (error) {
        console.error('Error loading system page:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleCopyBundle = async () => {
    if (!debugBundle) return;

    // Validate before copying
    const validation = validateBundleIsSanitized(debugBundle);
    if (!validation.isSafe) {
      console.warn('Bundle contains potential sensitive data:', validation.issues);
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

  return (
    <div className="space-y-6 p-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">System Diagnostics & Audit</h1>
        <p className="text-sm text-gray-600 mt-1">Debug logging system and verify sprint implementation status</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 flex gap-8">
        <button
          onClick={() => setActiveTab('diagnostics')}
          className={`px-4 py-3 font-semibold border-b-2 transition ${
            activeTab === 'diagnostics'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          🔧 Diagnostics
        </button>
        <button
          onClick={() => setActiveTab('sprint-status')}
          className={`px-4 py-3 font-semibold border-b-2 transition ${
            activeTab === 'sprint-status'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          📊 Sprint Status
        </button>
      </div>

      {/* Safe Mode Banner */}
      {safeMode && activeTab === 'diagnostics' && (
        <div className="p-4 border border-orange-200 bg-orange-50 rounded-lg">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-orange-900">⚠️ Safe Mode Active</h3>
              <p className="text-sm text-orange-800 mt-1">Error loop detected. Write operations are disabled.</p>
            </div>
            <button
              onClick={handleExitSafeMode}
              className="px-3 py-2 text-sm bg-orange-600 text-white rounded hover:bg-orange-700 transition"
            >
              Exit Safe Mode
            </button>
          </div>
        </div>
      )}

      {/* Diagnostics Tab */}
      {activeTab === 'diagnostics' && (
        <>
          {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading diagnostics...</div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* System Status */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">System Status</h2>
            <SystemDiagnostics />
          </div>

          {/* Recent Errors */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Errors</h2>
            <RecentErrors />
          </div>

          {/* Debug Bundle */}
          <div className="border rounded-lg p-4 bg-white space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Debug Bundle</h3>
              <button
                onClick={handleCopyBundle}
                className={`px-4 py-2 text-sm rounded transition ${
                  copied === 'bundle'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {copied === 'bundle' ? '✓ Copied' : 'Copy JSON'}
              </button>
            </div>

            {debugBundle && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                <div className="text-sm space-y-2 font-mono bg-gray-100 p-3 rounded text-gray-700 text-xs whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                  {JSON.stringify(debugBundle, null, 2).substring(0, 1000)}
                  {JSON.stringify(debugBundle).length > 1000 && '...\n(full bundle in clipboard)'}
                </div>
              </div>
            )}

            <p className="text-xs text-gray-500">
              Contains system diagnostics and recent errors. Sanitized (no tokens/secrets).
            </p>
          </div>

          {/* Codex Fix Prompt */}
          <div className="border rounded-lg p-4 bg-white space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Codex Fix Prompt</h3>
              <button
                onClick={handleCopyPrompt}
                className={`px-4 py-2 text-sm rounded transition ${
                  copied === 'prompt'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {copied === 'prompt' ? '✓ Copied' : 'Copy Prompt'}
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-sm space-y-2 bg-gray-100 p-3 rounded text-gray-700 text-xs whitespace-pre-wrap max-h-48 overflow-y-auto">
                {prompt.substring(0, 1000)}
                {prompt.length > 1000 && '...\n(full prompt in clipboard)'}
              </div>
            </div>

            <p className="text-xs text-gray-500">
              Auto-generated prompt for Claude/GPT. Includes error summary, system context, and debug bundle.
            </p>
          </div>

          {/* Instructions */}
          <div className="border rounded-lg p-4 bg-slate-900">
            <h3 className="font-semibold text-sm text-gray-900 mb-3">How to Use</h3>
            <ol className="text-sm text-gray-700 space-y-2 list-decimal list-inside">
              <li>Review system status and recent errors above</li>
              <li>Copy the Debug Bundle (JSON) to see full diagnostic data</li>
              <li>Copy the Codex Fix Prompt and paste into Claude/ChatGPT</li>
              <li>Share with developers if issues persist</li>
              <li>Exit Safe Mode once issues are resolved</li>
            </ol>
          </div>
        </div>
      )}
      </>
      )}

      {/* Sprint Status Tab */}
      {activeTab === 'sprint-status' && (
        <SprintStatus />
      )}
    </div>
  );
}

