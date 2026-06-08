'use client';

/**
 * Recent Errors Component
 * Displays latest errors from queue or app_logs
 */

import React, { useEffect, useState, useCallback } from 'react';
import { getUnsentLogs } from '@/lib/alphashield/queue';

import { logError } from "@/lib/log";
interface LogEntry {
  id: string;
  level: string;
  area: string;
  message: string;
  fingerprint: string;
  created_at: string;
  timestamp: number;
}

export function RecentErrors() {
  const [errors, setErrors] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadErrors = useCallback(async () => {
    try {
      setLoading(true);
      const logs = await getUnsentLogs();

      // Filter errors and format
      const errorLogs: LogEntry[] = logs
        .filter(log => log.level === 'error')
        .slice(0, 20)
        .map(log => ({
          id: log.id,
          level: log.level,
          area: log.area,
          message: log.message,
          fingerprint: log.fingerprint,
          created_at: new Date(log.timestamp).toLocaleString(),
          timestamp: log.timestamp,
        }))
        .sort((a, b) => b.timestamp - a.timestamp);

      setErrors(errorLogs);
    } catch (error) {
      logError('RecentErrors', { component: 'recenterrors', message: 'Error loading errors', error: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadErrors();

    // Refresh every 5 seconds
    const interval = setInterval(loadErrors, 5000);

    return () => clearInterval(interval);
  }, [loadErrors]);

  if (loading) {
    return (
      <div className="p-4 border border-slate-700/60 rounded-2xl bg-slate-900/70">
        <div className="text-sm text-slate-400">Loading errors...</div>
      </div>
    );
  }

  if (errors.length === 0) {
    return (
      <div className="p-4 border border-slate-700/60 rounded-2xl bg-slate-900/70">
        <div className="text-sm text-slate-400">✓ No errors logged</div>
      </div>
    );
  }

  return (
    <div className="border border-slate-700/60 rounded-2xl bg-slate-900/70">
      <div className="p-4 border-b border-slate-700/60">
        <h3 className="font-semibold text-sm text-slate-100">Recent Errors ({errors.length})</h3>
      </div>

      <div className="divide-y max-h-96 overflow-y-auto">
        {errors.map(error => (
          <div key={error.id} className="p-3 hover:bg-slate-800/60 cursor-pointer transition" onClick={() => setSelectedId(selectedId === error.id ? null : error.id)}>
            {/* Summary */}
            <div className="flex gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 mt-1 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-100 truncate">{error.area}</p>
                    <p className="text-xs text-slate-400 truncate">{error.message}</p>
                  </div>
                  <span className="text-xs text-slate-500 flex-shrink-0">{error.created_at}</span>
                </div>
              </div>
            </div>

            {/* Details (expandable) */}
            {selectedId === error.id && (
              <div className="mt-2 ml-4 pt-2 border-t border-slate-700/60 space-y-1">
                <div className="text-xs">
                  <span className="text-slate-400">Fingerprint: </span>
                  <code className="text-slate-200 bg-slate-900/80 px-1 rounded text-xs border border-slate-700/60">
                    {error.fingerprint.substring(0, 20)}...
                  </code>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-slate-700/60 bg-slate-900/80 text-xs text-slate-400">
        Showing latest 20 errors from queue
      </div>
    </div>
  );
}

